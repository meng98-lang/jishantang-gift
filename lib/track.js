// 共用後端函式庫（Vercel Serverless Functions 用，Node.js）
// 透過 Supabase PostgREST + service_role key 寫入，無需第三方依賴

const SUPA_URL = process.env.COZE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE_KEY =
  process.env.COZE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "";

// 廣告追蹤參數（白名單，避免存入雜訊）
const TRACK_PARAMS = [
  "gclid", "ttclid", "fbclid",
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
];

function getTrackParams(src) {
  const out = {};
  for (const k of TRACK_PARAMS) {
    if (src && src[k]) out[k] = String(src[k]).slice(0, 200);
  }
  return out;
}

function getClientIp(req) {
  const xff = (req.headers["x-forwarded-for"] || "").toString();
  return (xff.split(",")[0] || "").trim().slice(0, 64) || null;
}

// 產生 6 碼不重複 REF（排除易混淆字元）
function genRefCode(prefix) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return prefix + s;
}

// 寫入 Supabase（PostgREST）。失敗不拋出、不中斷跳轉。
async function insertRow(table, row) {
  if (!SUPA_URL || !SERVICE_KEY) {
    console.warn("[track] Supabase env missing, skip insert:", table);
    return null;
  }
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error("[track] insert failed", table, res.status, txt.slice(0, 300));
      return null;
    }
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  } catch (e) {
    console.error("[track] insert error", table, e.message);
    return null;
  }
}

module.exports = { SUPA_URL, SERVICE_KEY, getTrackParams, getClientIp, genRefCode, insertRow };
