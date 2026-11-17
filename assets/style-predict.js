/* Browser copy of the EGO style scorer. Loaded by assets/style-model.js after the model is decrypted. */
// EGO style prediction: scores designs with the before-launch model exported from
// the EGO sales model build (17 Nov 2026). create(MODEL) returns the scorer.

function create(MODEL) {

const DAY = 86400000;
const CAT_INDEX = {};
for (const c of MODEL.cat_features) {
  CAT_INDEX[c] = new Map(MODEL.categories[c].map((v, i) => [v, i]));
}

// --- LightGBM tree evaluation (matches LightGBM's numerical and categorical decisions) ---
function walk(node, x) {
  while (typeof node === 'object') {
    let v = x[node.f];
    if (node.c) {
      // categorical: NaN or negative goes right; in-set goes left
      if (v === null || Number.isNaN(v) || v < 0) { node = node.r; continue; }
      node = node.c.includes(Math.trunc(v)) ? node.l : node.r;
      continue;
    }
    const isNan = v === null || Number.isNaN(v);
    if (isNan && node.m !== 2) v = 0;
    if ((node.m === 1 && Math.abs(v) <= 1e-35) || (node.m === 2 && isNan)) {
      node = node.d ? node.l : node.r;
    } else {
      node = v <= node.t ? node.l : node.r;
    }
  }
  return node;
}
function score(trees, x) {
  let s = 0;
  for (const t of trees) s += walk(t, x);
  return s;
}

// --- store context for a launch date ---
const STORE_START = Date.parse(MODEL.store.start + 'T00:00:00Z');
const STORE_DAYS = MODEL.store.units.length;
const sumUnits = (fromIdx, toIdx) => {
  let s = 0;
  for (let i = Math.max(0, fromIdx); i < Math.min(STORE_DAYS, toIdx); i++) s += MODEL.store.units[i];
  return s;
};
const meanMark = (fromIdx, toIdx) => {
  let s = 0; let n = 0;
  for (let i = Math.max(0, fromIdx); i < Math.min(STORE_DAYS, toIdx); i++) { s += MODEL.store.markdown[i]; n++; }
  return n ? s / n : MODEL.store.markdown_levels.normal;
};

function storeContext(launchDate) {
  const idx = Math.round((Date.parse(launchDate + 'T00:00:00Z') - STORE_START) / DAY);
  let prior28; let markdown; let basis;
  if (idx - 28 >= 0 && idx <= STORE_DAYS) {
    prior28 = sumUnits(idx - 28, idx);
    // sale calendar: actual where the 30-day window has happened, last year's pattern otherwise
    markdown = idx + 30 <= STORE_DAYS ? meanMark(idx, idx + 30) : meanMark(idx - 365, idx - 365 + 30);
    basis = 'actual';
  } else if (idx - 365 - 28 >= 0 && idx - 365 < STORE_DAYS) {
    // future launch: same window last year, scaled by the recent year-on-year change
    prior28 = sumUnits(idx - 365 - 28, idx - 365) * MODEL.store.yoy;
    markdown = meanMark(idx - 365, idx - 365 + 30);
    basis = 'last_year';
  } else {
    prior28 = sumUnits(STORE_DAYS - 28, STORE_DAYS);
    markdown = MODEL.store.markdown_levels.normal;
    basis = 'latest';
  }
  return { prior28: Math.max(prior28, 1), markdown, basis };
}

// --- feature vector for one style ---
function clean(v) { return typeof v === 'string' ? v.trim() : v; }

function features(style, ctx) {
  const line = clean(style.line);
  const pieces = String(clean(style.pieces) || 'na');
  const price = Math.min(Math.max(Number(style.price) || 0, 300), 60000);
  const logPrice = Math.log(price);
  const linePrice = MODEL.line_price[line] !== undefined ? MODEL.line_price[line] : MODEL.all_price;
  const labels = new Set((style.labels || []).map((s) => String(s).toLowerCase()));
  const val = {
    line, pieces, season_tag: clean(style.season_tag) || 'na', technique: clean(style.technique) || 'other',
    fabric: clean(style.fabric) || 'na', cut: clean(style.cut) || 'na', colour: clean(style.colour) || 'na',
    log_price: logPrice, price_rel_line: logPrice - linePrice, month: ctx.month,
    n_colourways: style.n_colourways, drop_size: ctx.drop_size, drop_size_line: ctx.drop_line[line] || 1,
    store_markdown_fwd30: ctx.markdown, eid_tag: style.eid ? 1 : 0, kids: line === 'LITTLE EGO' ? 1 : 0,
    n_colour_tags: style.colour && style.colour !== 'na' ? 1 : 0,
    log_store_prior28: Math.log(ctx.prior28),
  };
  for (const lab of MODEL.labels) val[lab] = labels.has(lab.slice(4)) ? 1 : 0;
  for (const c of ['line', 'technique', 'fabric', 'colour', 'pieces', 'season_tag', 'cut']) {
    const h = MODEL.hist[c][String(val[c])];
    val['hist_' + c] = h === undefined ? null : h;
  }
  const hlp = MODEL.hist.line_pieces[`${line}|${pieces}`];
  val.hist_line_pieces = hlp === undefined ? null : hlp;
  return val;
}

function vector(val) {
  return MODEL.features.map((f) => {
    if (CAT_INDEX[f]) {
      const i = CAT_INDEX[f].get(String(val[f]));
      return i === undefined ? null : i;
    }
    const v = val[f];
    return v === null || v === undefined ? null : Number(v);
  });
}

function predictRaw(x) {
  const mid = score(MODEL.trees.mid, x);
  const lo = score(MODEL.trees.lo, x) - MODEL.q;
  const hi = score(MODEL.trees.hi, x) + MODEL.q;
  return { mid, lo, hi };
}

const units = (v) => Math.max(0, Math.expm1(v));

// --- batch prediction ---
function predictBatch(input) {
  const styles = input.styles || [];
  const launch = /^\d{4}-\d{2}-\d{2}$/.test(input.launch_date || '') ? input.launch_date : new Date().toISOString().slice(0, 10);
  const ctx = storeContext(launch);
  if (['none', 'normal', 'heavy'].includes(input.sale)) ctx.markdown = MODEL.store.markdown_levels[input.sale];
  ctx.month = Number(launch.slice(5, 7));
  const others = Math.max(0, Math.min(500, Math.round(Number(input.other_styles) || 0)));
  ctx.drop_size = styles.length + others;
  ctx.drop_line = {};
  const designCount = {};
  for (const s of styles) {
    ctx.drop_line[s.line] = (ctx.drop_line[s.line] || 0) + 1;
    const key = String(s.design || '').trim().toLowerCase() || `__${Math.random()}`;
    s._key = key;
    designCount[key] = (designCount[key] || 0) + 1;
  }
  const out = styles.map((s) => {
    const style = { ...s, n_colourways: designCount[s._key] };
    const raw = predictRaw(vector(features(style, ctx)));
    const likely = units(raw.mid);
    const low = Math.min(units(raw.lo), likely);
    const high = Math.max(units(raw.hi), likely);
    const shares = MODEL.city.shares[style.line] || MODEL.city.shares._all;
    const city = Object.entries(shares).map(([c, sh]) => ({ city: c, units: likely * sh, share: sh }))
      .sort((a, b) => b.share - a.share);
    return { id: s.id, likely, low, high, city, colourways: style.n_colourways };
  });
  const order = out.map((o, i) => [o.likely, i]).sort((a, b) => b[0] - a[0]);
  order.forEach(([, i], r) => { out[i].rank = r + 1; });
  return {
    results: out,
    context: {
      launch_date: launch, store_units_prior28: Math.round(ctx.prior28), store_basis: ctx.basis,
      sale_markdown: ctx.markdown, drop_size: ctx.drop_size,
    },
  };
}

function meta() {
  return {
    version: MODEL.version, trained_on: MODEL.trained_on, options: MODEL.options, validation: MODEL.validation,
    cities: MODEL.city.cities, city_validation: MODEL.city.validation, markdown_levels: MODEL.store.markdown_levels,
  };
}

return { predictBatch, meta, _internal: { predictRaw, vector, features, storeContext, MODEL } };
}

window.StylePredict = { create };
