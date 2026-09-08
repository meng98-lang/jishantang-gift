// Server redirect endpoint: /api/go?type=wa&campaign=xxx&ref=xxx
// 1) Logs the click (with gclid/ttclid/utm ad params)
// 2) 302 redirect to WhatsApp (no blank page)
const { getTrackParams, getClientIp, genRefCode, insertRow } = require("../lib/track");

const SITE = "jishantang-gift";
// Default Jishantang business number (HK +852 6513 1587). Override via Vercel env WA_NUMBER.
const DEFAULT_WA = "85265131587";

function buildWaTarget(query, ref) {
  const phone = (process.env.WA_NUMBER || DEFAULT_WA).replace(/\D/g, "");
  const msg =
    query.msg ||
    `Hello! I'd like to claim my FREE premium herbs in the Mid-Autumn & Anniversary giveaway. My claim code: ${ref}. Are there still spots available?`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

module.exports = async (req, res) => {
  const query = req.query || {};
  // This site now uses WhatsApp for everyone; keep "line" accepted but mapped to WhatsApp.
  const type = query.type === "line" ? "wa" : "wa";

  const ref = query.ref || genRefCode("G");
  const track = getTrackParams(query);

  // Log click (fire-and-forget, does not block redirect)
  insertRow("ad_clicks", {
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
    ip: getClientIp(req),
    ua: (req.headers["user-agent"] || "").toString().slice(0, 300),
  });

  const target = buildWaTarget(query, ref);
  res.writeHead(302, { Location: target, "Cache-Control": "no-store" });
  res.end();
};
