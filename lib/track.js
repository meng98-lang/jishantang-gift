// 共用後端函式庫（Vercel Serverless Functions 用，Node.js）
// 透過 Supabase PostgREST + service_role key 寫入，無需第三方依賴

const SUPA_URL = process.env.COZE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE_KEY =
  process.env.COZE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "";

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

// 正規化 WhatsApp 號碼：只留數字
function normalizePhone(raw) {
  return String(raw || "").replace(/\D/g, "");
}

// 通用 Supabase REST 呼叫
async function supa(method, path, body) {
  if (!SUPA_URL || !SERVICE_KEY) {
    console.warn("[track] Supabase env missing:", method, path);
    return null;
  }
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "return=representation",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const txt = await res.text();
    if (!res.ok) {
      console.error("[track] supa error", method, path, res.status, txt.slice(0, 300));
      return null;
    }
    try { return JSON.parse(txt || "null"); } catch (e) { return null; }
  } catch (e) {
    console.error("[track] supa fetch error", method, path, e.message);
    return null;
  }
}

async function insertRow(table, row) {
  const data = await supa("POST", table, row);
  return Array.isArray(data) ? data[0] : data;
}

// 選取一個 WhatsApp 號碼（輪詢：使用「目前被分派點擊數最少」的啟用號碼，自然均衡）
// fallback: 環境變數 WA_NUMBER / 預設號碼
async function pickWaNumber(site, fallbackPhone) {
  const nums = await supa(
    "GET",
    `wa_numbers?site=eq.${encodeURIComponent(site)}&active=eq.true&order=id.asc&select=id,phone,label`
  );
  if (Array.isArray(nums) && nums.length > 0) {
    // 統計每個號碼在 ad_clicks 中已被分派的次數
    const phones = nums.map((n) => normalizePhone(n.phone));
    const counts = {};
    phones.forEach((p) => (counts[p] = 0));
    // 用 in 查詢近 90 天點擊數
    const phoneList = phones.map((p) => `"${p}"`).join(",");
    const clicks = await supa(
      "GET",
      `ad_clicks?site=eq.${encodeURIComponent(site)}&type=eq.wa&wa_number=in.(${phoneList})&select=wa_number`
    );
    if (Array.isArray(clicks)) {
      clicks.forEach((c) => {
        if (c && c.wa_number && counts[c.wa_number] !== undefined) counts[c.wa_number]++;
      });
    }
    // 選最少；平手隨機
    let min = Infinity;
    let candidates = [];
    nums.forEach((n) => {
      const p = normalizePhone(n.phone);
      const c = counts[p] || 0;
      if (c < min) { min = c; candidates = [n]; }
      else if (c === min) { candidates.push(n); }
    });
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    return { phone: normalizePhone(pick.phone), label: pick.label || null };
  }
  const fb = normalizePhone(process.env.WA_NUMBER || fallbackPhone || "");
  return fb ? { phone: fb, label: "default" } : null;
}

module.exports = {
  SUPA_URL, SERVICE_KEY,
  getTrackParams, getClientIp, genRefCode, normalizePhone,
  supa, insertRow, pickWaNumber,
};
