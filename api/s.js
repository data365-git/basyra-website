// Vercel Function — branded short-link redirector.
//   https://basyra-academy.uz/s/<code>  →  302  →  /?utm_source=…&utm_medium=…
// Routed here by the /s/:code rewrite in vercel.json.
//
// Purely additive: long UTM URLs already published (YouTube descriptions etc.)
// are untouched and keep resolving directly. This only adds a second, shorter
// entry point that expands to the same kind of URL, so index.html's existing
// UTM capture and the Bitrix/Sheet lead pipeline see no difference.
//
// 302 not 301 on purpose: a 301 is cached in the visitor's browser permanently,
// so repointing an already-published code at a new campaign would never reach
// returning visitors.
//
// Adding a link = one row in LINKS below + redeploy. Unknown codes fall through
// to the homepage instead of 404 — a typo in an ad should never cost a visitor.
//
// Env vars consumed (optional):
//   CLICKS_WEBHOOK_URL — if set, each click is POSTed here (e.g. an Apps Script
//     Web App appending to a clicks sheet). Deliberately NOT the leads
//     APPS_SCRIPT_URL — click rows must not pollute the leads sheet. Unset =
//     no network call at all, so the redirect stays instant.

const LINKS = {
  ig:   { utm_source: 'instagram', utm_medium: 'social', utm_campaign: 'bio' },
  igad: { utm_source: 'instagram', utm_medium: 'cpc',    utm_campaign: 'trafik' },
  fb:   { utm_source: 'facebook',  utm_medium: 'social', utm_campaign: 'bio' },
  tg:   { utm_source: 'telegram',  utm_medium: 'social', utm_campaign: 'kanal' },
  yt:   { utm_source: 'youtube',   utm_medium: 'video',  utm_campaign: 'organik' },
  tt:   { utm_source: 'tiktok',    utm_medium: 'video',  utm_campaign: 'organik' }
};

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

module.exports = async (req, res) => {
  const code = String((req.query && req.query.code) || '').trim().toLowerCase();
  const link = LINKS[code];

  const params = new URLSearchParams();
  // Forward whatever the ad platform appended to the click (fbclid, gclid, …)
  // so Meta Pixel attribution survives the extra hop.
  Object.keys(req.query || {}).forEach(function (k) {
    if (k === 'code') return;
    const v = req.query[k];
    params.set(k, Array.isArray(v) ? v[0] : String(v));
  });
  if (link) UTM_KEYS.forEach(function (k) { if (link[k]) params.set(k, link[k]); });

  const qs = params.toString();
  const dest = ((link && link.to) || '/') + (qs ? '?' + qs : '');

  console.log('[s] ' + (link ? 'hit' : 'miss') + ' code=' + (code || '-') + ' dest=' + dest);

  if (req.method !== 'HEAD') {
    await logClick({
      ts: new Date().toISOString(),
      code: code,
      matched: Boolean(link),
      dest: dest,
      referer: req.headers['referer'] || '',
      ua: req.headers['user-agent'] || '',
      ip: String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    });
  }

  // no-store keeps the CDN and browser out of the way, so click counts stay
  // honest and repointing a code takes effect on the very next click.
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Location', dest);
  return res.status(302).end();
};

// ─── Click log (optional external webhook) ────────────────────────────────
async function logClick(payload) {
  const url = process.env.CLICKS_WEBHOOK_URL;
  if (!url) return;

  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, 1500);
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: ctrl.signal
    });
  } catch (e) {
    // A dead or slow logger must never block the visitor's redirect.
    console.error('[s] click log failed', e && e.message);
  } finally {
    clearTimeout(timer);
  }
}
