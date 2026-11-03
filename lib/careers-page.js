// HTML for the public careers pages. Everything from the Sheet is escaped here.

const WORDMARK = '<svg class="wm" width="115" height="30" viewBox="10 12.5 144 37.5" aria-hidden="true"><defs><linearGradient id="nwm" x1="12" x2="46" y1="0" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#3B82F6" stop-opacity="0"/><stop offset="1" stop-color="#3B82F6"/></linearGradient></defs><path d="M20.5 26.9L31 43.66L41.5 26.9M49.70 37.10H71.20M68.50 37.10A9.40 9.40 0 1 0 66.09 43.39M93.10 31.06A9.40 9.40 0 1 0 93.10 43.14M103.10 16.6V48.8M96.10 28.10H110.60M133.70 37.10A9.40 9.40 0 1 0 114.90 37.10A9.40 9.40 0 1 0 133.70 37.10ZM141.90 25.4V48.8M141.90 39.10C141.90 29.30 145.40 28.10 151.40 28.10" fill="none" stroke="#F5F5F0" stroke-width="5.4" stroke-miterlimit="10"/><g class="wm-s"><path d="M12 17.5H46" stroke="url(#nwm)" stroke-width="3.4" stroke-linecap="round"/><circle cx="47" cy="17.5" r="4.1" fill="#3B82F6"/></g></svg>';
const ARROW = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const SITE = 'https://meetvector.co';

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const lines = (text) => String(text || '').split(/\r?\n/).map((l) => l.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean);
const paragraphs = (text) => lines(text).map((l) => `<p>${esc(l)}</p>`).join('');
const bullets = (title, text) => {
  const items = lines(text);
  if (!items.length) return '';
  return `<section class="job-sec"><h2>${esc(title)}</h2><ul>${items.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></section>`;
};
const meta = (job) => [job.location, job.work_type, job.employment_type, job.salary].filter(Boolean);

function shell({ title, description, url, body, noindex, head = '', script = false }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(SITE + url)}">`}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Vector">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(SITE + url)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300..700&family=Geist+Mono:wght@400;500&display=swap">
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
<link rel="stylesheet" href="/assets/vector.css">
<link rel="stylesheet" href="/assets/careers.css">
${head}
</head>
<body>
<nav class="nav solid" aria-label="Main">
  <div class="wrap">
    <a href="/" class="wordmark" aria-label="Vector home">${WORDMARK}</a>
    <div class="nav-links"><a href="/#work">Work</a><a href="/#services">What we do</a><a href="/careers" aria-current="page">Careers</a></div>
  </div>
</nav>
<main>
${body}
</main>
<footer class="foot">
  <div class="wrap">
    <div class="foot-r">
      <p>B2B performance marketing for software companies selling into the US and Canada.</p>
      <div class="foot-links"><a href="/#work">Work</a><a href="/#services">What we do</a><a href="/#faq">FAQ</a><a href="/careers">Careers</a></div>
    </div>
    <small>© 2026 Vector</small>
  </div>
</footer>
<script src="/assets/leads.js"></script>
${script ? '<script src="/assets/careers.js"></script>' : ''}
</body>
</html>`;
}

function listPage(jobs) {
  const rows = jobs.map((job) => `
      <li><a class="role" href="/careers/${esc(job.slug)}">
        <span class="role-t">${esc(job.title)}</span>
        <span class="job-meta">${meta(job).slice(0, 3).map((m) => `<span>${esc(m)}</span>`).join('')}</span>
        <span class="role-go" aria-hidden="true">${ARROW}</span>
      </a></li>`).join('');
  const body = `
<section class="careers-hero">
  <div class="wrap">
    <p class="label">Careers</p>
    <h1>Work at Vector.</h1>
    <p class="sub">We keep our client list short so our specialists can work closely with each account.</p>
  </div>
</section>
<section class="careers-list">
  <div class="wrap">
    ${jobs.length ? `<ul class="roles">${rows}
    </ul>` : '<p class="empty">No open roles right now. Check back soon.</p>'}
  </div>
