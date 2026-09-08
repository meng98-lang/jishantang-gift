// Admin auth helper. Token is a simple time-limited HMAC of {exp} using ADMIN_PASSWORD.
const crypto = require("crypto");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "jishantang2024";
const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function sign(payload) {
  return crypto.createHmac("sha256", ADMIN_PASSWORD).update(payload).digest("hex");
}

function createToken() {
  const exp = Date.now() + TTL_MS;
  const body = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return body + "." + sign(body);
}

function verifyToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;
  const [body, sig] = token.split(".");
  if (sign(body) !== sig) return false;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString());
    return data.exp && data.exp > Date.now();
  } catch (e) {
    return false;
  }
}

function checkPassword(pwd) {
  // constant-time compare
  const a = String(pwd || "");
  const b = String(ADMIN_PASSWORD);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch (e) {
    return false;
  }
}

// Extract token from Authorization header (?token= fallback)
function getToken(req) {
  const auth = (req.headers["authorization"] || "").toString();
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  const x = req.headers["x-admin-token"] || req.headers["X-Admin-Token"];
  if (x) return x.toString().trim();
  const url = (req.url || "").split("?")[1] || "";
  const m = new URLSearchParams(url).get("token");
  return m || null;
}

function unauthorized(res) {
  res.statusCode = 401;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
}

module.exports = { createToken, verifyToken, checkPassword, getToken, unauthorized };
