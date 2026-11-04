// HTML for the public careers pages. Everything from the Sheet is escaped here.
//
//   /careers               intro, why Vector, how hiring works, open roles (expand in place)
//   /careers/<slug>        the same page with that role opened (shareable link, job schema)
//   /careers/<slug>/apply  the short application form, the same for every role

const WORDMARK = '<svg class="wm" width="115" height="30" viewBox="10 12.5 144 37.5" aria-hidden="true"><defs><linearGradient id="nwm" x1="12" x2="46" y1="0" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#3B82F6" stop-opacity="0"/><stop offset="1" stop-color="#3B82F6"/></linearGradient></defs><path d="M20.5 26.9L31 43.66L41.5 26.9M49.70 37.10H71.20M68.50 37.10A9.40 9.40 0 1 0 66.09 43.39M93.10 31.06A9.40 9.40 0 1 0 93.10 43.14M103.10 16.6V48.8M96.10 28.10H110.60M133.70 37.10A9.40 9.40 0 1 0 114.90 37.10A9.40 9.40 0 1 0 133.70 37.10ZM141.90 25.4V48.8M141.90 39.10C141.90 29.30 145.40 28.10 151.40 28.10" fill="none" stroke="#F5F5F0" stroke-width="5.4" stroke-miterlimit="10"/><g class="wm-s"><path d="M12 17.5H46" stroke="url(#nwm)" stroke-width="3.4" stroke-linecap="round"/><circle cx="47" cy="17.5" r="4.1" fill="#3B82F6"/></g></svg>';
const ARROW = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const DOWN = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v11M4 9l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const SITE = 'https://meetvector.co';

const NOTICE = ['Can start now', '2 weeks', '1 month', '2 months', '3 months or more'];

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const lines = (text) => String(text || '').split(/\r?\n/).map((l) => l.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean);
const paragraphs = (text) => lines(text).map((l) => `<p>${esc(l)}</p>`).join('');
const bullets = (title, text) => {
  const items = lines(text);
  if (!items.length) return '';
  return `<section class="jd-sec"><h4>${esc(title)}</h4><ul>${items.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></section>`;
};
const meta = (job) => [job.location, job.work_type, job.employment_type, job.salary].filter(Boolean);
const metaRow = (job, n = 4) => `<span class="job-meta">${meta(job).slice(0, n).map((m) => `<span>${esc(m)}</span>`).join('')}</span>`;
const shortIntro = (job) => {
  const intro = lines(job.intro).join(' ');
  return intro.length > 155 ? `${intro.slice(0, 152).trim()}...` : intro || `${job.title} at Vector.`;
};

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
<script>document.documentElement.classList.add('js')</script>
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

/* ---------- /careers ---------- */

// Streams from each discipline converge on one point: pipeline (the brand motif).
function heroVisual() {
  const ys = [44, 108, 172, 236, 300, 364];
  const names = ['Paid search', 'LinkedIn', 'Landing pages', 'Creative', 'Tracking', 'CRM'];
  const paths = ys.map((y) => `M96 ${y} C 250 ${y}, 300 204, 438 204`);
  return `<div class="hero-vis" aria-hidden="true">
  <svg viewBox="0 0 520 408" width="520" height="408">
    <defs><radialGradient id="hvg"><stop offset="0" stop-color="#3B82F6" stop-opacity=".45"/><stop offset="1" stop-color="#3B82F6" stop-opacity="0"/></radialGradient></defs>
    ${paths.map((d) => `<path class="hv-line" d="${d}" pathLength="100"/>`).join('')}
    ${paths.map((d, i) => `<path class="hv-flow" d="${d}" pathLength="100" style="animation-delay:${(-i * 0.73).toFixed(2)}s"/>`).join('')}
    ${ys.map((y, i) => `<circle class="hv-dot" cx="96" cy="${y}" r="3"/><text class="hv-t" x="84" y="${y + 4}" text-anchor="end">${names[i]}</text>`).join('')}
    <circle class="hv-glow" cx="438" cy="204" r="64" fill="url(#hvg)"/>
    <circle class="hv-ring" cx="438" cy="204" r="14"/>
    <circle cx="438" cy="204" r="7" fill="#3B82F6"/>
    <text class="hv-t hv-end" x="438" y="248" text-anchor="middle">Pipeline</text>
  </svg>
</div>`;
}

