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

function validate(body) {
  const a = {
    name: line(body.name, 120),
    email: line(body.email, 200).toLowerCase(),
    whatsapp: line(body.whatsapp, 30),
    location: line(body.location, 120),
    linkedin: line(body.linkedin, 300),
    salary: line(body.salary, 120),
    start: line(body.start, 120),
  };
  const errors = {};
  if (a.name.length < 2) errors.name = 'Add your full name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a.email)) errors.email = 'Add a valid email.';
  if (!/^\+?[\d\s()-]{7,25}$/.test(a.whatsapp)) errors.whatsapp = 'Add a valid number, with country code.';
  if (a.location.length < 2) errors.location = 'Add your city and country.';
  if (!/linkedin\.com\/\S+/i.test(a.linkedin)) errors.linkedin = 'Add a link to your LinkedIn profile.';
  if (!a.salary) errors.salary = 'Add your expected salary.';
  if (!a.start) errors.start = 'Add when you could start.';
  if (body.consent !== true) errors.consent = 'We need your agreement to store your application.';
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
    answers: (body.answers && typeof body.answers === 'object') ? body.answers : {},
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
    if (result.errors) return res.status(400).json({ ok: false, errors: result.errors });
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
