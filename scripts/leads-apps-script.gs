/**
 * Vector lead capture — Google Apps Script
 *
 * Receives leads from /api/lead on the site, appends a row to the Sheet this
 * script is bound to, and emails a notification. Setup is in README.md →
 * "Lead capture".
 *
 * Fill in the two settings below before deploying.
 */

const SECRET = 'PASTE_THE_SHARED_SECRET_HERE'; // same value as LEADS_WEBHOOK_SECRET on Vercel
const NOTIFY_EMAIL = 'shahmeer@thecatalystact.com'; // comma-separate for more than one
const SHEET_NAME = 'Leads';

const COLUMNS = [
  ['ts', 'Received (UTC)'],
  ['name', 'Name'],
  ['email', 'Email'],
  ['website', 'Website'],
  ['domain', 'Domain'],
  ['free_email', 'Free email?'],
  ['email_matches_site', 'Email matches site?'],
  ['cta', 'CTA clicked'],
  ['cta_page', 'CTA page'],
  ['page', 'Form page'],
  ['landing', 'Landing page'],
  ['referrer', 'Referrer'],
  ['utm_source', 'utm_source'],
  ['utm_medium', 'utm_medium'],
  ['utm_campaign', 'utm_campaign'],
  ['utm_content', 'utm_content'],
  ['utm_term', 'utm_term'],
  ['gclid', 'gclid'],
  ['li_fat_id', 'li_fat_id'],
  ['country', 'Country'],
  ['region', 'Region'],
  ['city', 'City'],
  ['timezone', 'Timezone'],
  ['ip', 'IP'],
  ['user_agent', 'User agent'],
  ['_status', 'Status'],
  ['_notes', 'Notes'],
];

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!body || body.secret !== SECRET) return respond_({ ok: false, error: 'unauthorized' });
    const lead = body.lead || {};
    if (!lead.email) return respond_({ ok: false, error: 'no email' });

    const sheet = getSheet_();
    const seenBefore = countPrevious_(sheet, lead.email);
    const row = COLUMNS.map(([key]) => {
      if (key === '_status') return 'New';
      if (key === '_notes') return seenBefore ? 'Submitted before (' + seenBefore + 'x)' : '';
      const v = lead[key];
      if (typeof v === 'boolean') return v ? 'yes' : 'no';
      return v == null ? '' : String(v);
    });
    sheet.appendRow(row);

    try {
      sendEmail_(lead, seenBefore, sheet);
    } catch (err) {
      // The row is saved; email failure should not fail the request.
      console.error('email failed: ' + err);
    }

    return respond_({ ok: true, seen_before: seenBefore > 0 });
  } catch (err) {
    console.error('doPost failed: ' + err);
    return respond_({ ok: false, error: String(err) });
  }
}

// Visiting the web-app URL in a browser confirms it's deployed.
function doGet() {
  return respond_({ ok: true, service: 'vector-leads' });
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS.map(([, label]) => label));
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, COLUMNS.length).setFontWeight('bold');
  }
  return sheet;
}

function countPrevious_(sheet, email) {
  const last = sheet.getLastRow();
  if (last < 2) return 0;
  const col = COLUMNS.findIndex(([k]) => k === 'email') + 1;
  const values = sheet.getRange(2, col, last - 1, 1).getValues();
  const target = String(email).toLowerCase();
  return values.filter(([v]) => String(v).toLowerCase() === target).length;
}

function sendEmail_(lead, seenBefore, sheet) {
  const sheetUrl = sheet.getParent().getUrl() + '#gid=' + sheet.getSheetId();
  const where = [lead.city, lead.region, lead.country].filter(Boolean).join(', ');
  const source = [lead.utm_source, lead.utm_medium, lead.utm_campaign].filter(Boolean).join(' / ') || (lead.referrer ? 'Referrer: ' + lead.referrer : 'Direct');
  const flags = [];
  if (lead.free_email) flags.push('free email address');
  if (lead.email_matches_site === false && !lead.free_email) flags.push('email domain differs from website');
  if (seenBefore) flags.push('submitted before (' + seenBefore + 'x)');

  const subject = 'New lead: ' + lead.name + ' — ' + (lead.domain || lead.website);
  const lines = [
    lead.name + ' asked for a call.',
    '',
    'Email:     ' + lead.email,
    'Website:   ' + (lead.website || ''),
    'Location:  ' + (where || 'unknown') + (lead.timezone ? ' (' + lead.timezone + ')' : ''),
    'Source:    ' + source,
    'CTA:       ' + (lead.cta || 'form') + (lead.cta_page ? ' on ' + lead.cta_page : ''),
    'Landing:   ' + (lead.landing || ''),
    flags.length ? '' : null,
    flags.length ? 'Flags:     ' + flags.join('; ') : null,
    '',
    'Reply: ' + lead.email,
    'Sheet: ' + sheetUrl,
  ].filter((l) => l !== null);

  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    replyTo: lead.email,
    subject: subject,
    body: lines.join('\n'),
    name: 'Vector leads',
  });
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Run this once from the editor to grant permissions and check the setup.
function testSetup() {
  const sheet = getSheet_();
  MailApp.sendEmail({ to: NOTIFY_EMAIL, subject: 'Vector leads: setup OK', body: 'Rows will be written to: ' + sheet.getParent().getUrl() });
}
