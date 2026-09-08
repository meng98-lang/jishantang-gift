// 表單名單落地：POST /api/lead
// 收到前端表單 → 選一個輪詢號碼 → 寫入 gift_leads → 回傳 { ok, ref, phone }
const { getTrackParams, getClientIp, genRefCode, insertRow, pickWaNumber } = require("../lib/track");

const SITE = "jishantang-gift";
const FALLBACK_WA = "85265131587";

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
  }

  let body = {};
  try {
    body = typeof req.body === "object" && req.body !== null ? req.body : JSON.parse(req.body || "{}");
  } catch (e) {
    body = {};
  }

  const name = String(body.name || "").trim().slice(0, 100);
  const phoneField = String(body.phone || "").trim().slice(0, 40);
  const age = body.age ? parseInt(body.age, 10) : null;
  const address = String(body.address || "").trim().slice(0, 500);

  if (!name || !phoneField) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "missing_name_or_phone" }));
  }

  const ref = genRefCode("G");
  const track = getTrackParams(body);

  // 選取輪詢 WhatsApp 號碼（給客戶發訊息用）
  const picked = await pickWaNumber(SITE, FALLBACK_WA);
  const waNumber = picked ? picked.phone : FALLBACK_WA.replace(/\D/g, "");

  const common = {
    gclid: track.gclid || null,
    ttclid: track.ttclid || null,
    utm_source: track.utm_source || null,
    utm_medium: track.utm_medium || null,
    utm_campaign: track.utm_campaign || null,
    ip: getClientIp(req),
    ua: (req.headers["user-agent"] || "").toString().slice(0, 300),
  };

  await insertRow("gift_leads", {
    ref_code: ref,
    name,
    phone: phoneField,
    age: Number.isFinite(age) ? age : null,
    address,
    item: body.item ? String(body.item).slice(0, 100) : null,
    source: String(body.source || "gift_form").slice(0, 50),
    campaign: body.campaign ? String(body.campaign).slice(0, 100) : "midautumn_anniv",
    wa_number: waNumber,
    ...common,
  });

  try {
    await insertRow("ad_clicks", {
      ref_code: ref,
      site: SITE,
      type: "lead",
      campaign: body.campaign ? String(body.campaign).slice(0, 100) : "midautumn_anniv",
      landing: null,
      wa_number: waNumber,
      ...common,
    });
  } catch (e) {
    console.error("[lead] log click failed:", e.message);
  }

  // 生成雙語 WhatsApp 預填訊息（繁中為主，英文介面用英文），帶上客戶資料方便客服
  const lang = String(body.lang || "zh").toLowerCase();
  const msg = lang.startsWith("en")
    ? `Hello! I want to claim my FREE premium herbs in the Mid-Autumn & Anniversary giveaway.\nName: ${name}\nPhone: ${phoneField}\nAge: ${age || "-"}\nDelivery address: ${address}\nClaim code: ${ref}\nAre there still spots available? Thank you!`
    : `您好！我想參加「中秋佳節 × 週年店慶」名貴藥材免費領取活動。\n姓名：${name}\n電話：${phoneField}\n年齡：${age || "-"}\n收件地址：${address}\n領取編號：${ref}\n請問現在還有名額嗎？謝謝！`;
  const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;

  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, ref, phone: waNumber, url }));
};
