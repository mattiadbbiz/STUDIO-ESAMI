// Studio Esami – Cloudflare Worker (API + file statici)

const KIND_BY_FILE = {
  flashcard: "flashcard",
  domande_chiuse: "chiusa",
  domande_aperte: "aperta",
};
const SCORE = { so: 1, giusta: 1, parziale: 0.5, ripassare: 0, sbagliata: 0 };
const VALID_RESULTS = Object.keys(SCORE);

const MODULE_STATS = `
  SUM(CASE WHEN i.kind='flashcard' THEN 1 ELSE 0 END) AS n_flashcard,
  SUM(CASE WHEN i.kind='chiusa' THEN 1 ELSE 0 END) AS n_chiuse,
  SUM(CASE WHEN i.kind='aperta' THEN 1 ELSE 0 END) AS n_aperte,
  SUM(CASE WHEN i.kind='flashcard' AND i.last_result='so' THEN 1 ELSE 0 END) AS flashcard_so,
  SUM(CASE WHEN i.last_result IN ('ripassare','sbagliata','parziale') THEN 1 ELSE 0 END) AS da_ripassare,
  AVG(CASE i.last_result WHEN 'so' THEN 1.0 WHEN 'giusta' THEN 1.0 WHEN 'parziale' THEN 0.5
      WHEN 'ripassare' THEN 0.0 WHEN 'sbagliata' THEN 0.0 END) AS score`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }
    try {
      if (env.APP_PASSWORD && request.headers.get("x-app-key") !== env.APP_PASSWORD) {
        return json({ error: "Password mancante o errata" }, 401);
      }
      return await handleApi(request, env, url);
    } catch (err) {
      return json({ error: err.message || "Errore del server" }, 500);
    }
  },
};

