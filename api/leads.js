// Vercel Function — receives the ariza form POST from index.html, fans out to:
//   (a) Bitrix24 crm.lead.add (primary CRM)
//   (b) a Google Apps Script Web App, which appends the row to a backup Google Sheet
// Both writes run with Promise.allSettled so one failing can't block the other.
// Responds ok:true if EITHER succeeds, 502 only if BOTH fail — so a dead/revoked
// Bitrix webhook never silently drops a lead again (see: July 2026 incident).
//
// Env vars consumed:
//   BITRIX_WEBHOOK_URL — full crm.lead.add.json webhook URL
//   APPS_SCRIPT_URL    — Google Apps Script /exec Web App URL (Sheet backup)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const SOURCE_MAP = {
  youtube: 'UC_2Q7WZH',
  instagram: '10',
  telegram: 'UC_R25B1G'
};
const DEFAULT_SOURCE_ID = 'UC_NXB1DZ'; // Веб-сайт | Abdulboriy aka

module.exports = async (req, res) => {
  Object.entries(CORS).forEach(function (entry) { res.setHeader(entry[0], entry[1]); });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const ism = String(body.ism || '').trim();
  const telefon = String(body.telefon || '').trim();
  if (!ism || !telefon) return res.status(400).json({ ok: false, error: 'missing_required_fields' });

  const [bitrixResult, sheetResult] = await Promise.allSettled([
    sendToBitrix(body, ism, telefon),
    sendToSheet(body)
  ]);

  if (bitrixResult.status === 'rejected') console.error('[leads] bitrix error', bitrixResult.reason);
  if (sheetResult.status === 'rejected')  console.error('[leads] sheet error', sheetResult.reason);

  if (bitrixResult.status === 'fulfilled' || sheetResult.status === 'fulfilled') {
    return res.status(200).json({
      ok: true,
      bitrix: bitrixResult.status,
      sheet: sheetResult.status
    });
  }
  return res.status(502).json({ ok: false, error: 'both_failed' });
};

// ─── Bitrix24 ────────────────────────────────────────────────────────────
async function sendToBitrix(body, ism, telefon) {
  const url = process.env.BITRIX_WEBHOOK_URL;
  if (!url) throw new Error('no_bitrix_webhook_url');

  const utmSource = String(body.utm_source || '').toLowerCase();
  const sourceId = SOURCE_MAP[utmSource] || DEFAULT_SOURCE_ID;

  const payload = {
    fields: {
      TITLE: ism + ' — Basyra Academy ariza',
      NAME: ism,
      PHONE: [{ VALUE: telefon, VALUE_TYPE: 'WORK' }],
      COMMENTS: 'Lavozim: ' + (body.lavozim || '') + '\nBiznes turi: ' + (body.biznes || '') + '\nMuammolar: ' + (body.muammolar || ''),
      UF_CRM_1751985930: '1741',
      SOURCE_ID: sourceId,
      STATUS_ID: 'IN_PROCESS',
      UTM_SOURCE: body.utm_source || '',
      UTM_MEDIUM: body.utm_medium || '',
      UTM_CAMPAIGN: body.utm_campaign || '',
      UTM_CONTENT: body.utm_content || '',
      UTM_TERM: body.utm_term || ''
    }
  };

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error('bitrix_http_' + r.status);
  const j = await r.json();
  if (!j.result) throw new Error('bitrix_api_' + (j.error_description || 'unknown'));
}

// ─── Google Sheet backup (Apps Script Web App) ────────────────────────────
async function sendToSheet(body) {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) throw new Error('no_apps_script_url');

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    redirect: 'follow'
  });
  if (!r.ok) throw new Error('sheet_http_' + r.status);
}
