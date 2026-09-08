// /api/admin/data
// GET    ?type=numbers|leads|clicks|stats  -> read
// POST   { action:"add_number", phone, label }
//        { action:"toggle_number", id }
//        { action:"delete_number", id }
const { verifyToken, getToken, unauthorized } = require("../../lib/admin");
const { supa, normalizePhone } = require("../../lib/track");

const SITE = "jishantang-gift";

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (!verifyToken(getToken(req))) return unauthorized(res);

  const query = req.query || {};

  // ---- READ ----
  if (req.method === "GET") {
    if (query.type === "numbers") {
      const rows = await supa("GET", `wa_numbers?site=eq.${SITE}&order=id.asc&select=*`);
      return res.end(JSON.stringify({ ok: true, numbers: Array.isArray(rows) ? rows : [] }));
    }
    if (query.type === "leads") {
      const limit = Math.min(parseInt(query.limit || "200", 10) || 200, 1000);
      const rows = await supa("GET", `gift_leads?order=id.desc&limit=${limit}&select=*`);
      return res.end(JSON.stringify({ ok: true, leads: Array.isArray(rows) ? rows : [] }));
    }
    if (query.type === "clicks") {
      const limit = Math.min(parseInt(query.limit || "200", 10) || 200, 1000);
      const rows = await supa("GET", `ad_clicks?site=eq.${SITE}&order=id.desc&limit=${limit}&select=*`);
      return res.end(JSON.stringify({ ok: true, clicks: Array.isArray(rows) ? rows : [] }));
    }
    if (query.type === "stats") {
      const nums = (await supa("GET", `wa_numbers?site=eq.${SITE}&select=id,phone,label,active`)) || [];
      // clicks grouped by wa_number
      const clicks = (await supa("GET", `ad_clicks?site=eq.${SITE}&type=eq.wa&select=wa_number,campaign,gclid,ttclid`)) || [];
      const leads = (await supa("GET", `gift_leads?select=wa_number,gclid,ttclid`)) || [];
      const perNum = {};
      nums.forEach((n) => { perNum[normalizePhone(n.phone)] = { phone: normalizePhone(n.phone), label: n.label, active: n.active, clicks: 0, leads: 0 }; });
      clicks.forEach((c) => {
        const p = c.wa_number;
        if (!p) return;
        if (!perNum[p]) perNum[p] = { phone: p, label: null, active: true, clicks: 0, leads: 0 };
        perNum[p].clicks++;
      });
      leads.forEach((l) => {
        const p = l.wa_number;
        if (!p) return;
        if (!perNum[p]) perNum[p] = { phone: p, label: null, active: true, clicks: 0, leads: 0 };
        perNum[p].leads++;
      });
      return res.end(JSON.stringify({
        ok: true,
        stats: {
          total_wa_clicks: clicks.length,
          total_leads: leads.length,
          with_gclid: clicks.filter((c) => !!c.gclid).length + leads.filter((l) => !!l.gclid).length,
          with_ttclid: clicks.filter((c) => !!c.ttclid).length + leads.filter((l) => !!l.ttclid).length,
          numbers: Object.values(perNum),
        },
      }));
    }
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "unknown_type" }));
  }

  // ---- WRITE ----
  if (req.method === "POST") {
    let body = {};
    try {
      body = typeof req.body === "object" && req.body !== null ? req.body : JSON.parse(req.body || "{}");
    } catch (e) { body = {}; }

    if (body.action === "add_number") {
      const phone = normalizePhone(body.phone);
      const label = String(body.label || "").trim().slice(0, 50) || null;
      if (phone.length < 8) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ ok: false, error: "invalid_phone" }));
      }
      // 防重複
      const existing = await supa("GET", `wa_numbers?site=eq.${SITE}&phone=eq.${phone}&select=id`);
      if (Array.isArray(existing) && existing.length > 0) {
        res.statusCode = 409;
        return res.end(JSON.stringify({ ok: false, error: "number_exists" }));
      }
      const ins = await supa("POST", "wa_numbers", { site: SITE, phone, label, active: true });
      return res.end(JSON.stringify({ ok: true, number: Array.isArray(ins) ? ins[0] : ins }));
    }

    if (body.action === "toggle_number") {
      const id = parseInt(body.id, 10);
      if (!id) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_id" })); }
      const cur = await supa("GET", `wa_numbers?id=eq.${id}&site=eq.${SITE}&select=active`);
      const nowActive = Array.isArray(cur) && cur[0] ? !cur[0].active : true;
      const upd = await supa("PATCH", `wa_numbers?id=eq.${id}&site=eq.${SITE}`, { active: nowActive });
      return res.end(JSON.stringify({ ok: true, active: nowActive }));
    }

    if (body.action === "delete_number") {
      const id = parseInt(body.id, 10);
      if (!id) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: "invalid_id" })); }
      await supa("DELETE", `wa_numbers?id=eq.${id}&site=eq.${SITE}`);
      return res.end(JSON.stringify({ ok: true }));
    }

    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "unknown_action" }));
  }

  res.statusCode = 405;
  res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
};
