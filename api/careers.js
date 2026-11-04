// GET /careers, /careers/:slug and /careers/:slug/apply (rewrites in vercel.json).
// Pages are rendered here so job links show a proper preview on LinkedIn and
// WhatsApp, and Google can read the listing. The CDN caches them, so edits show
// within a minute.

const { callSheet, isAdmin, line } = require('../lib/careers');
const { listPage, applyPage, messagePage } = require('../lib/careers-page');

const CDN = 'public, s-maxage=60, stale-while-revalidate=600';

function send(res, status, html, cache) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  return res.status(status).send(html);
}

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method not allowed');
  }

  const slug = line(req.query.slug, 100);
  const wantsApply = req.query.apply === '1';
  const preview = req.query.preview === '1' && isAdmin(req);
  const cache = req.query.preview ? 'private, no-store' : CDN;

  let jobs;
  try {
    const data = await callSheet('jobs');
    if (!data.ok) throw new Error(data.error || 'jobs failed');
    jobs = data.jobs;
  } catch (e) {
    console.error('careers: could not load jobs', e && e.message);
    return send(res, 503, messagePage('We can’t load our open roles right now.', 'Please try again in a few minutes.'), 'no-store');
  }

  const open = jobs.filter((j) => j.status === 'Open');
  if (!slug) return send(res, 200, listPage(open), cache);

  const job = jobs.find((j) => j.slug === slug);
  if (!job || (job.status === 'Draft' && !preview)) {
    return send(res, 404, messagePage('We couldn’t find that role.', 'It may have been removed.'), cache);
  }

  if (wantsApply) {
    if (job.status === 'Open' || preview) return send(res, 200, applyPage(job, { preview }), cache);
    return send(res, 410, messagePage(`${job.title} is no longer open.`, 'We’re not taking applications for this role.'), cache);
  }

  if (job.status === 'Closed' && !preview) {
    return send(res, 200, listPage(open, { closedTitle: job.title }), cache);
  }
  // A draft being previewed is shown in the list alongside the open roles.
  const shown = open.some((j) => j.id === job.id) ? open : [job, ...open];
  return send(res, 200, listPage(shown, { openSlug: job.slug, preview, job }), cache);
};
