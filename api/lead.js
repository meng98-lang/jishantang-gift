// 表單名單落地：POST /api/lead
// 收到前端表單 → 寫入 gift_leads → 回傳 { ok, ref }（前端再跳 /api/go 帶上 ref）
const { getTrackParams, getClientIp, genRefCode, insertRow } = require("../lib/track");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
  }

  let body = {};
  try {
    body = typeof req.body === "object" && req.body !== null ? req.body : JSON.parse(req.body || "{}");
  } catch (e) {
    body = {};
  }

  const name = String(body.name || "").trim().slice(0, 100);
  const phone = String(body.phone || "").trim().slice(0, 40);
  const age = body.age ? parseInt(body.age, 10) : null;
  const address = String(body.address || "").trim().slice(0, 500);

  if (!name || !phone) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "missing_name_or_phone" }));
  }

  const ref = genRefCode("G");
  const track = getTrackParams(body);

  await insertRow("gift_leads", {
    ref_code: ref,
    name,
    phone,
    age: Number.isFinite(age) ? age : null,
    address,
    item: body.item ? String(body.item).slice(0, 100) : null,
    source: String(body.source || "gift_form").slice(0, 50),
    campaign: body.campaign ? String(body.campaign).slice(0, 100) : null,
    gclid: track.gclid || null,
    ttclid: track.ttclid || null,
    utm_source: track.utm_source || null,
    utm_medium: track.utm_medium || null,
    utm_campaign: track.utm_campaign || null,
    ip: getClientIp(req),
    ua: (req.headers["user-agent"] || "").toString().slice(0, 300),
  });

  insertRow("ad_clicks", {
    ref_code: ref,
    site: "jishantang-gift",
    type: "lead",
    campaign: body.campaign ? String(body.campaign).slice(0, 100) : "midautumn_anniv",
    gclid: track.gclid || null,
    ttclid: track.ttclid || null,
    utm_source: track.utm_source || null,
    utm_medium: track.utm_medium || null,
    utm_campaign: track.utm_campaign || null,
    landing: null,
    ip: getClientIp(req),
    ua: (req.headers["user-agent"] || "").toString().slice(0, 300),
  });

  res.setHeader("Content-Type", "application/json");
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, ref }));
};
