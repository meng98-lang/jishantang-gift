// Server redirect endpoint: /api/go?type=wa&campaign=xxx&ref=xxx
// 1) Picks a WhatsApp number from the rotating pool (least-used)
// 2) Logs the click (with gclid/ttclid/utm + assigned wa_number)
// 3) 302 redirect to WhatsApp (no blank page)
const { getTrackParams, getClientIp, genRefCode, insertRow, pickWaNumber } = require("../lib/track");

const SITE = "jishantang-gift";
// Fallback number (used only if the number pool is empty).
const FALLBACK_WA = "85265131587";

module.exports = async (req, res) => {
  const query = req.query || {};
  const type = "wa";

  const ref = query.ref || genRefCode("G");
  const track = getTrackParams(query);

  // Rotating number selection. If the lead form already picked a number (query.phone),
  // reuse it so the customer reaches the same agent that owns the lead.
  let phone;
  if (query.phone && String(query.phone).replace(/\D/g, "").length >= 8) {
    phone = String(query.phone).replace(/\D/g, "");
  } else {
    const picked = await pickWaNumber(SITE, FALLBACK_WA);
    phone = picked ? picked.phone : FALLBACK_WA.replace(/\D/g, "");
  }

  // WhatsApp prefilled message. Traditional Chinese by default; English only
  // when the visitor is browsing the site in English (lang=en).
  const lang = String(query.lang || "zh").toLowerCase();
  const msg =
    query.msg ||
    (lang.startsWith("en")
      ? `Hello! I'd like to claim my FREE premium herbs in the Mid-Autumn & Anniversary giveaway. My claim code: ${ref}. Are there still spots available?`
      : `您好！我想參加「中秋佳節 × 週年店慶」長白山野山參免費領取活動。我的領取編號：${ref}。請問現在還有名額嗎？謝謝！`);
  const target = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;

  // Log click BEFORE redirecting. On serverless (Vercel) the function may be
  // frozen immediately after we respond, so an un-awaited insert can be lost.
  // We await the write to guarantee the click + attribution is persisted.
  try {
    await insertRow("ad_clicks", {
      ref_code: ref,
      site: SITE,
      type,
      campaign: query.campaign ? String(query.campaign).slice(0, 100) : "midautumn_anniv",
      gclid: track.gclid || null,
      ttclid: track.ttclid || null,
      utm_source: track.utm_source || null,
      utm_medium: track.utm_medium || null,
      utm_campaign: track.utm_campaign || null,
      landing: query.landing ? String(query.landing).slice(0, 300) : null,
      wa_number: phone,
      ip: getClientIp(req),
      ua: (req.headers["user-agent"] || "").toString().slice(0, 300),
    });
  } catch (e) {
    console.error("[go] log click failed:", e.message);
    // Never block the user from reaching WhatsApp on logging failure.
  }

  res.writeHead(302, { Location: target, "Cache-Control": "no-store" });
  res.end();
};