const WHY = [
  ['You own real accounts', 'We keep our client list short, so you work closely with each account and see your decisions play out, from the first ad to the sales call.'],
  ['Measured in pipeline', 'We judge our work by qualified leads and pipeline, not clicks. You’ll learn how B2B software is actually bought.'],
  ['International clients', 'Run campaigns for software companies selling into the US and Canada, across Google, LinkedIn, Meta and more.'],
  ['Hybrid, in Karachi', 'Office days for working through problems together, and home days for focused work.'],
];

const STEPS = [
  ['Apply', 'Pick a role and send your basic details and CV. It takes about two minutes.'],
  ['We review', 'We read every application and get back to you if your experience fits the role.'],
  ['Interviews', 'A call to get to know you, then a conversation with the team about real campaigns.'],
  ['Offer', 'If it’s a match, we send an offer and agree a start date that works for you.'],
];

function roleItem(job, open, preview) {
  const id = `role-${esc(job.slug)}`;
  const facts = [['Location', job.location], ['Work setup', job.work_type], ['Type', job.employment_type], ['Salary', job.salary]].filter(([, v]) => v);
  const applyHref = `/careers/${esc(job.slug)}/apply${preview ? '?preview=1' : ''}`;
  return `
      <li class="role${open ? ' open' : ''}" data-slug="${esc(job.slug)}" id="${id}">
        <h3 class="role-h"><button class="role-btn" type="button" aria-expanded="${open}" aria-controls="${id}-jd">
          <span class="role-t">${esc(job.title)}${job.status === 'Draft' ? ' <em class="draft">Draft</em>' : ''}</span>
          ${metaRow(job, 3)}
          <span class="role-tog"><span class="role-tog-t">${open ? 'Close' : 'View role'}</span><i aria-hidden="true"></i></span>
        </button></h3>
        <div class="role-jd" id="${id}-jd" role="region" aria-label="${esc(job.title)}">
          <div class="role-jd-in">
            <div class="jd">
              <div class="jd-intro">${paragraphs(job.intro)}</div>
              ${bullets('What you’ll do', job.responsibilities)}
              ${bullets('What you need', job.requirements)}
              ${bullets('Nice to have', job.nice_to_have)}
            </div>
            <aside class="jd-side">
              <dl>${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
              <a class="btn btn-blue" href="${applyHref}">Apply now ${ARROW}</a>
              <p class="jd-hint">About two minutes. Your basic details and CV.</p>
              <button class="copy-link" type="button" data-url="${esc(SITE)}/careers/${esc(job.slug)}">Copy link to this role</button>
            </aside>
          </div>
        </div>
      </li>`;
}

