// 伺服器轉址端點：/api/go?type=line|wa&campaign=xxx&ref=xxx
// 1) 記錄點擊（含 gclid/ttclid/utm 廣告參數）
// 2) 302 直接導向 LINE / WhatsApp（無空白頁）
const { getTrackParams, getClientIp, genRefCode, insertRow } = require("../lib/track");

const SITE = "jishantang-gift";

function buildTarget(type, query) {
  const ref = query.ref || genRefCode("G");
  if (type === "wa") {
    const phone = (process.env.WA_NUMBER || "19432626236").replace(/\D/g, "");
    const msg =
      query.msg ||
      `您好！我要登記中秋店慶【免費領取名貴藥材】活動，我的領取編號：${ref}，請問還有名額嗎？`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  }
  // LINE：使用官方帳號網址（LINE 無法在連結中預填訊息，活動頁會引導發送地址）
  const lineBase = process.env.LINE_URL || "https://line.me/R/ti/p/@your_line_id";
  const sep = lineBase.includes("?") ? "&" : "?";
  return `${lineBase}${sep}ref=${ref}`;
}

module.exports = async (req, res) => {
  const query = req.query || {};
  const type = query.type === "wa" ? "wa" : "line";

  const ref = query.ref || genRefCode("G");
  const track = getTrackParams(query);

  // 記錄點擊（不擋跳轉）
  insertRow("ad_clicks", {
    ref_code: ref,
    site: SITE,
    type,
    campaign: query.campaign ? String(query.campaign).slice(0, 100) : null,
    gclid: track.gclid || null,
    ttclid: track.ttclid || null,
    utm_source: track.utm_source || null,
    utm_medium: track.utm_medium || null,
    utm_campaign: track.utm_campaign || null,
    landing: query.landing ? String(query.landing).slice(0, 300) : null,
    ip: getClientIp(req),
    ua: (req.headers["user-agent"] || "").toString().slice(0, 300),
  });

  const target = buildTarget(type, query);
  res.writeHead(302, { Location: target, "Cache-Control": "no-store" });
  res.end();
};
