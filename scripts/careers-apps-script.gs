/**
 * Vector careers — Google Apps Script
 *
 * Stores job listings and applications in the Sheet this script is bound to,
 * saves CVs to a Google Drive folder and emails a notification. The website
 * talks to it through /api/careers, /api/apply and /api/admin.
 * Setup is in README.md → "Careers".
 *
 * Fill in SECRET below before deploying. This is a separate script from the
 * lead-capture one, so applicant data stays out of the sales leads Sheet.
 */

const SECRET = 'PASTE_THE_SHARED_SECRET_HERE'; // same value as CAREERS_WEBHOOK_SECRET on Vercel
const NOTIFY_EMAIL = 'shahmeer@thecatalystact.com'; // comma-separate for more than one
const JOBS_SHEET = 'Jobs';
const CV_FOLDER = 'Vector job applications';
const STATUSES = ['New', 'Reviewing', 'Interview', 'Rejected', 'Hired'];

const JOB_COLUMNS = [
  'id', 'slug', 'title', 'status', 'location', 'work_type', 'employment_type',
  'salary', 'intro', 'responsibilities', 'requirements', 'nice_to_have',
  'apply_tab', 'created_at', 'updated_at', 'published_at',
];

const TAB_COLUMNS = ['Received (UTC)', 'Name', 'Email', 'WhatsApp', 'CV', 'Source', 'Landing page', 'Referrer', 'IP country', 'Status', 'Notes'];

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!body || body.secret !== SECRET) return respond_({ ok: false, error: 'unauthorized' });
    if (body.action === 'jobs') return respond_({ ok: true, jobs: readJobs_(), sheet_url: SpreadsheetApp.getActiveSpreadsheet().getUrl() });
    if (body.action === 'saveJob') return respond_(saveJob_(body.job || {}));
    if (body.action === 'deleteJob') return respond_(deleteJob_(body.id));
    if (body.action === 'apply') return respond_(apply_(body));
    return respond_({ ok: false, error: 'unknown action' });
  } catch (err) {
    console.error('doPost failed: ' + err);
    return respond_({ ok: false, error: String(err) });
  }
}

// Visiting the web-app URL in a browser confirms it's deployed.
function doGet() {
  return respond_({ ok: true, service: 'vector-careers' });
}

/* Jobs ------------------------------------------------------------------ */

function jobsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(JOBS_SHEET);
  if (!sheet) sheet = ss.insertSheet(JOBS_SHEET, 0);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(JOB_COLUMNS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, JOB_COLUMNS.length).setFontWeight('bold');
  }
  return sheet;
}

function readJobs_() {
  const sheet = jobsSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const ss = sheet.getParent();
  return sheet.getRange(2, 1, last - 1, JOB_COLUMNS.length).getValues().map((row, i) => {
    const job = {};
    JOB_COLUMNS.forEach((key, c) => { job[key] = row[c] == null ? '' : String(row[c]); });
    const tab = job.apply_tab && ss.getSheetByName(job.apply_tab);
    job.applications = tab ? Math.max(tab.getLastRow() - 1, 0) : 0;
    job._row = i + 2;
    return job;
  });
}

function writeJob_(sheet, row, job) {
  const values = JOB_COLUMNS.map((key) => text_(job[key]));
  sheet.getRange(row, 1, 1, JOB_COLUMNS.length).setValues([values]);
}

function slugify_(title) {
  return String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'role';
}

function uniqueSlug_(title, jobs, id) {
  const base = slugify_(title);
  const taken = jobs.filter((j) => j.id !== id).map((j) => j.slug);
  let slug = base;
  for (let n = 2; taken.indexOf(slug) !== -1; n++) slug = base + '-' + n;
  return slug;
}

function saveJob_(input) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = jobsSheet_();
    const jobs = readJobs_();
    const existing = input.id ? jobs.find((j) => j.id === input.id) : null;
    if (input.id && !existing) return { ok: false, error: 'not found' };

    const now = new Date().toISOString();
    const job = Object.assign({}, existing || {}, input);
    job.id = existing ? existing.id : Utilities.getUuid();
    job.created_at = existing ? existing.created_at : now;
    job.apply_tab = existing ? existing.apply_tab : '';
    job.updated_at = now;
    job.published_at = (existing && existing.published_at) || (job.status === 'Open' ? now : '');
    // The link stays fixed once a job has been published, so shared links keep working.
    job.slug = existing && existing.published_at ? existing.slug : uniqueSlug_(job.title, jobs, job.id);

    writeJob_(sheet, existing ? existing._row : sheet.getLastRow() + 1, job);
    job.applications = existing ? existing.applications : 0;
    delete job._row;
    return { ok: true, job: job };
  } finally {
    lock.releaseLock();
  }
}

