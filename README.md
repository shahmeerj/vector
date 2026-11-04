# Vector — landing page

Static site for meetvector.co (Vector).

- `index.html` — landing page
- `tamba.html`, `personology.html`, `routines.html` — case studies
- `assets/` — shared CSS, JS and favicon
- `admin.html` — job listings admin (`/admin`)
- `api/lead.js` — serverless endpoint behind the "Request a call" form
- `api/careers.js`, `api/apply.js`, `api/admin.js`, `lib/` — careers pages, applications and admin
- `scripts/` — the Google Apps Scripts for leads and careers, and the case-study embed script

No build step. Deployed on Vercel; every push to `main` redeploys.

## Case-study overlays

The landing page opens each case study as an in-page overlay, using a copy of
its HTML embedded in `index.html`. After editing any case-study file (or
`assets/vector.css`, `assets/vector.js`, `assets/leads.js`), refresh those
copies:

```
python3 scripts/embed-cases.py
```

## Lead capture

Every "Book a call" link on the site goes to the form at `#call`. Submitting it
calls `POST /api/lead`, which validates the fields, drops bot submissions
(honeypot), adds context (CTA clicked, page, referrer, first-touch UTMs,
country/city, timezone) and forwards the lead to a Google Apps Script. The
script appends a row to a Google Sheet and emails a notification.

If delivery fails, the visitor is asked to try again and the full lead is
written to the Vercel function logs (`lead: delivery failed …`) so it can be
recovered.

### One-time setup

1. **Sheet.** Create a Google Sheet (any name). Open **Extensions → Apps Script**,
   replace the default code with `scripts/leads-apps-script.gs`, and set the two
   constants at the top: `SECRET` (any long random string) and `NOTIFY_EMAIL`.
2. **Permissions.** In the Apps Script editor, run the `testSetup` function once
   and approve the permissions. You should get a "setup OK" email and a `Leads`
   tab with headers.
3. **Deploy.** **Deploy → New deployment → Web app.** Execute as **Me**; who has
   access: **Anyone**. Copy the web-app URL (ends in `/exec`). Opening it in a
   browser should show `{"ok":true,"service":"vector-leads"}`.
4. **Vercel.** In the `vector` project, **Settings → Environment Variables**, add
   for Production (and Preview if you test there):
   - `LEADS_WEBHOOK_URL` — the `/exec` URL
   - `LEADS_WEBHOOK_SECRET` — the same value as `SECRET` in the script

   Redeploy once so the function picks them up.
5. **Test.** Submit the live form. A row should appear in the sheet and an
   email should arrive within a few seconds.

### Changing the script later

Edit the code in Apps Script, then **Deploy → Manage deployments → Edit →
Version: New version → Deploy**. The URL stays the same. (Saving the code
without a new deployment does not change the live web app.)

### Where the attribution comes from

`assets/leads.js` runs on every page. On a visitor's first visit it stores the
landing URL, referrer and any `utm_*`, `gclid` or `li_fat_id` parameters
(first touch wins). When they click a "Book a call" link it records which one
(`data-cta` on the link) and the page it was on. Both are sent with the form.

### Sheet columns

Received (UTC) · Name · Email · Website · Domain · Free email? · Email matches
site? · CTA clicked · CTA page · Form page · Landing page · Referrer · utm_* ·
gclid · li_fat_id · Country · Region · City · Timezone · IP · User agent ·
Status (starts as `New`) · Notes (flags repeat submissions)

## Careers

`/careers` introduces Vector, explains how hiring works and lists open roles.
Each role opens in place to show the full post; `/careers/<role>` links straight
to a role with it opened. **Apply now** goes to `/careers/<role>/apply`, a short
form that is the same for every role: full name, date of birth, current city,
email, WhatsApp number, LinkedIn (optional), notice period, expected monthly
salary in PKR (optional) and CV. Listings are managed at `/admin`.

Everything lives in one Google Sheet, separate from the leads Sheet: a `Jobs`
tab, plus one applications tab per role (created on the first application, with
the applicant's age worked out from their date of birth). CVs go to a Drive
folder called `Vector job applications`, and each row links to its CV. Drive
files stay private to the Google account that owns the script unless you share
the folder. If a column is added to the form later, existing tabs get it added
at the end of their header row.

Don't edit the `Jobs` tab by hand; use `/admin`. Changing the Status column or
adding notes on an applications tab is fine.

Job pages are cached for about a minute, so published edits can take a minute or
two to appear. CVs are limited to 3 MB because Vercel caps request bodies at
4.5 MB.

### One-time setup

1. **Sheet.** Create a new Google Sheet, for example "Vector careers". Open
   **Extensions → Apps Script**, replace the default code with
   `scripts/careers-apps-script.gs`, and set `SECRET` (any long random string)
   and `NOTIFY_EMAIL` at the top.
2. **Permissions.** Run the `testSetup` function once and approve the
   permissions (Sheets, Drive and email). You should get a "setup OK" email, a
   `Jobs` tab holding the first draft listing, and a `Vector job applications`
   folder in Drive.
3. **Deploy.** **Deploy → New deployment → Web app.** Execute as **Me**; who has
   access: **Anyone**. Copy the URL (ends in `/exec`). Opening it should show
   `{"ok":true,"service":"vector-careers"}`.
4. **Vercel.** In the `vector` project, **Settings → Environment Variables**,
   add for Production and Preview:
   - `CAREERS_WEBHOOK_URL` — the `/exec` URL
   - `CAREERS_WEBHOOK_SECRET` — the same value as `SECRET` in the script
   - `ADMIN_PASSWORD` — the `/admin` password, at least 12 characters (use a long
     random one; changing it signs everyone out)

   Redeploy once so the functions pick them up.
5. **Test.** Sign in at `/admin`, publish the draft, submit a test application,
   then check the row, the CV and the email.

To change the script later, edit it in Apps Script, then **Deploy → Manage
deployments → Edit → Version: New version → Deploy**. The URL stays the same.