async function handleApi(request, env, url) {
  const db = env.DB;
  const parts = url.pathname.replace(/^\/api\//, "").split("/").filter(Boolean);
  const method = request.method;

  // GET /api/ping – verifica password
  if (parts[0] === "ping") return json({ ok: true });

  // ---------- ESAMI ----------
  if (parts[0] === "exams" && parts.length === 1) {
    if (method === "GET") {
      const { results } = await db.prepare(`
        SELECT e.id, e.title, e.created_at,
          (SELECT COUNT(*) FROM modules m WHERE m.exam_id = e.id) AS n_moduli,
          ${MODULE_STATS}
        FROM exams e LEFT JOIN items i ON i.exam_id = e.id
        GROUP BY e.id ORDER BY e.created_at DESC`).all();
      return json(results);
    }
    if (method === "POST") {
      const body = await request.json();
      const title = String(body.title || "").trim();
      if (!title) return json({ error: "Scrivi il nome dell'esame" }, 400);
      const r = await db.prepare("INSERT INTO exams (title) VALUES (?) RETURNING id, title").bind(title).first();
      return json(r);
    }
  }

  if (parts[0] === "exams" && parts[1]) {
    const examId = Number(parts[1]);
    const exam = await db.prepare("SELECT * FROM exams WHERE id = ?").bind(examId).first();
    if (!exam) return json({ error: "Esame non trovato" }, 404);

    // GET /api/exams/:id – esame, moduli con statistiche, ultime sessioni
    if (parts.length === 2 && method === "GET") {
      const modules = (await db.prepare(`
        SELECT m.id, m.code, m.name, m.description, m.ord, ${MODULE_STATS}
        FROM modules m LEFT JOIN items i ON i.module_id = m.id
        WHERE m.exam_id = ? GROUP BY m.id ORDER BY m.ord, m.code`).bind(examId).all()).results;
      const totals = await db.prepare(`
        SELECT ${MODULE_STATS} FROM items i WHERE i.exam_id = ?`).bind(examId).first();
      const sessions = (await db.prepare(`
        SELECT * FROM sessions WHERE exam_id = ? ORDER BY created_at DESC, id DESC LIMIT 15`).bind(examId).all()).results;
      return json({ exam, modules, totals, sessions });
    }

    // DELETE /api/exams/:id
    if (parts.length === 2 && method === "DELETE") {
      await db.batch([
        db.prepare("DELETE FROM items WHERE exam_id = ?").bind(examId),
        db.prepare("DELETE FROM sessions WHERE exam_id = ?").bind(examId),
        db.prepare("DELETE FROM modules WHERE exam_id = ?").bind(examId),
        db.prepare("DELETE FROM exams WHERE id = ?").bind(examId),
      ]);
      return json({ ok: true });
    }

    // POST /api/exams/:id/import – uno o più file JSON
    if (parts[2] === "import" && method === "POST") {
      const body = await request.json();
      const files = Array.isArray(body) ? body : [body];
      const report = [];
      for (const f of files) report.push(await importFile(db, exam, f));
      return json({ report });
    }

    // GET /api/exams/:id/items?kind=&module=&only=1&n=
    if (parts[2] === "items" && method === "GET") {
      const kind = url.searchParams.get("kind");
      const moduleId = url.searchParams.get("module");
      const only = url.searchParams.get("only") === "1";
      const n = Math.min(Number(url.searchParams.get("n") || 500), 500);
      let sql = `SELECT i.*, m.code AS module_code, m.name AS module_name
                 FROM items i JOIN modules m ON m.id = i.module_id WHERE i.exam_id = ?`;
      const args = [examId];
      if (kind) { sql += " AND i.kind = ?"; args.push(kind); }
      if (moduleId) { sql += " AND i.module_id = ?"; args.push(Number(moduleId)); }
      if (only) sql += " AND i.last_result IN ('ripassare','sbagliata','parziale')";
      sql += " ORDER BY i.box ASC, RANDOM() LIMIT ?";
      args.push(n);
      const { results } = await db.prepare(sql).bind(...args).all();
      return json(results.map((r) => ({ ...r, data: JSON.parse(r.data) })));
    }
  }

  // POST /api/items/:id/result  { result }
  if (parts[0] === "items" && parts[2] === "result" && method === "POST") {
    const { result } = await request.json();
    if (!VALID_RESULTS.includes(result)) return json({ error: "Risultato non valido" }, 400);
    const item = await db.prepare("SELECT box FROM items WHERE id = ?").bind(Number(parts[1])).first();
    if (!item) return json({ error: "Elemento non trovato" }, 404);
    const s = SCORE[result];
    const box = s === 1 ? Math.min(item.box + 1, 5) : s === 0 ? 0 : item.box;
    await db.prepare(`UPDATE items SET last_result = ?, box = ?, attempts = attempts + 1,
                      last_seen = datetime('now') WHERE id = ?`).bind(result, box, Number(parts[1])).run();
    return json({ ok: true, box });
  }

  // POST /api/sessions
  if (parts[0] === "sessions" && method === "POST") {
    const b = await request.json();
    await db.prepare(`INSERT INTO sessions (exam_id, module_id, label, kind, total, score)
                      VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(b.exam_id, b.module_id || null, b.label || "", b.kind || "", b.total || 0, b.score ?? null).run();
    return json({ ok: true });
  }

  // GET /api/backup
  if (parts[0] === "backup" && method === "GET") {
    const [exams, modules, items, sessions] = await Promise.all(
      ["exams", "modules", "items", "sessions"].map((t) => db.prepare(`SELECT * FROM ${t}`).all().then((r) => r.results))
    );
    return json({ app: "studio-esami", versione: 1, creato_il: new Date().toISOString(), exams, modules, items, sessions });
  }

  // POST /api/restore – sostituisce tutti i dati con quelli del backup
  if (parts[0] === "restore" && method === "POST") {
    const b = await request.json();
    if (b.app !== "studio-esami") return json({ error: "Questo file non è un backup di Studio Esami" }, 400);
    const stmts = ["items", "sessions", "modules", "exams"].map((t) => db.prepare(`DELETE FROM ${t}`));
    for (const e of b.exams || [])
      stmts.push(db.prepare("INSERT INTO exams (id, title, created_at) VALUES (?, ?, ?)").bind(e.id, e.title, e.created_at));
    for (const m of b.modules || [])
      stmts.push(db.prepare("INSERT INTO modules (id, exam_id, code, name, description, ord) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(m.id, m.exam_id, m.code, m.name, m.description, m.ord));
    for (const i of b.items || [])
      stmts.push(db.prepare(`INSERT INTO items (id, exam_id, module_id, kind, item_key, data, box, last_result, attempts, last_seen)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(i.id, i.exam_id, i.module_id, i.kind, i.item_key, i.data, i.box, i.last_result, i.attempts, i.last_seen));
    for (const s of b.sessions || [])
      stmts.push(db.prepare(`INSERT INTO sessions (id, exam_id, module_id, label, kind, total, score, created_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(s.id, s.exam_id, s.module_id, s.label, s.kind, s.total, s.score, s.created_at));
    await runChunks(db, stmts);
    return json({ ok: true });
  }

  return json({ error: "Percorso non trovato" }, 404);
}

async function importFile(db, exam, f) {
  if (!f || typeof f !== "object") return { ok: false, messaggio: "File non valido" };
  const warn = f.esame && f.esame.trim().toLowerCase() !== exam.title.trim().toLowerCase()
    ? `Il file dice esame “${f.esame}”, importato comunque in “${exam.title}”.` : null;

  // File dei moduli
  if (f.tipo_file === "moduli") {
    const list = Array.isArray(f.moduli) ? f.moduli : [];
    if (!list.length) return { ok: false, messaggio: "Il file moduli non contiene moduli" };
    const stmts = list.map((m, idx) =>
      db.prepare(`INSERT INTO modules (exam_id, code, name, description, ord) VALUES (?, ?, ?, ?, ?)
                  ON CONFLICT (exam_id, code) DO UPDATE SET name = excluded.name,
                  description = excluded.description, ord = excluded.ord`)
        .bind(exam.id, String(m.codice || `M${String(idx + 1).padStart(2, "0")}`), String(m.nome || "Modulo"),
              m.descrizione || null, Number(m.ordine ?? idx + 1)));
    await runChunks(db, stmts);
    return { ok: true, messaggio: `${list.length} moduli pronti`, avviso: warn };
  }

  // File di contenuti
  const kind = KIND_BY_FILE[f.tipo_file];
  if (!kind) return { ok: false, messaggio: `tipo_file “${f.tipo_file}” non riconosciuto` };
  const code = String(f.modulo_codice || "").trim();
  if (!code) return { ok: false, messaggio: "Manca modulo_codice nel file" };
  const elementi = Array.isArray(f.elementi) ? f.elementi : [];
  if (!elementi.length) return { ok: false, messaggio: "Il file non contiene elementi" };

  await db.prepare(`INSERT INTO modules (exam_id, code, name, ord) VALUES (?, ?, ?, 999)
                    ON CONFLICT (exam_id, code) DO NOTHING`).bind(exam.id, code, f.modulo_nome || code).run();
  const mod = await db.prepare("SELECT id, name FROM modules WHERE exam_id = ? AND code = ?").bind(exam.id, code).first();

  const prefix = { flashcard: "FC", chiusa: "DC", aperta: "DA" }[kind];
  const existing = new Set((await db.prepare("SELECT item_key FROM items WHERE exam_id = ?").bind(exam.id).all())
    .results.map((r) => r.item_key));
  let nuovi = 0;
  const stmts = elementi.map((el, idx) => {
    const key = String(el.id || `${code}-${prefix}-${String(idx + 1).padStart(3, "0")}`);
    if (!existing.has(key)) nuovi++;
    return db.prepare(`INSERT INTO items (exam_id, module_id, kind, item_key, data) VALUES (?, ?, ?, ?, ?)
                       ON CONFLICT (exam_id, item_key) DO UPDATE SET data = excluded.data,
                       module_id = excluded.module_id, kind = excluded.kind`)
      .bind(exam.id, mod.id, kind, key, JSON.stringify(el));
  });
  await runChunks(db, stmts);
  const nomi = { flashcard: "flashcard", chiusa: "domande chiuse", aperta: "domande aperte" };
  return {
    ok: true,
    messaggio: `${code} ${mod.name}: ${nuovi} ${nomi[kind]} nuove, ${elementi.length - nuovi} aggiornate`,
    avviso: warn,
  };
}

async function runChunks(db, stmts, size = 50) {
  for (let i = 0; i < stmts.length; i += size) await db.batch(stmts.slice(i, i + size));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
