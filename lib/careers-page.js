// HTML for the public careers pages. Everything from the Sheet is escaped here.
//
//   /careers               intro, about Vector, open roles (expand in place)
//   /careers/<slug>        the same page with that role opened (shareable link, job schema)
//   /careers/<slug>/apply  the short application form, the same for every role

const WORDMARK = '<svg class="wm" width="115" height="30" viewBox="10 12.5 144 37.5" aria-hidden="true"><defs><linearGradient id="nwm" x1="12" x2="46" y1="0" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#3B82F6" stop-opacity="0"/><stop offset="1" stop-color="#3B82F6"/></linearGradient></defs><path d="M20.5 26.9L31 43.66L41.5 26.9M49.70 37.10H71.20M68.50 37.10A9.40 9.40 0 1 0 66.09 43.39M93.10 31.06A9.40 9.40 0 1 0 93.10 43.14M103.10 16.6V48.8M96.10 28.10H110.60M133.70 37.10A9.40 9.40 0 1 0 114.90 37.10A9.40 9.40 0 1 0 133.70 37.10ZM141.90 25.4V48.8M141.90 39.10C141.90 29.30 145.40 28.10 151.40 28.10" fill="none" stroke="#F5F5F0" stroke-width="5.4" stroke-miterlimit="10"/><g class="wm-s"><path d="M12 17.5H46" stroke="url(#nwm)" stroke-width="3.4" stroke-linecap="round"/><circle cx="47" cy="17.5" r="4.1" fill="#3B82F6"/></g></svg>';
const ARROW = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const DOWN = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v11M4 9l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const SITE = 'https://meetvector.co';

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
<script>(function(d){d.classList.add('js');if(!matchMedia('(prefers-reduced-motion: reduce)').matches){d.classList.add('cmo');setTimeout(function(){if(!d.classList.contains('cmo-ready'))d.classList.add('cmo-done')},3000);}})(document.documentElement)</script>
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
      <p>B2B performance marketing for software companies.</p>
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

