// /api/style-predict — backend for /style-prediction-model (EGO style sales prediction).
// GET returns the form options and validation figures; POST scores a batch of designs.
// Both need the /admin session cookie: the model is built on EGO's sales data.
// Sign-in reuses POST /api/admin {action:"login"}; see lib/careers.js for sessions.

const { isAdmin, passwordReady } = require('../lib/careers');
const { predictBatch, meta } = require('../lib/style-predict');

const MAX_STYLES = 60;
const OPTIONS = meta().options;
const pick = (v, list, fallback) => (list.includes(v) ? v : fallback);

function cleanStyle(s, i) {
  const o = OPTIONS;
  return {
    id: String(s.id || i).slice(0, 60),
    design: String(s.design || '').trim().slice(0, 80),
    line: pick(s.line, o.line, o.line[0]),
    pieces: pick(String(s.pieces), o.pieces, 'na'),
    technique: pick(s.technique, o.technique, 'other'),
    fabric: pick(s.fabric, o.fabric, 'na'),
    cut: pick(s.cut, o.cut, 'na'),
    colour: pick(s.colour, o.colour, 'na'),
    season_tag: pick(s.season_tag, o.season_tag, 'na'),
    price: Math.min(Math.max(Number(s.price) || 0, 0), 500000),
    labels: Array.isArray(s.labels) ? s.labels.filter((l) => o.labels.includes(l)).slice(0, 5) : [],
    eid: !!s.eid,
  };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (!passwordReady()) return res.status(503).json({ ok: false, error: 'Sign-in isn’t set up yet (ADMIN_PASSWORD).' });
  if (!isAdmin(req)) return res.status(401).json({ ok: false, error: 'Please sign in.' });

  if (req.method === 'GET') return res.status(200).json({ ok: true, ...meta() });

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  if (req.headers['x-vector-admin'] !== '1') return res.status(403).json({ ok: false, error: 'Forbidden' });

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const styles = Array.isArray(body.styles) ? body.styles.slice(0, MAX_STYLES) : [];
  if (!styles.length) return res.status(400).json({ ok: false, error: 'Add at least one design.' });
  const bad = styles.findIndex((s) => !(Number(s && s.price) > 0));
  if (bad >= 0) return res.status(400).json({ ok: false, error: `Add a price for design ${bad + 1}.` });

  try {
    const out = predictBatch({
      styles: styles.map(cleanStyle),
      launch_date: String(body.launch_date || ''),
      other_styles: body.other_styles,
      sale: pick(body.sale, ['auto', 'none', 'normal', 'heavy'], 'auto'),
    });
    return res.status(200).json({ ok: true, ...out });
  } catch (e) {
    console.error('style-predict:', e && e.message);
    return res.status(500).json({ ok: false, error: 'Couldn’t score these designs. Try again.' });
  }
};