// jobs: the roles to list. openSlug: the role to show expanded. closedTitle: a
// role someone followed a link to that has since closed.
function listPage(jobs, { openSlug = '', closedTitle = '', preview = false, job = null } = {}) {
  const count = jobs.length;
  const body = `${preview ? '<p class="preview-bar">Preview. Drafts are only visible to you.</p>' : ''}
<section class="c-hero">
  <div class="wrap c-hero-in">
    <div class="c-hero-txt">
      <p class="label">Careers</p>
      <h1>Work at Vector.</h1>
      <p class="sub">We’re a small, senior team that runs paid acquisition, landing pages and attribution for B2B software companies in the US and Canada. We’re based in Karachi and work hybrid.</p>
      <ul class="c-facts"><li>Karachi, Pakistan</li><li>Hybrid</li><li>US &amp; Canada clients</li></ul>
      <div class="ctas"><a class="btn btn-blue" href="#roles">See open roles ${DOWN}</a><a class="lnk" href="#hiring">How hiring works ${ARROW}</a></div>
    </div>
    ${heroVisual()}
  </div>
</section>

<section class="c-sec" id="why">
  <div class="wrap">
    <div class="c-head"><p class="label">Why Vector</p><h2>Small team. Real accounts. Work you can measure.</h2></div>
    <div class="why">${WHY.map(([t, p], i) => `
      <div class="why-c"><span class="why-n">0${i + 1}</span><h3>${t}</h3><p>${p}</p></div>`).join('')}
    </div>
  </div>
</section>

<section class="c-sec" id="hiring">
  <div class="wrap">
    <div class="c-head"><p class="label">How hiring works</p><h2>A short, clear process.</h2></div>
    <ol class="steps">${STEPS.map(([t, p], i) => `
      <li><span class="step-n">${i + 1}</span><h3>${t}</h3><p>${p}</p></li>`).join('')}
    </ol>
  </div>
</section>

<section class="c-sec c-roles" id="roles">
  <div class="wrap">
    <div class="c-head c-head-row"><div><p class="label">Open roles</p><h2>Join the team.</h2></div><p class="c-count">${count === 1 ? '1 open role' : `${count} open roles`}</p></div>
    ${closedTitle ? `<p class="closed-note">${esc(closedTitle)} is no longer open.${count ? ' Here’s what we’re hiring for now.' : ''}</p>` : ''}
    ${count ? `<ul class="roles">${jobs.map((j) => roleItem(j, j.slug === openSlug, preview)).join('')}
    </ul>` : '<p class="empty">No open roles right now. Check back soon.</p>'}
  </div>
</section>`;

  if (job) {
    return shell({
      title: `${job.title} · Vector careers`,
      description: shortIntro(job),
      url: `/careers/${job.slug}`,
      body,
      noindex: preview || job.status !== 'Open',
      head: job.status === 'Open' && !preview ? jsonLd(job) : '',
      script: true,
    });
  }
  return shell({
    title: 'Careers · Vector',
    description: 'Join Vector, a B2B performance marketing team based in Karachi, working hybrid. See open roles.',
    url: '/careers',
    body,
    noindex: !!closedTitle,
    script: true,
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

/* ---------- /careers/<slug>/apply ---------- */

const field = ({ id, label, type = 'text', auto = '', placeholder = '', max = 200, optional = false, hint = '', extra = '' }) => `
          <div class="f" data-field="${id}">
            <label for="ap-${id}">${esc(label)}${optional ? ' <span class="opt">Optional</span>' : ''}</label>
            <input id="ap-${id}" name="${id}" type="${type}" maxlength="${max}"${auto ? ` autocomplete="${auto}"` : ''}${placeholder ? ` placeholder="${esc(placeholder)}"` : ''}${extra}>
            ${hint ? `<span class="hint">${esc(hint)}</span>` : ''}
            <span class="err"></span>
          </div>`;

function applyPage(job, { preview = false } = {}) {
  const body = `${preview ? `<p class="preview-bar">Preview. This role is ${esc(String(job.status).toLowerCase())}, so the form won’t send.</p>` : ''}
<section class="ap">
  <div class="wrap ap-in">
    <div class="ap-main">
      <a class="back" href="/careers/${esc(job.slug)}${preview ? '?preview=1' : ''}">Back to the role</a>
      <p class="ap-kicker">Apply for</p>
      <h1>${esc(job.title)}</h1>
      ${metaRow(job)}
      <p class="sub">Takes about two minutes. We only need your basic details and CV here. We’ll talk about the role itself if we move forward.</p>

      <form class="apply-form" id="applyForm" novalidate data-job="${esc(job.id)}">
        <fieldset class="fs">
          <legend><span>01</span>About you</legend>
          <div class="grid">
            <div class="g-wide">${field({ id: 'name', label: 'Full name', auto: 'name', max: 120, placeholder: 'As on your CNIC or passport' })}</div>
            ${field({ id: 'dob', label: 'Date of birth', type: 'date', auto: 'bday', extra: ' min="1940-01-01"' })}
            ${field({ id: 'city', label: 'Current city', auto: 'address-level2', placeholder: 'Karachi', max: 80 })}
          </div>
        </fieldset>
        <fieldset class="fs">
          <legend><span>02</span>Contact</legend>
          <div class="grid">
            ${field({ id: 'email', label: 'Email', type: 'email', auto: 'email', placeholder: 'you@example.com' })}
            ${field({ id: 'whatsapp', label: 'WhatsApp number', type: 'tel', auto: 'tel', placeholder: '+92 300 1234567', max: 30 })}
            <div class="g-wide">${field({ id: 'linkedin', label: 'LinkedIn profile', type: 'url', placeholder: 'linkedin.com/in/your-name', optional: true, max: 300 })}</div>
          </div>
        </fieldset>
        <fieldset class="fs">
          <legend><span>03</span>Availability</legend>
          <div class="grid">
            <div class="f" data-field="notice">
              <label for="ap-notice">Notice period</label>
              <div class="sel"><select id="ap-notice" name="notice"><option value="">Choose one</option>${NOTICE.map((n) => `<option>${n}</option>`).join('')}</select></div>
              <span class="err"></span>
            </div>
            ${field({ id: 'salary', label: 'Expected monthly salary (PKR)', placeholder: '150,000', optional: true, max: 20, extra: ' inputmode="numeric"' })}
          </div>
        </fieldset>
        <fieldset class="fs">
          <legend><span>04</span>CV</legend>
          <div class="f" data-field="cv">
            <span class="f-label sr" id="cvLabel">CV</span>
            <label class="drop" id="cvDrop">
              <input type="file" id="ap-cv" accept=".pdf,.doc,.docx" aria-labelledby="cvLabel">
              <span class="drop-ic" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></span>
              <span class="drop-t" id="cvText">Upload your CV</span>
              <span class="drop-h">Drag it here or click to choose. PDF or Word, up to 3 MB.</span>
            </label>
            <span class="err"></span>
          </div>
        </fieldset>
        <div class="f hp" aria-hidden="true"><label for="ap-phone">Phone</label><input id="ap-phone" name="company_phone" tabindex="-1" autocomplete="off"></div>
        <div class="form-foot">
          <button class="btn btn-blue" type="submit" id="applyBtn"${preview ? ' disabled' : ''}><span class="fb-t">${preview ? 'Preview only' : 'Send application'}</span> ${ARROW}</button>
          <p id="applyNote" aria-live="polite"></p>
        </div>
        <p class="fine">We store your details and CV only to review your application.</p>
      </form>
      <div class="done" id="applyDone" hidden tabindex="-1">
        <span class="done-ic" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2"/></svg></span>
        <b>Thanks, <span id="applyName"></span>.</b>
        <p>We’ve got your application for ${esc(job.title)}. We’ll review it and contact you on WhatsApp or email if we’d like to talk.</p>
        <a class="lnk" href="/careers">Back to careers ${ARROW}</a>
      </div>
    </div>
    <aside class="ap-side">
      <div class="ap-card">
        <p class="ap-card-k">What happens next</p>
        <ol>
          <li><b>We review</b><span>We read every application ourselves.</span></li>
          <li><b>We reach out</b><span>If your experience fits, we’ll message you on WhatsApp or email.</span></li>
          <li><b>First call</b><span>A short call to get to know you and talk about the role.</span></li>
        </ol>
      </div>
    </aside>
  </div>
</section>`;
  return shell({
    title: `Apply: ${job.title} · Vector careers`,
    description: `Apply for ${job.title} at Vector.`,
    url: `/careers/${job.slug}/apply`,
    body,
    noindex: true,
    script: true,
  });
}

function messagePage(title, text) {
  return shell({
    title: 'Careers · Vector',
    description: 'Open roles at Vector.',
    url: '/careers',
    noindex: true,
    body: `
<section class="c-hero c-msg">
  <div class="wrap">
    <h1>${esc(title)}</h1>
    <p class="sub">${esc(text)} <a class="lnk" href="/careers">See open roles</a></p>
  </div>
</section>`,
  });
}

module.exports = { listPage, applyPage, messagePage, NOTICE };