function roleItem(job, open, preview) {
  const id = `role-${esc(job.slug)}`;
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
              <div class="jd-cta"><a class="btn btn-blue" href="${applyHref}">Apply now ${ARROW}</a></div>
            </div>
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
  <canvas class="c-amb" id="amb" aria-hidden="true"></canvas>
  <div class="wrap">
    <p class="label" data-rv>Careers</p>
    <h1 data-rv>Work at Vector.</h1>
    <p class="sub" data-rv>A small, senior team in Karachi, running performance marketing for B2B software companies.</p>
    <div class="ctas" data-rv><a class="btn btn-blue" href="#roles">See open roles ${DOWN}</a></div>
  </div>
</section>

<section class="c-sec" id="about">
  <div class="wrap">
    <p class="label" data-rv>About Vector</p>
    <p class="about-text" data-rv>Vector runs paid acquisition, landing pages and attribution for B2B software companies, and measures all of it in pipeline.</p>
    <div class="about-foot" data-rv>
      <p>We keep our client list short on purpose, so every account gets our full attention and our specialists work closely with each client. We’re based in Karachi and work hybrid.</p>
      <a class="lnk" href="/#work">See our work ${ARROW}</a>
    </div>
  </div>
</section>

<section class="c-sec c-roles" id="roles">
  <div class="wrap">
    <div class="c-head c-head-row" data-rv><div><p class="label">Open roles</p><h2>Join the team.</h2></div><p class="c-count">${count === 1 ? '1 open role' : `${count} open roles`}</p></div>
    ${closedTitle ? `<p class="closed-note">${esc(closedTitle)} is no longer open.${count ? ' Here’s what we’re hiring for now.' : ''}</p>` : ''}
    ${count ? `<ul class="roles" data-rv>${jobs.map((j) => roleItem(j, j.slug === openSlug, preview)).join('')}
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

function group(title, inner) {
  return `
        <fieldset class="grp" data-rv>
          <legend class="sr">${title}</legend>
          <div class="grp-h" aria-hidden="true"><b>${title}</b></div>
          <div class="grp-b">${inner}
          </div>
        </fieldset>`;
}

function applyPage(job, { preview = false } = {}) {
  const body = `${preview ? `<p class="preview-bar">Preview. This role is ${esc(String(job.status).toLowerCase())}, so the form won’t send.</p>` : ''}
<section class="ap-hero">
  <canvas class="c-amb" id="amb" aria-hidden="true"></canvas>
  <div class="wrap">
    <a class="back" href="/careers/${esc(job.slug)}${preview ? '?preview=1' : ''}">Back to the role</a>
    <p class="label" data-rv>Apply</p>
    <h1 data-rv>${esc(job.title)}</h1>
    <p class="sub" data-rv>Takes about two minutes. We’ll reach out if we move forward.</p>
  </div>
</section>

<section class="ap-body" id="apply">
  <div class="wrap">
    <form class="apply-form" id="applyForm" novalidate data-job="${esc(job.id)}">${group('About you', `
            <div class="grid">
              <div class="g-wide">${field({ id: 'name', label: 'Full name', auto: 'name', max: 120, placeholder: 'As on your CNIC or passport' })}</div>
              ${field({ id: 'dob', label: 'Date of birth', type: 'date', auto: 'bday', extra: ' min="1940-01-01"' })}
              ${field({ id: 'city', label: 'Current city', auto: 'address-level2', placeholder: 'Karachi', max: 80 })}
            </div>`)}${group('Contact', `
            <div class="grid">
              ${field({ id: 'email', label: 'Email', type: 'email', auto: 'email', placeholder: 'you@example.com' })}
              ${field({ id: 'phone', label: 'Phone number', type: 'tel', auto: 'tel', placeholder: '+92 300 1234567', max: 30 })}
              <div class="g-wide">${field({ id: 'linkedin', label: 'LinkedIn profile', type: 'url', placeholder: 'linkedin.com/in/your-name', optional: true, max: 300 })}</div>
            </div>`)}${group('Availability', `
            <div class="grid">
              ${field({ id: 'notice', label: 'Notice period', max: 40 })}
              ${field({ id: 'salary', label: 'Expected monthly salary (PKR)', optional: true, max: 20, extra: ' inputmode="numeric"' })}
            </div>`)}${group('CV', `
            <div class="f" data-field="cv">
              <span class="sr" id="cvLabel">CV</span>
              <label class="drop" id="cvDrop">
                <input type="file" id="ap-cv" accept=".pdf,.doc,.docx" aria-labelledby="cvLabel">
                <span class="drop-ic" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></span>
                <span class="drop-txt"><span class="drop-t" id="cvText">Upload your CV</span><span class="drop-h">Drag it here or click to choose. PDF or Word, up to 3 MB.</span></span>
              </label>
              <span class="err"></span>
            </div>`)}
        <div class="f hp" aria-hidden="true"><label for="ap-hp">Company phone</label><input id="ap-hp" name="company_phone" tabindex="-1" autocomplete="off"></div>
        <div class="grp grp-end" data-rv>
          <div class="grp-h"></div>
          <div class="grp-b">
            <div class="form-foot">
              <button class="btn btn-blue" type="submit" id="applyBtn"${preview ? ' disabled' : ''}><span class="fb-t">${preview ? 'Preview only' : 'Send application'}</span> ${ARROW}</button>
              <p id="applyNote" aria-live="polite"></p>
            </div>
          </div>
        </div>
    </form>
    <div class="done" id="applyDone" hidden tabindex="-1">
      <p class="label">Application sent</p>
      <b>Thanks, <span id="applyName"></span>.</b>
      <p>We’ve got your application for ${esc(job.title)}. We’ll reach out by phone or email if we move forward.</p>
      <a class="lnk" href="/careers">Back to careers ${ARROW}</a>
    </div>
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

module.exports = { listPage, applyPage, messagePage };
