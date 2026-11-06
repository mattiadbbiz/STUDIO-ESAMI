// Studio Esami – frontend (HTML/CSS/JS, nessuna libreria tranne KaTeX)

const app = document.getElementById("app");
const KEY_STORE = "studioEsamiKey";
const SCORE = { so: 1, giusta: 1, parziale: 0.5, ripassare: 0, sbagliata: 0 };
const WEAK = ["ripassare", "sbagliata", "parziale"];
const KIND_LABEL = { flashcard: "Flashcard", chiusa: "Domande chiuse", aperta: "Domande aperte" };
const CLAUDE_URL = "https://claude.ai/projects";

const ICON = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  plus: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
};

// ---------- utilità ----------
function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v; // solo per icone fisse
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "value") n.value = v;
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
}

async function api(path, opts = {}) {
  const res = await fetch("/api" + path, {
    method: opts.method || "GET",
    headers: { "content-type": "application/json", "x-app-key": localStorage.getItem(KEY_STORE) || "" },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) { renderLogin(localStorage.getItem(KEY_STORE) ? "Password errata" : ""); throw new Error("auth"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Richiesta non riuscita");
  return data;
}

function renderMath(node) {
  if (!window.renderMathInElement) return;
  window.renderMathInElement(node, {
    delimiters: [
      { left: "$$", right: "$$", display: true }, { left: "\\[", right: "\\]", display: true },
      { left: "$", right: "$", display: false }, { left: "\\(", right: "\\)", display: false },
    ],
    throwOnError: false,
  });
}

function mount(...nodes) {
  app.replaceChildren(...nodes);
  renderMath(app);
  window.scrollTo(0, 0);
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2600);
}

function go(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

const fmt = (x) => (Math.round(x * 10) / 10).toFixed(1).replace(".", ",");
const grade = (score) => (score == null ? "–" : fmt(score * 10));
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const backLink = (hash, label = "Indietro") => el("a", { class: "icon-btn", href: hash, "aria-label": label, html: ICON.back });
const bar = (p, warn) => el("div", { class: "bar" + (warn ? " warn" : "") }, el("span", { style: `width:${Math.max(0, Math.min(100, p))}%` }));
const dateIt = (s) => {
  const d = new Date((s || "").replace(" ", "T") + "Z");
  return isNaN(d) ? "" : d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
};

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  const ta = el("textarea", { style: "position:fixed;opacity:0" }, text);
  document.body.append(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch {}
  ta.remove();
  return ok;
}

function sheet(...children) {
  const box = el("div", { class: "sheet", role: "dialog", "aria-modal": "true" }, children);
  const back = el("div", { class: "sheet-backdrop" }, box);
  back.addEventListener("click", (e) => { if (e.target === back) back.remove(); });
  document.body.append(back);
  const first = box.querySelector("input, textarea, button");
  if (first) first.focus();
  return { close: () => back.remove(), box };
}

function parseJsonText(text) {
  const clean = String(text).replace(/```json|```/g, "").trim();
  const data = JSON.parse(clean);
  return Array.isArray(data) ? data : [data];
}

// ---------- router ----------
async function route() {
  const seg = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  try {
    if (!seg.length) return await viewHome();
    if (seg[0] === "exam" && seg[1]) {
      const id = seg[1];
      if (!seg[2]) return await viewExam(id);
      if (seg[2] === "module" && seg[3]) return await viewModule(id, seg[3]);
      if (seg[2] === "summary") return await viewSummary(id);
      if (seg[2] === "general") return await viewGeneral(id, seg[3] === "teoria" ? "teoria" : "pratica");
    }
    go("#/");
  } catch (err) {
    if (err.message === "auth") return;
    mount(el("h1", {}, "Qualcosa non va"), el("p", { class: "muted" }, err.message),
      el("a", { class: "btn btn-secondary", href: "#/" }, "Torna agli esami"));
  }
}
window.addEventListener("hashchange", route);

// ---------- accesso ----------
function renderLogin(error = "") {
  const input = el("input", { class: "text", type: "password", id: "pwd", autocomplete: "current-password" });
  const msg = el("p", { class: "small result-err" }, error);
  const submit = async () => {
    localStorage.setItem(KEY_STORE, input.value);
    try { await api("/ping"); route(); } catch (e) { if (e.message !== "auth") msg.textContent = e.message; }
  };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  mount(
    el("p", { class: "kicker" }, "Studio esami"), el("h1", {}, "Accedi"),
    el("p", { class: "muted" }, "Inserisci la password impostata su Cloudflare. Resta salvata su questo dispositivo."),
    el("label", { class: "lbl", for: "pwd" }, "Password"), input, msg,
    el("button", { class: "btn btn-primary btn-lg", onclick: submit }, "Entra"),
  );
  input.focus();
}

// ---------- home ----------
async function viewHome() {
  const exams = await api("/exams");
  const cards = exams.map((e) =>
    el("a", { class: "card", href: `#/exam/${e.id}` },
      el("div", { class: "card-head" }, el("span", { class: "card-title" }, e.title),
        el("span", { class: "grade" }, e.score == null ? "–" : `${grade(e.score)} / 10`)),
      bar(pct(e.flashcard_so, e.n_flashcard)),
      el("div", { class: "meta" },
        el("span", {}, `${e.n_moduli} moduli`),
        el("span", {}, `${pct(e.flashcard_so, e.n_flashcard)}% card “so”`),
        e.da_ripassare ? el("span", { class: "warn-text" }, `${e.da_ripassare} da ripassare`) : null)));
  mount(
    el("p", { class: "kicker" }, "Studio esami"),
    el("h1", {}, "I miei esami"),
    el("div", { class: "stack" }, cards.length ? cards : el("div", { class: "empty" }, "Nessun esame. Crea il primo con “Crea esame”.")),
    el("div", { class: "spacer" }),
    el("div", { class: "row", style: "justify-content:space-between" },
      el("button", { class: "btn btn-secondary", onclick: openBackup }, "Backup"),
      el("button", { class: "btn btn-primary fab", onclick: openCreateExam, html: ICON.plus + "Crea esame" })),
  );
}

function openCreateExam() {
  const input = el("input", { class: "text", id: "titolo", placeholder: "Es. Fisica 1" });
  const s = sheet(
    el("h1", { style: "font-size:22px" }, "Nuovo esame"),
    el("label", { class: "lbl", for: "titolo" }, "Nome dell’esame"), input,
    el("button", {
      class: "btn btn-primary btn-lg", onclick: async () => {
        if (!input.value.trim()) return input.focus();
        try { const e = await api("/exams", { method: "POST", body: { title: input.value } }); s.close(); go(`#/exam/${e.id}`); }
        catch (err) { if (err.message !== "auth") toast(err.message); }
      },
    }, "Crea esame"),
    el("button", { class: "btn btn-soft", onclick: () => s.close() }, "Annulla"));
}

function openBackup() {
  const file = el("input", { type: "file", accept: ".json,application/json", class: "text", id: "bk" });
  const s = sheet(
    el("h1", { style: "font-size:22px" }, "Backup"),
    el("p", { class: "muted small" }, "I dati sono già salvati online. Il backup è una copia in più, in un file sul tuo dispositivo."),
    el("button", {
      class: "btn btn-primary", onclick: async () => {
        const data = await api("/backup");
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const a = el("a", { href: URL.createObjectURL(blob), download: `studio-esami-backup-${new Date().toISOString().slice(0, 10)}.json` });
        document.body.append(a); a.click(); a.remove();
        toast("Backup scaricato");
      },
    }, "Scarica backup"),
    el("label", { class: "lbl", for: "bk" }, "Ripristina da un file di backup"), file,
    el("button", {
      class: "btn btn-danger", onclick: async () => {
        if (!file.files[0]) return toast("Scegli prima il file di backup");
        if (!confirm("Il ripristino sostituisce tutti i dati attuali con quelli del backup. Continuare?")) return;
        try {
          await api("/restore", { method: "POST", body: JSON.parse(await file.files[0].text()) });
          s.close(); toast("Dati ripristinati"); go("#/");
        } catch (err) { if (err.message !== "auth") toast(err.message); }
      },
    }, "Ripristina"),
    el("button", { class: "btn btn-soft", onclick: () => s.close() }, "Chiudi"));
}

// ---------- import JSON ----------
function openImport(examId, onDone) {
  const file = el("input", { type: "file", accept: ".json,application/json", multiple: true, class: "text", id: "imp" });
  const paste = el("textarea", { class: "paste", id: "incolla", placeholder: "…oppure incolla qui il JSON copiato da Claude" });
  const out = el("div", { class: "stack small" });
  let imported = false;
  const s = sheet(
    el("h1", { style: "font-size:22px" }, "Carica file JSON"),
    el("p", { class: "muted small" }, "Moduli, flashcard, domande chiuse o aperte: l’app riconosce il tipo e il modulo dal file."),
    el("label", { class: "lbl", for: "imp" }, "File dal dispositivo"), file,
    el("label", { class: "lbl", for: "incolla" }, "Oppure incolla il testo"), paste,
    el("button", {
      class: "btn btn-primary btn-lg", onclick: async () => {
        out.replaceChildren();
        let payload = [];
        try {
          for (const f of file.files) payload.push(...parseJsonText(await f.text()));
          if (paste.value.trim()) payload.push(...parseJsonText(paste.value));
        } catch { out.append(el("p", { class: "result-err" }, "Il testo non è un JSON valido: copia tutto il blocco generato da Claude.")); return; }
        if (!payload.length) return toast("Scegli un file o incolla il JSON");
        try {
          const { report } = await api(`/exams/${examId}/import`, { method: "POST", body: payload });
          for (const r of report) {
            out.append(el("p", { class: r.ok ? "result-ok" : "result-err" }, r.messaggio));
            if (r.avviso) out.append(el("p", { class: "muted" }, r.avviso));
          }
          imported = true; file.value = ""; paste.value = "";
        } catch (err) { if (err.message !== "auth") out.append(el("p", { class: "result-err" }, err.message)); }
      },
    }, "Importa"),
    out,
    el("button", { class: "btn btn-soft", onclick: () => { s.close(); if (imported && onDone) onDone(); } }, "Fatto"));
}

// ---------- esame ----------
async function viewExam(id) {
  const { exam, modules } = await api(`/exams/${id}`);
  const rows = modules.map((m) => {
    const has = m.n_flashcard + m.n_chiuse + m.n_aperte > 0;
    return el("a", { class: "card module", href: `#/exam/${id}/module/${m.id}` },
      el("span", { class: "code" }, m.code),
      el("div", { class: "body" },
        el("span", { class: "name" }, m.name),
        has ? el("div", { class: "chips" },
          el("span", { class: "chip" + (m.n_flashcard ? " on" : "") }, "Flashcard"),
          el("span", { class: "chip" + (m.n_chiuse ? " on" : "") }, "Chiuse"),
          el("span", { class: "chip" + (m.n_aperte ? " on" : "") }, "Aperte"))
          : el("span", { class: "small muted" }, "Nessun file caricato")),
      el("div", { class: "right" },
        el("div", { style: "font-weight:700" }, grade(m.score)),
        m.da_ripassare ? el("div", { class: "small warn-text" }, `${m.da_ripassare} da rip.`) : null));
  });
  mount(
    el("div", { class: "topbar" }, backLink("#/"),
      el("button", { class: "btn btn-soft", onclick: () => openImport(id, () => route()) }, "Carica JSON")),
    el("h1", {}, exam.title),
    el("div", { class: "grid-3" },
      el("a", { class: "tile", href: `#/exam/${id}/general/teoria` }, el("strong", {}, "Teoria generale"), el("span", {}, "Flashcard miste")),
      el("a", { class: "tile", href: `#/exam/${id}/general/pratica` }, el("strong", {}, "Pratica generale"), el("span", {}, "Domande miste")),
      el("a", { class: "tile", href: `#/exam/${id}/summary` }, el("strong", {}, "Riepilogo"), el("span", {}, "Voti e lacune"))),
    el("h2", {}, "Moduli"),
    el("div", { class: "stack" }, rows.length ? rows
      : el("div", { class: "empty" }, "Nessun modulo. Nel progetto Claude scrivi “moduli”, poi carica qui il file con “Carica JSON”.")),
    el("div", { class: "spacer" }),
    el("button", {
      class: "btn btn-danger", onclick: async () => {
        if (!confirm(`Eliminare “${exam.title}” con tutti i moduli e lo storico?`)) return;
        await api(`/exams/${id}`, { method: "DELETE" }); go("#/");
      },
    }, "Elimina esame"),
  );
}

// ---------- modulo ----------
async function viewModule(examId, moduleId) {
  const { exam, modules } = await api(`/exams/${examId}`);
  const m = modules.find((x) => String(x.id) === String(moduleId));
  if (!m) return go(`#/exam/${examId}`);
  const sections = [
    { kind: "flashcard", n: m.n_flashcard, info: `${m.n_flashcard} card · ${m.flashcard_so} so`, extra: bar(pct(m.flashcard_so, m.n_flashcard)) },
    { kind: "chiusa", n: m.n_chiuse, info: `${m.n_chiuse} domande`, extra: el("p", { class: "small muted", style: "margin:0" }, "Crocette e vero/falso") },
    { kind: "aperta", n: m.n_aperte, info: `${m.n_aperte} domande`, extra: el("p", { class: "small muted", style: "margin:0" }, "Scrivi, confronta con la risposta modello, autovalutati") },
  ];
  mount(
    el("div", { class: "topbar" }, backLink(`#/exam/${examId}`)),
    el("p", { class: "kicker" }, `${exam.title} · ${m.code}`),
    el("h1", {}, m.name),
    el("p", { class: "muted", style: "margin:0" }, `Voto modulo ${grade(m.score)} · ${m.da_ripassare} da ripassare`),
    sections.map((sec) => el("div", { class: "card" },
      el("div", { class: "card-head" }, el("span", { class: "card-title" }, KIND_LABEL[sec.kind]), el("span", { class: "small muted" }, sec.info)),
      sec.extra,
      el("div", { class: "row" },
        el("button", {
          class: "btn btn-primary", style: "flex-grow:1", disabled: !sec.n, onclick: async () => {
            const items = await api(`/exams/${examId}/items?kind=${sec.kind}&module=${m.id}`);
            startSession({ examId, moduleId: m.id, label: `${m.code} ${m.name} · ${KIND_LABEL[sec.kind]}`, kind: sec.kind, items, back: `#/exam/${examId}/module/${m.id}` });
          },
        }, "Inizia"),
        el("button", { class: "btn btn-soft", onclick: () => openImport(examId, () => route()) }, "Carica JSON")))),
    el("p", { class: "small muted center", style: "margin:0" }, "Ricaricare un file aggiunge solo gli elementi nuovi: lo storico resta."),
  );
}

// ---------- teoria / pratica generale ----------
async function viewGeneral(examId, startMode) {
  const { exam, modules } = await api(`/exams/${examId}`);
  const st = {
    mode: startMode, only: false, nFlash: 20, nChiuse: 15, nAperte: 5,
    sel: new Set(modules.filter((m) => m.n_flashcard + m.n_chiuse + m.n_aperte > 0).map((m) => m.id)),
  };
  const render = () => {
    const stepper = (label, key) => el("div", { class: "list-row", style: "align-items:center" },
      el("span", { style: "font-size:15px" }, label),
      el("div", { class: "stepper" },
        el("button", { "aria-label": `Meno ${label}`, onclick: () => { st[key] = Math.max(0, st[key] - 5); render(); } }, "−"),
        el("output", {}, st[key]),
        el("button", { "aria-label": `Più ${label}`, onclick: () => { st[key] = Math.min(200, st[key] + 5); render(); } }, "+")));
    const total = st.mode === "teoria" ? st.nFlash : st.nChiuse + st.nAperte;
    mount(
      el("div", { class: "topbar" }, backLink(`#/exam/${examId}`)),
      el("p", { class: "kicker" }, `${exam.title} · tutti i moduli`),
      el("h1", {}, st.mode === "teoria" ? "Teoria generale" : "Pratica generale"),
      el("div", { class: "segmented" },
        el("button", { "aria-pressed": String(st.mode === "teoria"), onclick: () => { st.mode = "teoria"; render(); } }, "Teoria (flashcard)"),
        el("button", { "aria-pressed": String(st.mode === "pratica"), onclick: () => { st.mode = "pratica"; render(); } }, "Pratica (domande)")),
      el("div", { class: "list" }, st.mode === "teoria" ? stepper("Flashcard", "nFlash")
        : [stepper("Domande chiuse", "nChiuse"), stepper("Domande aperte", "nAperte")]),
      el("h2", {}, "Da dove pescare"),
      el("div", { class: "grid-2" },
        el("button", { class: "choice", "aria-pressed": String(!st.only), onclick: () => { st.only = false; render(); } }, "Tutto"),
        el("button", { class: "choice", "aria-pressed": String(st.only), onclick: () => { st.only = true; render(); } }, "Solo da ripassare")),
      el("h2", {}, "Moduli inclusi"),
      el("div", { class: "chips" }, modules.length ? modules.map((m) => {
        const empty = m.n_flashcard + m.n_chiuse + m.n_aperte === 0;
        return el("button", {
          class: "choice", style: "min-height:44px;padding:0 12px;font-size:13px", disabled: empty,
          "aria-pressed": String(st.sel.has(m.id)),
          onclick: () => { st.sel.has(m.id) ? st.sel.delete(m.id) : st.sel.add(m.id); render(); },
        }, `${m.code} ${m.name}`);
      }) : el("p", { class: "muted small" }, "Nessun modulo caricato.")),
      el("div", { class: "spacer" }),
      el("button", { class: "btn btn-primary btn-lg", disabled: !total || !st.sel.size, onclick: start }, `Inizia esercitazione · ${total}`),
    );
  };
  const pick = async (kind, n) => {
    if (!n) return [];
    const all = await api(`/exams/${examId}/items?kind=${kind}${st.only ? "&only=1" : ""}`);
    return all.filter((i) => st.sel.has(i.module_id)).slice(0, n);
  };
  const start = async () => {
    const items = st.mode === "teoria" ? await pick("flashcard", st.nFlash)
      : [...(await pick("chiusa", st.nChiuse)), ...(await pick("aperta", st.nAperte))];
    if (!items.length) return toast(st.only ? "Niente da ripassare: ottimo lavoro" : "Nessun elemento nei moduli scelti");
    startSession({
      examId, moduleId: null, kind: st.mode === "teoria" ? "flashcard" : "mista", items,
      label: `${st.mode === "teoria" ? "Teoria generale" : "Pratica generale"}${st.only ? " · da ripassare" : ""}`,
      back: `#/exam/${examId}`,
    });
  };
  render();
}

// ---------- riepilogo ----------
async function viewSummary(examId) {
  const { exam, modules, totals, sessions } = await api(`/exams/${examId}`);
  const scored = modules.filter((m) => m.score != null).sort((a, b) => a.score - b.score);
  mount(
    el("div", { class: "topbar" }, backLink(`#/exam/${examId}`)),
    el("p", { class: "kicker" }, exam.title),
    el("h1", {}, "Riepilogo"),
    el("div", { class: "grid-3" },
      el("div", { class: "stat" }, el("b", {}, grade(totals?.score)), el("span", {}, "voto medio")),
      el("div", { class: "stat" }, el("b", {}, `${pct(totals?.flashcard_so || 0, totals?.n_flashcard || 0)}%`), el("span", {}, "card “so”")),
      el("div", { class: "stat" }, el("b", { class: "warn-text" }, totals?.da_ripassare || 0), el("span", {}, "da ripassare"))),
    el("h2", {}, "Moduli dal più debole"),
    scored.length ? el("div", { class: "card" }, scored.map((m) => el("div", { class: "stack", style: "gap:6px" },
      el("div", { class: "card-head", style: "font-size:14px" }, el("span", { style: "font-weight:600" }, `${m.code} ${m.name}`), el("b", {}, grade(m.score))),
      bar(m.score * 100, m.score < 0.75))))
      : el("div", { class: "empty" }, "Ancora nessun voto: fai la prima sessione da un modulo."),
    el("h2", {}, "Ultime sessioni"),
    sessions.length ? el("div", { class: "list" }, sessions.map((s) => el("div", { class: "list-row" },
      el("span", {}, s.label || s.kind, el("span", { class: "muted small" }, `  ${dateIt(s.created_at)}`)),
      el("span", { style: "font-weight:600;white-space:nowrap" }, s.score == null ? `${s.total}` : `${fmt(s.score)}/10`))))
      : el("p", { class: "muted small" }, "Nessuna sessione ancora."),
    el("div", { class: "spacer" }),
    el("button", {
      class: "btn btn-primary btn-lg", disabled: !totals?.da_ripassare, onclick: async () => {
        const items = await api(`/exams/${examId}/items?only=1&n=40`);
        startSession({ examId, moduleId: null, kind: "mista", items, label: "Ripasso elementi deboli", back: `#/exam/${examId}/summary` });
      },
    }, totals?.da_ripassare ? `Ripassa i ${Math.min(totals.da_ripassare, 40)} elementi deboli` : "Niente da ripassare"),
  );
}

// ---------- sessione di studio ----------
function startSession(cfg) {
  const items = shuffle(cfg.items || []);
  if (!items.length) return toast("Nessun elemento da studiare qui");
  const s = { cfg, items, i: 0, results: [] };
  renderStep(s);
}

function sessionTop(s, extra) {
  return [
    el("div", { class: "topbar" },
      el("button", {
        class: "icon-btn", "aria-label": "Chiudi sessione", html: ICON.close,
        onclick: () => { if (!s.results.length || confirm("Uscire? Le risposte già date restano salvate.")) go(s.cfg.back); },
      }),
      el("span", { class: "small muted", style: "font-weight:600" }, `${s.i + 1} / ${s.items.length}${extra ? " · " + extra : ""}`),
      el("span", { style: "width:44px" })),
    el("div", { class: "progress" }, el("span", { style: `width:${pct(s.i, s.items.length)}%` })),
  ];
}

function record(s, item, result, extra = {}) {
  s.results.push({ item, result, ...extra });
  api(`/items/${item.id}/result`, { method: "POST", body: { result } }).catch((e) => { if (e.message !== "auth") toast("Risultato non salvato: controlla la connessione"); });
}

function renderStep(s) {
  if (s.i >= s.items.length) return finishSession(s);
  const it = s.items[s.i];
  if (it.kind === "flashcard") renderFlash(s, it);
  else if (it.kind === "chiusa") renderChiusa(s, it);
  else renderAperta(s, it);
}

const moduleBadge = (s, it) => (s.cfg.moduleId ? null : el("span", { class: "badge" }, `${it.module_code} ${it.module_name}`));

function renderFlash(s, it) {
  let flipped = false;
  const d = it.data;
  const card = el("button", { class: "flashcard", "aria-live": "polite" });
  const paint = () => {
    card.replaceChildren(
      el("span", { class: "badge accent" }, flipped ? "Retro" : "Fronte"),
      el("div", { class: "face" }, d.fronte || ""),
      flipped ? el("div", { class: "back" }, d.retro || "") : null,
      el("div", { class: "spacer" }),
      el("p", { class: "small muted center", style: "margin:0" }, flipped ? "Tocca per rivedere il fronte" : "Tocca la carta per girarla"));
    renderMath(card);
  };
  card.addEventListener("click", () => { flipped = !flipped; paint(); });
  paint();
  const answer = (r) => { record(s, it, r); s.i++; renderStep(s); };
  mount(...sessionTop(s), moduleBadge(s, it), card,
    el("div", { class: "grid-2" },
      el("button", { class: "btn btn-warn btn-lg", onclick: () => answer("ripassare") }, "Da ripassare"),
      el("button", { class: "btn btn-primary btn-lg", onclick: () => answer("so") }, "Lo so")));
}

function renderChiusa(s, it) {
  const d = it.data;
  const opts = Array.isArray(d.opzioni) ? d.opzioni : [];
  const vf = d.formato === "vero_falso";
  const letters = "ABCDEFGH";
  const box = el("div", { class: "stack" });
  const after = el("div", { class: "stack" });
  const buttons = opts.map((o, idx) => el("button", { class: "option", onclick: () => choose(idx) },
    el("span", {}, vf ? o : `${letters[idx]} · ${o}`)));
  box.append(...buttons);
  function choose(idx) {
    const ok = idx === Number(d.corretta);
    buttons.forEach((b, j) => {
      b.disabled = true;
      if (j === Number(d.corretta)) { b.classList.add("right"); b.append(el("span", { class: "tag" }, "Giusta")); }
      else if (j === idx) { b.classList.add("wrong"); b.append(el("span", { class: "tag" }, "La tua")); }
    });
    record(s, it, ok ? "giusta" : "sbagliata", { scelta: idx });
    if (d.spiegazione) after.append(el("div", { class: "card" }, el("strong", { class: "small" }, "Spiegazione"), el("div", { class: "explain" }, d.spiegazione)));
    after.append(el("button", { class: "btn btn-primary btn-lg", onclick: () => { s.i++; renderStep(s); } }, "Avanti"));
    renderMath(app);
  }
  mount(...sessionTop(s), moduleBadge(s, it), el("span", { class: "badge" }, vf ? "Vero o falso" : "Scelta multipla"),
    el("p", { class: "question" }, d.domanda || ""), box, after);
}

function renderAperta(s, it) {
  const d = it.data;
  const ta = el("textarea", { class: "answer", id: "risp", placeholder: "Scrivi come se fossi all’esame" });
  const reveal = el("div", { class: "stack" });
  const showBtn = el("button", {
    class: "btn btn-secondary btn-lg", onclick: () => {
      showBtn.remove(); ta.readOnly = true;
      reveal.append(
        el("div", { class: "card" },
          el("strong", { class: "small" }, "Risposta modello"),
          el("div", { class: "explain" }, d.risposta_modello || ""),
          Array.isArray(d.punti_chiave) && d.punti_chiave.length
            ? [el("strong", { class: "small" }, "Punti chiave"), el("ul", { class: "explain", style: "margin:0;padding-left:18px" }, d.punti_chiave.map((p) => el("li", {}, p)))]
            : null),
        el("p", { class: "lbl", style: "margin:4px 0 0" }, "Come è andata?"),
        el("div", { class: "grid-3" },
          el("button", { class: "btn btn-warn", onclick: () => rate("sbagliata") }, "Sbagliata"),
          el("button", { class: "btn btn-soft", onclick: () => rate("parziale") }, "Parziale"),
          el("button", { class: "btn btn-primary", onclick: () => rate("giusta") }, "Giusta")));
      renderMath(reveal);
    },
  }, "Mostra risposta modello");
  const rate = (r) => { record(s, it, r, { risposta: ta.value.trim() }); s.i++; renderStep(s); };
  mount(...sessionTop(s), moduleBadge(s, it), el("span", { class: "badge" }, "Domanda aperta"),
    el("p", { class: "question" }, d.domanda || ""),
    el("label", { class: "lbl", for: "risp" }, "La tua risposta"), ta, showBtn, reveal);
}

function buildExport(s, examTitle) {
  const letters = "ABCDEFGH";
  const wrong = s.results.filter((r) => r.item.kind === "chiusa" && r.result === "sbagliata");
  const open = s.results.filter((r) => r.item.kind === "aperta");
  if (!wrong.length && !open.length) return "";
  const out = [
    "analisi risposte",
    `Esame: ${examTitle} · ${s.cfg.label}`,
    "Confronta le mie risposte con quelle modello: per ognuna dimmi cosa è corretto, cosa manca o è sbagliato e perché. Chiudi con i concetti più deboli e i moduli da ripassare.",
  ];
  if (wrong.length) {
    out.push("", "--- DOMANDE CHIUSE SBAGLIATE ---");
    for (const r of wrong) {
      const d = r.item.data, o = d.opzioni || [], vf = d.formato === "vero_falso";
      const lab = (i) => (vf ? o[i] : `${letters[i]}) ${o[i]}`);
      out.push("", `[${r.item.item_key}] (${r.item.module_code} ${r.item.module_name}) ${d.domanda}`);
      if (!vf) out.push(`Opzioni: ${o.map((x, i) => `${letters[i]}) ${x}`).join("  ")}`);
      out.push(`Mia risposta: ${lab(r.scelta)}`, `Risposta corretta: ${lab(Number(d.corretta))}`);
      if (d.spiegazione) out.push(`Spiegazione fornita: ${d.spiegazione}`);
    }
  }
  if (open.length) {
    out.push("", "--- DOMANDE APERTE ---");
    for (const r of open) {
      const d = r.item.data;
      out.push("", `[${r.item.item_key}] (${r.item.module_code} ${r.item.module_name}) ${d.domanda}`,
        `Mia risposta: ${r.risposta || "(nessuna risposta)"}`, `Risposta modello: ${d.risposta_modello || ""}`);
      if (Array.isArray(d.punti_chiave) && d.punti_chiave.length) out.push(`Punti chiave: ${d.punti_chiave.join("; ")}`);
      out.push(`Autovalutazione: ${r.result}`);
    }
  }
  return out.join("\n");
}

async function finishSession(s) {
  const n = s.results.length;
  const score = n ? (s.results.reduce((a, r) => a + SCORE[r.result], 0) / n) * 10 : 0;
  api("/sessions", { method: "POST", body: { exam_id: Number(s.cfg.examId), module_id: s.cfg.moduleId, label: s.cfg.label, kind: s.cfg.kind, total: n, score } }).catch(() => {});
  const count = (r) => s.results.filter((x) => x.result === r).length;
  const onlyFlash = s.results.every((r) => r.item.kind === "flashcard");
  let examTitle = "";
  try { examTitle = (await api(`/exams/${s.cfg.examId}`)).exam.title; } catch {}
  const text = buildExport(s, examTitle);
  const failed = s.results.filter((r) => WEAK.includes(r.result)).map((r) => r.item);
  const stats = onlyFlash
    ? [["Lo so", count("so"), ""], ["Da ripassare", count("ripassare"), "warn-text"], ["Voto", fmt(score), ""]]
    : [["Giuste", count("giusta"), ""], ["Parziali", count("parziale"), "warn-text"], ["Sbagliate", count("sbagliata"), "warn-text"]];
  mount(
    el("p", { class: "kicker", style: "margin-top:20px" }, s.cfg.label),
    el("h1", {}, "Sessione finita"),
    el("div", { class: "grid-3" }, stats.map(([l, v, c]) => el("div", { class: "stat" }, el("b", { class: c }, v), el("span", {}, l)))),
    onlyFlash ? null : el("p", { class: "muted", style: "margin:0" }, `Voto della sessione: ${fmt(score)} / 10`),
    text ? [
      el("h2", {}, "Da rivedere con Claude"),
      el("div", { class: "card export" }, text),
      el("p", { class: "small muted", style: "margin:0" }, "Il testo viene copiato: incollalo nella chat del progetto Claude di questo esame, così risponde usando le dispense."),
      el("button", {
        class: "btn btn-primary btn-lg", onclick: async () => {
          const ok = await copyText(text);
          toast(ok ? "Copiato: incollalo nel progetto Claude" : "Copia non riuscita: tieni premuto sul testo per copiarlo");
          window.open(CLAUDE_URL, "_blank", "noopener");
        },
      }, "Capisci dove ho sbagliato"),
      el("button", { class: "btn btn-secondary", onclick: async () => toast((await copyText(text)) ? "Testo copiato" : "Copia non riuscita") }, "Copia soltanto"),
    ] : null,
    el("div", { class: "spacer" }),
    failed.length ? el("button", { class: "btn btn-soft btn-lg", onclick: () => startSession({ ...s.cfg, items: failed, label: s.cfg.label + " · errori" }) }, `Ripeti i ${failed.length} errori`) : null,
    el("button", { class: "btn btn-secondary btn-lg", onclick: () => go(s.cfg.back) }, "Fine"),
  );
}

// ---------- avvio ----------
route();
