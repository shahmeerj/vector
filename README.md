# Vector — landing page

Static site for vector.thecatalystact.com (Vector, by The Catalyst Act).

- `index.html` — landing page
- `tamba.html`, `personology.html`, `routines.html` — case studies
- `assets/` — shared CSS, JS and favicon
- `api/lead.js` — serverless endpoint behind the "Request a call" form
- `scripts/` — the Google Apps Script for leads, and the case-study embed script

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