function deleteJob_(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const job = readJobs_().find((j) => j.id === id);
    if (!job) return { ok: false, error: 'not found' };
    if (job.applications > 0) return { ok: false, error: 'has applications' };
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tab = job.apply_tab && ss.getSheetByName(job.apply_tab);
    if (tab) ss.deleteSheet(tab);
    jobsSheet_().deleteRow(job._row);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* Applications ---------------------------------------------------------- */

function apply_(body) {
  const a = body.application || {};
  const cache = CacheService.getScriptCache();
  const dedupeKey = a.submission_id ? 'sub_' + String(a.submission_id).slice(0, 80) : '';
  if (dedupeKey && cache.get(dedupeKey)) return { ok: true, duplicate: true };

  const job = readJobs_().find((j) => j.id === body.job_id);
  if (!job) return { ok: false, error: 'not found' };
  if (job.status !== 'Open') return { ok: false, error: 'closed' };

  // Upload before taking the lock so a slow file doesn't hold up other applicants.
  const cvUrl = saveCv_(job, a, body.cv);

  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  let tab, previous, sheetUrl;
  try {
    tab = applicationsTab_(readJobs_().find((j) => j.id === job.id));
    previous = countEmail_(tab, a.email);
    const values = {
      'Received (UTC)': new Date().toISOString(),
      'Name': text_(a.name),
      'Email': text_(a.email),
      'WhatsApp': text_(a.whatsapp),
      'CV': '=HYPERLINK("' + cvUrl + '","Open CV")',
      'Source': text_(a.source),
      'Landing page': text_(a.landing),
      'Referrer': text_(a.referrer),
      'IP country': text_(a.country),
      'Status': 'New',
      'Notes': previous ? 'Applied before (' + previous + 'x)' : '',
    };
    tab.appendRow(TAB_COLUMNS.map((label) => values[label]));
    sheetUrl = tab.getParent().getUrl() + '#gid=' + tab.getSheetId();
  } finally {
    lock.releaseLock();
  }

  if (dedupeKey) cache.put(dedupeKey, '1', 21600);
  try {
    sendEmail_(job, a, cvUrl, previous, sheetUrl);
  } catch (err) {
    // The row is saved; email failure should not fail the application.
    console.error('email failed: ' + err);
  }
  return { ok: true };
}

function applicationsTab_(job) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let tab = job.apply_tab ? ss.getSheetByName(job.apply_tab) : null;
  if (!tab) {
    const base = ('Applications - ' + job.title).replace(/[\[\]*?:\/\\]/g, ' ').slice(0, 90);
    let name = base;
    for (let n = 2; ss.getSheetByName(name); n++) name = base + ' ' + n;
    tab = ss.insertSheet(name);
    tab.appendRow(TAB_COLUMNS);
    tab.setFrozenRows(1);
    tab.getRange(1, 1, 1, TAB_COLUMNS.length).setFontWeight('bold');
    const statusCol = TAB_COLUMNS.indexOf('Status') + 1;
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).build();
    tab.getRange(2, statusCol, tab.getMaxRows() - 1, 1).setDataValidation(rule);
    job.apply_tab = name;
    writeJob_(jobsSheet_(), job._row, job);
  }
  return tab;
}

function countEmail_(tab, email) {
  const last = tab.getLastRow();
  if (last < 2) return 0;
  const col = TAB_COLUMNS.indexOf('Email') + 1;
  const target = String(email).toLowerCase();
  return tab.getRange(2, col, last - 1, 1).getValues().filter(([v]) => String(v).toLowerCase() === target).length;
}

function childFolder_(parent, name) {
  const found = parent.getFoldersByName(name);
  return found.hasNext() ? found.next() : parent.createFolder(name);
}

function saveCv_(job, a, cv) {
  if (!cv || !cv.base64) throw new Error('missing CV');
  const root = childFolder_(DriveApp.getRootFolder(), CV_FOLDER);
  const folder = childFolder_(root, String(job.title).replace(/[\\/]/g, ' ').slice(0, 100));
  const safeName = String(a.name).replace(/[^\p{L}\p{N} .'-]/gu, '').trim().slice(0, 80) || 'Applicant';
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = Utilities.newBlob(Utilities.base64Decode(cv.base64), cv.mime, safeName + ' - ' + stamp + '.' + cv.ext);
  return folder.createFile(blob).getUrl();
}

function sendEmail_(job, a, cvUrl, previous, sheetUrl) {
  const lines = [
    a.name + ' applied for ' + job.title + '.',
    '',
    'Email:     ' + a.email,
    'WhatsApp:  ' + a.whatsapp,
    'Source:    ' + (a.source || 'Direct'),
    '',
  ];
  if (previous) lines.push('Note: applied before (' + previous + 'x)', '');
  lines.push('CV:    ' + cvUrl, 'Sheet: ' + sheetUrl);

  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    replyTo: a.email,
    subject: 'New application: ' + a.name + ' — ' + job.title,
    body: lines.join('\n'),
    name: 'Vector careers',
  });
}

/* Helpers --------------------------------------------------------------- */

// The leading apostrophe makes Sheets store the value as plain text. It keeps
// numbers like 0300 1234567 intact and stops applicant input running as a formula.
function text_(v) {
  if (v == null || v === '') return '';
  return "'" + String(v);
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Run this once from the editor to grant permissions and check the setup.
// It creates the Jobs tab, the Drive folder and the first draft listing.
function testSetup() {
  const sheet = jobsSheet_();
  childFolder_(DriveApp.getRootFolder(), CV_FOLDER);
  if (readJobs_().length === 0) saveJob_(firstJob_());
  MailApp.sendEmail({ to: NOTIFY_EMAIL, subject: 'Vector careers: setup OK', body: 'Listings and applications will be stored in: ' + sheet.getParent().getUrl() });
}

function firstJob_() {
  return {
    title: 'B2B Performance Marketing Specialist',
    status: 'Draft',
    location: '',
    work_type: '',
    employment_type: '',
    salary: '',
    intro: 'Vector runs paid acquisition, landing pages and attribution for B2B companies.\nWe keep our client list short so our specialists can work closely with each account. You’ll manage campaigns day to day and take on more ownership as you grow.',
    responsibilities: 'Launch and manage campaigns on Meta, Google Ads, LinkedIn, Microsoft Ads and more\nTest ad creative and recommend budget changes every week\nHelp improve landing pages, offers and demo flows\nSet up and check conversion tracking',
    requirements: '2+ years running paid campaigns\nA working understanding of conversion tracking\nClear written and spoken English\nClient management skills',
    nice_to_have: 'Experience with long sales cycles and multiple decision-makers\nHubSpot or Salesforce experience\nExperience running campaigns for the US or Canada',
  };
}
