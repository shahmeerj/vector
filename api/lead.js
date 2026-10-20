// POST /api/lead — receives the "Request a call" form, validates it, adds
// context, and forwards it to the Google Apps Script webhook that writes the
// Sheet row and sends the email. See README.md → "Lead capture".
//
// Env vars (Vercel → Settings → Environment Variables):
//   LEADS_WEBHOOK_URL     Apps Script web-app URL (ends in /exec)
//   LEADS_WEBHOOK_SECRET  shared secret, must match SECRET in the script

const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'hotmail.com',
  'outlook.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'proton.me', 'protonmail.com', 'pm.me', 'mail.com', 'gmx.com',
  'gmx.de', 'yandex.com', 'yandex.ru', 'zoho.com', 'hey.com', 'fastmail.com',
]);

const str = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function cleanDomain(site) {
  let s = str(site, 200).toLowerCase();
  if (!s) return '';
  if (!/^[a-z]+:\/\//.test(s)) s = 'https://' + s;
  try {
    return new URL(s).hostname.replace(/^www\./, '');
  } catch {
    return s.replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];
  }
}

function validate(body) {
  const name = str(body.name, 120);
  const email = str(body.email, 200).toLowerCase();
  const website = str(body.website, 200);
  const errors = {};
  if (name.length < 2) errors.name = 'Add your name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'Add a valid work email.';
  if (!/\.[a-z]{2,}/i.test(website)) errors.website = 'Add your company website.';
  return { name, email, website, errors };
}

async function forward(url, payload) {
  // Apps Script answers POSTs with a 302 to a googleusercontent URL; fetch
  // follows it. One retry covers the occasional cold-start hiccup.
  let last;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 9000);
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids a CORS preflight on the Apps Script side
        body: JSON.stringify(payload),
        redirect: 'follow',
        signal: ctrl.signal,
      });
      clearTimeout(t);
      const text = await r.text();
      let data = null;
      try { data = JSON.parse(text); } catch { /* HTML error page from Google */ }
      if (r.ok && data && data.ok) return data;
      last = new Error(`webhook ${r.status}: ${(data && data.error) || text.slice(0, 200)}`);
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = (req.body && typeof req.body === 'object') ? req.body : {};

  // Honeypot: real users never see this field. Pretend it worked.
  if (str(body.company_phone)) return res.status(200).json({ ok: true });

  const { name, email, website, errors } = validate(body);
  if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });

  const url = process.env.LEADS_WEBHOOK_URL;
  const secret = process.env.LEADS_WEBHOOK_SECRET;
  if (!url || !secret) {
    console.error('lead: LEADS_WEBHOOK_URL / LEADS_WEBHOOK_SECRET not set');
    return res.status(503).json({ ok: false, error: 'Lead capture is not configured yet.' });
  }

  const h = req.headers;
  const ip = (str(h['x-forwarded-for'], 200).split(',')[0] || '').trim();
  const domain = cleanDomain(website);
  const emailDomain = email.split('@')[1] || '';

  const lead = {
    ts: new Date().toISOString(),
    name,
    email,
    website,
    domain,
    free_email: FREE_MAIL.has(emailDomain),
    email_matches_site: !!domain && (emailDomain === domain || emailDomain.endsWith('.' + domain) || domain.endsWith('.' + emailDomain)),
    cta: str(body.cta, 80),
    cta_page: str(body.cta_page, 300),
    page: str(body.page, 300),
    referrer: str(body.referrer, 300),
    landing: str(body.landing, 300),
    utm_source: str(body.utm_source, 100),
    utm_medium: str(body.utm_medium, 100),
    utm_campaign: str(body.utm_campaign, 150),
    utm_content: str(body.utm_content, 150),
    utm_term: str(body.utm_term, 150),
    gclid: str(body.gclid, 150),
    li_fat_id: str(body.li_fat_id, 150),
    country: str(h['x-vercel-ip-country'], 8),
    region: str(h['x-vercel-ip-country-region'], 20),
    city: str(h['x-vercel-ip-city'], 80),
    timezone: str(body.timezone, 60),
    ip,
    user_agent: str(h['user-agent'], 300),
  };

  try {
    const result = await forward(url, { secret, lead });
    return res.status(200).json({ ok: true, seen_before: !!result.seen_before });
  } catch (e) {
    // Log the full lead so it can be recovered from Vercel's function logs.
    console.error('lead: delivery failed', e && e.message, JSON.stringify(lead));
    return res.status(502).json({ ok: false, error: 'Could not deliver your request.' });
  }
};
