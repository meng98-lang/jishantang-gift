// POST /api/admin/login  { password } -> { ok, token }
const { checkPassword, createToken } = require("../../lib/admin");

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
  }
  let body = {};
  try {
    body = typeof req.body === "object" && req.body !== null ? req.body : JSON.parse(req.body || "{}");
  } catch (e) { body = {}; }

  if (!checkPassword(body.password)) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: "wrong_password" }));
  }
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, token: createToken() }));
};
