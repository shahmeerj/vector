// POST /api/admin — the /admin page's backend. Everything except "login" needs
// a valid session cookie. See lib/careers.js for how sessions work.

const {
  str, line, configured, callSheet, safeEqual, passwordReady, sessionCookie, isAdmin, SESSION_HOURS,
} = require('../lib/careers');

const JOB_STATUS = ['Draft', 'Open', 'Closed'];
const WORK_TYPES = ['', 'Remote', 'Hybrid', 'On-site'];
const EMPLOYMENT_TYPES = ['', 'Full-time', 'Part-time', 'Contract'];
const QUESTION_TYPES = ['text', 'long', 'single', 'multi'];
const RESERVED = [
  'Received (UTC)', 'Name', 'Email', 'WhatsApp', 'City and country', 'LinkedIn', 'CV', 'Expected salary',
  'Earliest start', 'Source', 'Landing page', 'Referrer', 'IP country', 'Status', 'Notes',
].map((s) => s.toLowerCase());

function cleanQuestions(input, errors) {
  const list = Array.isArray(input) ? input.slice(0, 20) : [];
  const seen = new Set();
  return list.map((q, i) => {
    const out = {
      id: /^q_[a-z0-9_]{1,40}$/.test(q && q.id) ? q.id : `q_${Date.now().toString(36)}${i}`,
      label: line(q && q.label, 200),
      type: QUESTION_TYPES.includes(q && q.type) ? q.type : 'text',
      required: !!(q && q.required),
      options: [],
    };
    if (out.type === 'single' || out.type === 'multi') {
      const raw = Array.isArray(q.options) ? q.options : [];
      out.options = [...new Set(raw.map((o) => line(o, 100)).filter(Boolean))].slice(0, 15);
      if (out.options.length < 2) errors[`question_${i}`] = 'Add at least two options.';
    }
    const key = out.label.toLowerCase();
    if (!out.label) errors[`question_${i}`] = 'Add the question text.';
    else if (RESERVED.includes(key)) errors[`question_${i}`] = 'The form already asks this.';
    else if (seen.has(key)) errors[`question_${i}`] = 'This question appears twice.';
    seen.add(key);
    return out;
  });
}

function cleanJob(input) {
  const errors = {};
  const job = {
    title: line(input.title, 120),
    status: JOB_STATUS.includes(input.status) ? input.status : 'Draft',
    location: line(input.location, 120),
    work_type: WORK_TYPES.includes(input.work_type) ? input.work_type : '',
    employment_type: EMPLOYMENT_TYPES.includes(input.employment_type) ? input.employment_type : '',
    salary: line(input.salary, 120),
    intro: str(input.intro, 4000),
    responsibilities: str(input.responsibilities, 4000),
    requirements: str(input.requirements, 4000),
    nice_to_have: str(input.nice_to_have, 4000),
  };
  if (typeof input.id === 'string' && input.id) job.id = line(input.id, 80);
  job.questions = cleanQuestions(input.questions, errors);

  if (job.title.length < 3) errors.title = 'Add a job title.';
  if (job.status === 'Open') {
    if (!job.location) errors.location = 'Add the location before publishing.';
    if (!job.work_type) errors.work_type = 'Choose one before publishing.';
    if (!job.employment_type) errors.employment_type = 'Choose one before publishing.';
    if (!job.intro) errors.intro = 'Add an introduction before publishing.';
    if (!job.responsibilities) errors.responsibilities = 'Add at least one line before publishing.';
    if (!job.requirements) errors.requirements = 'Add at least one line before publishing.';
  }
  return { job, errors };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  // A custom header can't be sent cross-site without CORS approval, which this endpoint never gives.
  if (req.headers['x-vector-admin'] !== '1') return res.status(403).json({ ok: false, error: 'Forbidden' });

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const { action } = body;

  if (!passwordReady() || !configured()) {
    console.error('admin: ADMIN_PASSWORD (12+ characters) or the careers webhook is not set');
    return res.status(503).json({ ok: false, error: 'Admin isn’t set up yet. See README → Careers.' });
  }

  if (action === 'login') {
    if (typeof body.password !== 'string' || !safeEqual(body.password, process.env.ADMIN_PASSWORD)) {
      await new Promise((r) => setTimeout(r, 1200));
      return res.status(401).json({ ok: false, error: 'Wrong password.' });
    }
    res.setHeader('Set-Cookie', sessionCookie(SESSION_HOURS * 3600));
    return res.status(200).json({ ok: true });
  }

  if (action === 'logout') {
    res.setHeader('Set-Cookie', sessionCookie(0));
    return res.status(200).json({ ok: true });
  }

  if (!isAdmin(req)) return res.status(401).json({ ok: false, error: 'Please sign in.' });

  try {
    if (action === 'list') {
      const data = await callSheet('jobs');
      if (!data.ok) throw new Error(data.error || 'list failed');
      return res.status(200).json({ ok: true, jobs: data.jobs, sheet_url: data.sheet_url });
    }

    if (action === 'save') {
      const { job, errors } = cleanJob((body.job && typeof body.job === 'object') ? body.job : {});
      if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });
      // The retry could create a second copy of a brand-new job.
      const data = await callSheet('saveJob', { job }, { timeout: 25000, retries: 0 });
      if (!data.ok) throw new Error(data.error || 'save failed');
      return res.status(200).json({ ok: true, job: data.job });
    }

    if (action === 'delete') {
      const data = await callSheet('deleteJob', { id: line(body.id, 80) }, { timeout: 25000, retries: 0 });
      if (data.error === 'has applications') {
        return res.status(409).json({ ok: false, error: 'This role has applications, so close it instead.' });
      }
      if (!data.ok) throw new Error(data.error || 'delete failed');
      return res.status(200).json({ ok: true });
    }
  } catch (e) {
    console.error('admin:', action, e && e.message);
    return res.status(502).json({ ok: false, error: 'Couldn’t reach the Sheet. Try again.' });
  }

  return res.status(400).json({ ok: false, error: 'Unknown action' });
};