</section>`;
  return shell({
    title: 'Careers · Vector',
    description: 'Open roles at Vector, a B2B performance marketing team.',
    url: '/careers',
    body,
  });
}

function jsonLd(job) {
  const employment = { 'Full-time': 'FULL_TIME', 'Part-time': 'PART_TIME', Contract: 'CONTRACTOR' };
  const data = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: [
      lines(job.intro).map((l) => `<p>${esc(l)}</p>`).join(''),
      ...[['What you’ll do', job.responsibilities], ['What you need', job.requirements], ['Nice to have', job.nice_to_have]]
        .filter(([, t]) => lines(t).length)
        .map(([h, t]) => `<p>${esc(h)}</p><ul>${lines(t).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`),
    ].join(''),
    datePosted: String(job.published_at || job.updated_at || '').slice(0, 10),
    employmentType: employment[job.employment_type],
    hiringOrganization: { '@type': 'Organization', name: 'Vector', sameAs: SITE },
    directApply: true,
  };
  if (job.work_type === 'Remote') {
    data.jobLocationType = 'TELECOMMUTE';
    data.applicantLocationRequirements = { '@type': 'Country', name: job.location };
  } else {
    data.jobLocation = { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: job.location } };
  }
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

const field = ({ id, label, type = 'text', auto = '', placeholder = '', max = 200 }) => `
        <div class="f" data-field="${id}">
          <label for="ap-${id}">${esc(label)}</label>
          <input id="ap-${id}" name="${id}" type="${type}" maxlength="${max}"${auto ? ` autocomplete="${auto}"` : ''}${placeholder ? ` placeholder="${esc(placeholder)}"` : ''}>
          <span class="err"></span>
        </div>`;

function applyForm(job, preview) {
  return `
<section class="apply" id="apply">
  <div class="wrap wrap-job">
    <h2>Apply for this role</h2>
    <form class="apply-form" id="applyForm" novalidate data-job="${esc(job.id)}">
      <div class="grid">
        ${field({ id: 'name', label: 'Full name', auto: 'name', max: 120 })}
        ${field({ id: 'email', label: 'Email', type: 'email', auto: 'email' })}
        ${field({ id: 'whatsapp', label: 'WhatsApp number', type: 'tel', auto: 'tel', placeholder: '+92 300 1234567', max: 30 })}
      </div>
      <div class="f f-wide" data-field="cv">
        <span class="f-label" id="cvLabel">CV</span>
        <label class="drop" id="cvDrop">
          <input type="file" id="ap-cv" accept=".pdf,.doc,.docx" aria-labelledby="cvLabel">
          <span class="drop-t" id="cvText">Upload your CV</span>
          <span class="drop-h">PDF or Word, up to 3 MB</span>
        </label>
        <span class="err"></span>
      </div>
      <div class="f hp" aria-hidden="true"><label for="ap-phone">Phone</label><input id="ap-phone" name="company_phone" tabindex="-1" autocomplete="off"></div>
      <div class="form-foot">
        <button class="btn btn-blue" type="submit" id="applyBtn"${preview ? ' disabled' : ''}><span class="fb-t">${preview ? 'Preview only' : 'Send application'}</span> ${ARROW}</button>
        <p id="applyNote"></p>
      </div>
      <p class="fine">We store your details and CV to review your application.</p>
    </form>
    <div class="done" id="applyDone" hidden tabindex="-1"><b>Thanks, <span id="applyName"></span>.</b><p>We’ve got your application. We’ll review it and contact you if we’d like to talk.</p></div>
  </div>
</section>`;
}

function jobPage(job, { preview = false } = {}) {
  const open = job.status === 'Open';
  const banner = preview ? `<p class="preview-bar">Preview. This page ${job.status === 'Open' ? 'is live' : `is ${esc(job.status.toLowerCase())}, so the public can’t apply`}.</p>` : '';
  const body = `${banner}
<article>
  <header class="job-hero">
    <div class="wrap wrap-job">
      <a class="back" href="/careers">All roles</a>
      <h1>${esc(job.title)}</h1>
      <div class="job-meta">${meta(job).map((m) => `<span>${esc(m)}</span>`).join('')}</div>
      ${open || preview ? `<a class="btn btn-blue" href="#apply">Apply ${ARROW}</a>` : ''}
    </div>
  </header>
  <div class="wrap wrap-job job-body">
    <div class="job-intro">${paragraphs(job.intro)}</div>
    ${bullets('What you’ll do', job.responsibilities)}
    ${bullets('What you need', job.requirements)}
    ${bullets('Nice to have', job.nice_to_have)}
  </div>
</article>
${open || preview ? applyForm(job, preview) : `
<section class="apply"><div class="wrap wrap-job">
  <h2>This role is closed.</h2>
  <p class="sub">We’re no longer taking applications. <a class="lnk" href="/careers">See open roles</a></p>
</div></section>`}`;
  const intro = lines(job.intro).join(' ');
  return shell({
    title: `${job.title} · Vector careers`,
    description: intro.length > 155 ? `${intro.slice(0, 152).trim()}...` : intro || `${job.title} at Vector.`,
    url: `/careers/${job.slug}`,
    body,
    noindex: !open || preview,
    head: open && !preview ? jsonLd(job) : '',
    script: open || preview,
  });
}

function messagePage(title, text) {
  return shell({
    title: 'Careers · Vector',
    description: 'Open roles at Vector.',
    url: '/careers',
    noindex: true,
    body: `
<section class="careers-hero">
  <div class="wrap">
    <h1>${esc(title)}</h1>
    <p class="sub">${esc(text)} <a class="lnk" href="/careers">See open roles</a></p>
  </div>
</section>`,
  });
}

module.exports = { listPage, jobPage, messagePage };
