// Shared by /api/careers, /api/apply and /api/admin.
//
// Env vars (Vercel → Settings → Environment Variables):
//   CAREERS_WEBHOOK_URL     Apps Script web-app URL (ends in /exec)
//   CAREERS_WEBHOOK_SECRET  shared secret, must match SECRET in the script
//   ADMIN_PASSWORD          password for /admin, at least 12 characters

const crypto = require('crypto');

const str = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
// For values that end up in an email header or on one line of a Sheet.
const line = (v, max = 300) => str(v, max).replace(/[\r\n\t]+/g, ' ');

const configured = () => !!(process.env.CAREERS_WEBHOOK_URL && process.env.CAREERS_WEBHOOK_SECRET);

async function callSheet(action, payload = {}, { timeout = 15000, retries = 1 } = {}) {
  const url = process.env.CAREERS_WEBHOOK_URL;
  const secret = process.env.CAREERS_WEBHOOK_SECRET;
  if (!url || !secret) throw new Error('careers webhook not configured');

  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      // Apps Script answers POSTs with a 302 to a googleusercontent URL; fetch follows it.
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ secret, action, ...payload }),
        redirect: 'follow',
        signal: ctrl.signal,
      });
      const text = await r.text();
      let data = null;
      try { data = JSON.parse(text); } catch { /* HTML error page from Google */ }
      if (r.ok && data) return data;
      last = new Error(`webhook ${r.status}: ${text.slice(0, 200)}`);
    } catch (e) {
      last = e;
    } finally {
      clearTimeout(t);
    }
  }
  throw last;
}

/* Admin session: a signed cookie holding its expiry. Changing ADMIN_PASSWORD
   signs everyone out. */
const COOKIE = 'vx_admin';
const SESSION_HOURS = 12;

const signingKey = () => crypto
  .createHash('sha256')
  .update(`${process.env.ADMIN_PASSWORD || ''}:${process.env.CAREERS_WEBHOOK_SECRET || ''}`)
  .digest();

const sign = (value) => crypto.createHmac('sha256', signingKey()).update(value).digest('hex');

function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

const passwordReady = () => (process.env.ADMIN_PASSWORD || '').length >= 12;

function sessionCookie(maxAge) {
  const secure = process.env.VERCEL ? '; Secure' : '';
  if (!maxAge) return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
  const exp = String(Date.now() + maxAge * 1000);
  return `${COOKIE}=${exp}.${sign(exp)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

function isAdmin(req) {
  if (!passwordReady()) return false;
  const raw = String(req.headers.cookie || '');
  const found = raw.split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  if (!found) return false;
  const [exp, sig] = found.slice(COOKIE.length + 1).split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(exp));
}

module.exports = {
  str, line, configured, callSheet, safeEqual, passwordReady, sessionCookie, isAdmin, SESSION_HOURS,
};
