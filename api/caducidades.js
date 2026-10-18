// Calendario suscrito de caducidades (iCalendar).
// GET /api/caducidades?p=<ref del proyecto Supabase>&k=<anon key>&t=<token secreto del feed>
// Solo lee lo que la función ics_feed(t) de Supabase devuelve para ese token: caducidades y experiencia reciente.
module.exports = async (req, res) => {
  const q = req.query || {};
  const p = String(q.p || ""), k = String(q.k || ""), t = String(q.t || "");
  if (!/^[a-z0-9]{15,40}$/.test(p) || !/^[A-Za-z0-9._-]{20,}$/.test(k) || !/^[A-Za-z0-9_-]{24,80}$/.test(t)) {
    res.statusCode = 400; return res.end("Enlace de calendario no válido");
  }
  let rows;
  try {
    const r = await fetch(`https://${p}.supabase.co/rest/v1/rpc/ics_feed`, {
      method: "POST",
      headers: { apikey: k, Authorization: "Bearer " + k, "Content-Type": "application/json" },
      body: JSON.stringify({ t })
    });
    if (!r.ok) { res.statusCode = 502; return res.end("No se pudo leer el logbook (" + r.status + ")"); }
    rows = await r.json();
  } catch (e) { res.statusCode = 502; return res.end("No se pudo conectar con Supabase"); }
  if (!Array.isArray(rows) || !rows.length) { res.statusCode = 404; return res.end("Calendario desactivado"); }

  const esc = s => String(s || "").replace(/\\/g, "\\\\").replace(/[,;]/g, m => "\\" + m).replace(/\r?\n/g, "\\n");
  const z = d => d.replace(/-/g, "");
  const add = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const fmt = d => d.slice(8, 10) + "/" + d.slice(5, 7) + "/" + d.slice(2, 4);
  const st = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const ev = [];
  const day = (uid, d, title, desc, alarms) => {
    ev.push("BEGIN:VEVENT", `UID:${uid}@logbook.pitulines.com`, `DTSTAMP:${st}`, `DTSTART;VALUE=DATE:${z(d)}`, `DTEND;VALUE=DATE:${z(add(d, 1))}`,
      `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(desc)}`, "TRANSP:TRANSPARENT", "URL:https://logbook.pitulines.com/");
    (alarms || []).forEach(n => ev.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(title)}`, `TRIGGER:-P${n}D`, "END:VALARM"));
    ev.push("END:VEVENT");
  };
  const today = new Date().toISOString().slice(0, 10);
  for (const row of rows) {
    const r = row.data || {};
    if (row.kind === "c" && r.d && /^\d{4}-\d{2}-\d{2}$/.test(r.d)) {
      const warn = Math.max(0, Math.min(365, +r.warn || 60));
      const desc = `Caduca el ${fmt(r.d)}` + (r.done ? ` · última vez ${fmt(r.done)}` : "") + " · Pilot Logbook";
      day(row.id, r.d, "Caduca: " + r.name, desc, [7]);
      if (warn > 0) { const w = add(r.d, -warn); if (w >= add(today, -400)) day(row.id + "-aviso", w, `Renovar: ${r.name} (caduca ${fmt(r.d)})`, `Quedan ${warn} días · Pilot Logbook`, []); }
    }
    if (row.kind === "x" && row.id === "feed" && r.rec && /^\d{4}-\d{2}-\d{2}$/.test(r.rec)) {
      day("recency", r.rec, "Último día de experiencia reciente (FCL.060)", "3 despegues y 3 aterrizajes en 90 días · Pilot Logbook", [15, 5]);
    }
  }
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Pilot Logbook//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Logbook · caducidades", "X-WR-TIMEZONE:Europe/Madrid", "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H",
    ...ev, "END:VCALENDAR"].join("\r\n");
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'inline; filename="caducidades.ics"');
  res.setHeader("Cache-Control", "private, max-age=900");
  res.end(body);
};
