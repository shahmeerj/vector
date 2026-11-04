// POST /api/apply — receives an application and its CV, validates them and
// forwards them to the Apps Script, which adds the Sheet row, saves the CV to
// Drive and sends the email. Vercel caps request bodies at 4.5 MB, so CVs are
// limited to 3 MB (about 4 MB once base64-encoded).

const { str, line, configured, callSheet } = require('../lib/careers');

const MAX_CV_BYTES = 3 * 1024 * 1024;
const TYPES = {
  pdf: { mime: 'application/pdf', magic: [0x25, 0x50, 0x44, 0x46] },
  doc: { mime: 'application/msword', magic: [0xd0, 0xcf, 0x11, 0xe0] },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', magic: [0x50, 0x4b] },
};

function checkCv(cv) {
  const name = line(cv && cv.name, 200);
  const ext = (name.split('.').pop() || '').toLowerCase();
  const type = TYPES[ext];
  const base64 = typeof (cv && cv.base64) === 'string' ? cv.base64 : '';
  if (!name || !base64) return { error: 'Add your CV.' };
  if (!type) return { error: 'Upload a PDF or Word file.' };
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return { error: 'We couldn’t read that file. Try saving it again.' };
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > MAX_CV_BYTES) return { error: 'Your CV must be under 3 MB.' };
  if (!type.magic.every((b, i) => bytes[i] === b)) return { error: 'That file doesn’t look like a PDF or Word document.' };
  return { cv: { ext, mime: type.mime, base64 } };
}

const NOTICE = ['Can start now', '2 weeks', '1 month', '2 months', '3 months or more'];

// Date of birth as YYYY-MM-DD; returns the age in whole years, or null.
function ageFrom(dob, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() < mo - 1 || (now.getUTCMonth() === mo - 1 && now.getUTCDate() < d)) age -= 1;
  return age;
}

function cleanUrl(v) {
  if (!v) return '';
  const u = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const url = new URL(u);
    return /^https?:$/.test(url.protocol) && url.hostname.includes('.') ? url.href : null;
  } catch { return null; }
}

function validate(body) {
  const a = {
    name: line(body.name, 120),
    email: line(body.email, 200).toLowerCase(),
    whatsapp: line(body.whatsapp, 30),
    dob: line(body.dob, 10),
    city: line(body.city, 80),
    linkedin: line(body.linkedin, 300),
    notice: line(body.notice, 40),
    salary: line(body.salary, 20),
  };
  const errors = {};
  if (a.name.length < 2) errors.name = 'Add your full name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a.email)) errors.email = 'Add a valid email.';
  if (!/^\+?[\d\s()-]{7,25}$/.test(a.whatsapp)) errors.whatsapp = 'Add a valid number, with country code.';
  const age = ageFrom(a.dob);
  if (age === null) errors.dob = 'Add your date of birth.';
  else if (age < 16 || age > 80) errors.dob = 'Check your date of birth.';
  else a.age = String(age);
  if (a.city.length < 2) errors.city = 'Add the city you live in.';
  const linkedin = cleanUrl(a.linkedin);
  if (linkedin === null) errors.linkedin = 'Add a full link, or leave it blank.';
  else a.linkedin = linkedin;
  if (!NOTICE.includes(a.notice)) errors.notice = 'Choose your notice period.';
  if (a.salary) {
    const digits = a.salary.replace(/[,\s]/g, '');
    if (!/^\d{1,9}$/.test(digits)) errors.salary = 'Use numbers only, or leave it blank.';
    else a.salary = Number(digits).toLocaleString('en-US');
  }
  return { a, errors };
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

  const { a, errors } = validate(body);
  const { cv, error: cvError } = checkCv(body.cv);
  if (cvError) errors.cv = cvError;
  if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });

  if (!configured()) {
    console.error('apply: CAREERS_WEBHOOK_URL / CAREERS_WEBHOOK_SECRET not set');
    return res.status(503).json({ ok: false, error: 'Applications aren’t open yet.' });
  }

  const application = {
    ...a,
    submission_id: line(body.submission_id, 80),
    source: line(body.source, 200),
    landing: line(body.landing, 300),
    referrer: line(body.referrer, 300),
    country: line(req.headers['x-vercel-ip-country'], 8),
  };

  try {
    // No automatic retry: the upload may still be finishing. The visitor can
    // resend, and submission_id stops that creating a second row.
    const result = await callSheet('apply', { job_id: line(body.job_id, 80), application, cv }, { timeout: 27000, retries: 0 });
    if (result.ok) return res.status(200).json({ ok: true });
    if (result.error === 'closed' || result.error === 'not found') {
      return res.status(409).json({ ok: false, error: 'This role is no longer open.' });
    }
    throw new Error(result.error || 'apply failed');
  } catch (e) {
    // The CV stays out of the logs. The rest can be recovered from Vercel's function logs.
    console.error('apply: delivery failed', e && e.message, JSON.stringify({ job_id: body.job_id, ...application }));
    return res.status(502).json({ ok: false, error: 'Your application didn’t go through. Please try again.' });
  }
};
