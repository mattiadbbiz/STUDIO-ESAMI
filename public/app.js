// Studio Esami – frontend (HTML/CSS/JS, nessuna libreria tranne KaTeX)

const app = document.getElementById("app");
const KEY_STORE = "studioEsamiKey";
const SCORE = { so: 1, giusta: 1, parziale: 0.5, ripassare: 0, sbagliata: 0 };
const WEAK = ["ripassare", "sbagliata", "parziale"];
const CLAUDE_URL = "https://claude.ai/projects";

const SVG = (d, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const ICON = {
  back: SVG('<path d="M15 18l-6-6 6-6"/>', 'stroke-width="2.6"'),
  chev: '<svg class="chev" viewBox="0 0 9 15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 1.5l6 6-6 6"/></svg>',
  close: SVG('<path d="M6 6l12 12M18 6L6 18"/>', 'stroke-width="2.8"'),
  plus: SVG('<path d="M12 5v14M5 12h14"/>', 'stroke-width="2.6"'),
  cards: SVG('<rect x="3" y="6" width="14" height="14" rx="3"/><path d="M7 3h11a3 3 0 0 1 3 3v11"/>'),
  list: SVG('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor"/>'),
  pen: SVG('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>'),
  chart: SVG('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  book: SVG('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>'),
  upload: SVG('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>'),
  doc: SVG('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"/><path d="M14 3v5h5"/>'),
  ok: SVG('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'stroke-width="2.6"'),
  no: SVG('<path d="M7 7l10 10M17 7L7 17"/>', 'stroke-width="2.6"'),
  half: SVG('<path d="M5 12h14"/>', 'stroke-width="2.8"'),
  lock: SVG('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  sparkle: SVG('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'),
  map: SVG('<circle cx="12" cy="12" r="2.6"/><circle cx="4.5" cy="5.5" r="1.8"/><circle cx="19.5" cy="5.5" r="1.8"/><circle cx="4.5" cy="18.5" r="1.8"/><circle cx="19.5" cy="18.5" r="1.8"/><path d="M10 10.4L6 7M14 10.4L18 7M10 13.6L6 17M14 13.6L18 17"/>'),
  route: SVG('<circle cx="6" cy="5" r="2.2"/><circle cx="18" cy="12" r="2.2"/><circle cx="6" cy="19" r="2.2"/><path d="M8.2 5.6c5 1 7.6 3 7.6 4.6M8.2 18.4c5-1 7.6-3 7.6-4.6"/>'),
  question: SVG('<path d="M9.2 9a3 3 0 1 1 4.2 2.7c-.9.4-1.4 1.2-1.4 2.1V15"/><circle cx="12" cy="18.6" r="0.9" fill="currentColor"/>', 'stroke-width="2.4"'),
  check: '<svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};
const KINDS = {
  flashcard: { label: "Flashcard", icon: ICON.cards, tint: "t-purple" },
  chiusa: { label: "Domande chiuse", icon: ICON.list, tint: "t-blue" },
  aperta: { label: "Domande aperte", icon: ICON.pen, tint: "t-green" },
  mappa: { label: "Mappe", icon: ICON.map, tint: "t-orange" },
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
    else if (k === "checked") n.checked = !!v;
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
}
const icon = (svg) => el("span", { html: svg, style: "display:contents" });

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
  app.replaceChildren(...nodes.flat(Infinity).filter((n) => n != null && n !== false));
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

const cleanName = (name) => String(name || "").replace(/^\s*(modulo\s*\d+|m\d+)\s*[-–—:.)]*\s*/i, "").trim() || String(name || "");
const modNum = (m, idx) => (m.ord && m.ord < 999 ? m.ord : idx + 1);
const modLabel = (m, idx) => `${modNum(m, idx)}) ${cleanName(m.name)}`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const fmt = (x) => (Math.round(x * 10) / 10).toFixed(1).replace(".", ",");
const grade = (score) => (score == null ? "–" : fmt(score * 10));
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const dateIt = (s) => {
  const d = new Date((s || "").replace(" ", "T") + "Z");
  return isNaN(d) ? "" : d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
};

// componenti
const nav = (backHash, backText, action) => el("div", { class: "nav" },
  backHash ? el("a", { class: "nav-back", href: backHash }, icon(ICON.back), el("span", {}, backText)) : el("span"),
  action || null);
const titleBlock = (title, eyebrow) => el("div", { class: "title-block" },
  eyebrow ? el("p", { class: "eyebrow" }, eyebrow) : null, el("h1", { class: "large-title" }, title));
const section = (text) => el("h2", { class: "section" }, text);
const bubble = (content, tint, size = "") => el("span", { class: `bubble ${size} ${tint}`, html: content.startsWith("<svg") ? content : null },
  content.startsWith("<svg") ? null : content);
const bar = (p, warn) => el("div", { class: "bar" + (warn ? " warn" : "") }, el("span", { style: `width:${Math.max(0, Math.min(100, p))}%` }));

function ring(fraction, size, stroke, big, small, tone) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const f = fraction == null ? 0 : Math.max(0, Math.min(1, fraction));
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", size); svg.setAttribute("height", size); svg.setAttribute("aria-hidden", "true");
  for (const cls of ["track", "arc"]) {
    const ci = document.createElementNS(ns, "circle");
    ci.setAttribute("class", cls); ci.setAttribute("cx", size / 2); ci.setAttribute("cy", size / 2); ci.setAttribute("r", r);
    ci.setAttribute("fill", "none"); ci.setAttribute("stroke-width", stroke); ci.setAttribute("stroke-linecap", "round");
    if (cls === "arc") { ci.setAttribute("stroke-dasharray", c); ci.setAttribute("stroke-dashoffset", c * (1 - f)); if (!f) ci.setAttribute("opacity", "0"); }
    svg.append(ci);
  }
  const auto = fraction == null ? "" : fraction >= 0.8 ? " good" : fraction < 0.6 ? " warn" : "";
  return el("div", { class: "ring" + (tone ?? auto), style: `width:${size}px;height:${size}px` }, svg,
    el("div", { class: "ring-label" }, el("b", { style: `font-size:${Math.round(size * 0.27)}px` }, big), small ? el("span", {}, small) : null));
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  const ta = el("textarea", { style: "position:fixed;opacity:0" }, text);
  document.body.append(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch {}
  ta.remove();
  return ok;
}

function sheet(title, ...children) {
  let back;
  const close = () => back.remove();
  const box = el("div", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": title },
    el("div", { class: "grabber" }),
    el("div", { class: "sheet-head" }, el("span"), el("h2", {}, title), el("button", { class: "btn-plain btn", onclick: () => close() }, "Chiudi")),
    children);
  back = el("div", { class: "sheet-backdrop" }, box);
  back.addEventListener("click", (e) => { if (e.target === back) close(); });
  document.body.append(back);
  return { close, box };
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
      if (seg[2] === "module" && seg[3] && seg[4] === "map" && seg[5]) return await viewMap(id, seg[3], seg[5]);
      if (seg[2] === "module" && seg[3]) return await viewModule(id, seg[3]);
      if (seg[2] === "summary") return await viewSummary(id);
      if (seg[2] === "map") return await viewExamMap(id);
      if (seg[2] === "general") return await viewGeneral(id, seg[3] === "teoria" ? "teoria" : "pratica");
    }
    go("#/");
  } catch (err) {
    if (err.message === "auth") return;
    mount(nav("#/", "Esami"), el("div", { class: "empty" }, bubble(ICON.no, "t-red", "xl"), el("strong", {}, "Qualcosa non va"), el("p", {}, err.message)));
  }
}
window.addEventListener("hashchange", route);

// ---------- accesso ----------
function renderLogin(error = "") {
  const input = el("input", { class: "field", type: "password", id: "pwd", autocomplete: "current-password", placeholder: "Password", "aria-label": "Password" });
  const msg = el("p", { class: "center", style: "margin:0;color:var(--red);font-size:15px;min-height:20px" }, error);
  const submit = async () => {
    localStorage.setItem(KEY_STORE, input.value);
    try { await api("/ping"); route(); } catch (e) { if (e.message !== "auth") msg.textContent = e.message; }
  };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  mount(
    el("div", { class: "spacer" }),
    el("div", { class: "empty" }, bubble(ICON.lock, "t-blue", "xl"), el("strong", { style: "font-size:28px" }, "Studio Esami"),
      el("p", {}, "Inserisci la password che hai impostato su Cloudflare. Resta salvata su questo dispositivo.")),
    input, msg,
    el("button", { class: "btn btn-primary btn-lg btn-block", onclick: submit }, "Entra"),
    el("div", { class: "spacer" }),
  );
  input.focus();
}

// ---------- home ----------
async function viewHome() {
  const exams = await api("/exams");
  const cards = exams.map((e) => {
    const p = e.n_flashcard ? e.flashcard_so / e.n_flashcard : null;
    return el("a", { class: "card", href: `#/exam/${e.id}` },
      el("div", { class: "card-row" },
        ring(p, 64, 7, p == null ? "–" : `${Math.round(p * 100)}%`, null),
        el("div", { class: "cell-main" },
          el("span", { class: "card-title" }, e.title),
          el("span", { class: "cell-sub" }, `${plural(e.n_moduli, "modulo", "moduli")} · voto ${grade(e.score)}`),
          e.da_ripassare ? el("span", { class: "cell-sub", style: "color:var(--orange);font-weight:600" }, `${e.da_ripassare} da ripassare`) : null),
        icon(ICON.chev)));
  });
  mount(
    nav(null, null, el("button", { class: "nav-action", onclick: openBackup }, "Backup")),
    titleBlock("Esami"),
    cards.length ? el("div", { style: "display:flex;flex-direction:column;gap:12px" }, cards)
      : el("div", { class: "empty" }, bubble(ICON.book, "t-blue", "xl"), el("strong", {}, "Nessun esame"),
        el("p", {}, "Crea il tuo primo esame, poi carica i moduli generati dal progetto Claude.")),
    el("div", { class: "spacer" }),
    el("div", { class: "bottom-bar" }, el("button", { class: "btn btn-primary btn-lg btn-block", onclick: openCreateExam }, icon(ICON.plus), "Nuovo esame")),
  );
}

function openCreateExam() {
  const input = el("input", { class: "field", id: "titolo", placeholder: "Es. Fisica 1 – Modulo A", "aria-label": "Nome dell’esame" });
  const create = async () => {
    if (!input.value.trim()) return input.focus();
    try { const e = await api("/exams", { method: "POST", body: { title: input.value } }); s.close(); go(`#/exam/${e.id}`); }
    catch (err) { if (err.message !== "auth") toast(err.message); }
  };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") create(); });
  const s = sheet("Nuovo esame", input, el("button", { class: "btn btn-primary btn-lg btn-block", onclick: create }, "Crea"));
  input.focus();
}

function openBackup() {
  const file = el("input", { type: "file", accept: ".json,application/json" });
  const fileName = el("span", { class: "cell-sub" }, "Nessun file scelto");
  file.addEventListener("change", () => { fileName.textContent = file.files[0]?.name || "Nessun file scelto"; });
  const s = sheet("Backup",
    el("p", { class: "sheet-note" }, "I dati sono già salvati online. Il backup è una copia in più, in un file sul tuo dispositivo."),
    el("button", {
      class: "btn btn-primary btn-block", onclick: async () => {
        const data = await api("/backup");
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const a = el("a", { href: URL.createObjectURL(blob), download: `studio-esami-backup-${new Date().toISOString().slice(0, 10)}.json` });
        document.body.append(a); a.click(); a.remove();
        toast("Backup scaricato");
      },
    }, "Scarica backup"),
    el("p", { class: "field-label" }, "Ripristina"),
    el("label", { class: "file-pick" }, bubble(ICON.doc, "t-gray"), el("span", { class: "cell-main" }, el("span", {}, "Scegli file di backup"), fileName), file),
    el("button", {
      class: "btn btn-gray btn-block", style: "color:var(--red)", onclick: async () => {
        if (!file.files[0]) return toast("Scegli prima il file di backup");
        if (!confirm("Il ripristino sostituisce tutti i dati attuali con quelli del backup. Continuare?")) return;
        try {
          await api("/restore", { method: "POST", body: JSON.parse(await file.files[0].text()) });
          s.close(); toast("Dati ripristinati"); go("#/");
        } catch (err) { if (err.message !== "auth") toast(err.message); }
      },
    }, "Ripristina dal file"));
}

// ---------- import JSON ----------
function openImport(examId, onDone) {
  const file = el("input", { type: "file", accept: ".json,application/json", multiple: true });
  const fileName = el("span", { class: "cell-sub" }, "Dal telefono o dal PC");
  file.addEventListener("change", () => { fileName.textContent = file.files.length ? [...file.files].map((f) => f.name).join(", ") : "Dal telefono o dal PC"; });
  const paste = el("textarea", { class: "field mono", placeholder: "Oppure incolla qui il JSON copiato da Claude", "aria-label": "Incolla il JSON" });
  const out = el("div", { class: "report" });
  let imported = false;
  const line = (ok, text, note) => el("div", { class: "report-line" }, bubble(ok ? ICON.ok : ICON.no, ok ? "t-green" : "t-red"),
    el("div", {}, text, note ? el("small", {}, note) : null));
  const doImport = async () => {
    out.replaceChildren();
    const payload = [];
    try {
      for (const f of file.files) payload.push(...parseJsonText(await f.text()));
      if (paste.value.trim()) payload.push(...parseJsonText(paste.value));
    } catch { out.append(line(false, "Il testo non è un JSON valido", "Copia tutto il blocco generato da Claude, dalla prima all’ultima parentesi.")); return; }
    if (!payload.length) return toast("Scegli un file o incolla il JSON");
    try {
      const { report } = await api(`/exams/${examId}/import`, { method: "POST", body: payload });
      for (const r of report) out.append(line(r.ok, r.messaggio, r.avviso));
      imported = report.some((r) => r.ok); file.value = ""; paste.value = ""; fileName.textContent = "Dal telefono o dal PC";
    } catch (err) { if (err.message !== "auth") out.append(line(false, err.message)); }
  };
  const s = sheet("Carica contenuti",
    el("p", { class: "sheet-note" }, "Moduli, flashcard o domande: l’app riconosce da sola tipo e modulo."),
    el("label", { class: "file-pick" }, bubble(ICON.doc, "t-blue"), el("span", { class: "cell-main" }, el("span", {}, "Scegli file JSON"), fileName), file),
    paste,
    el("button", { class: "btn btn-primary btn-lg btn-block", onclick: doImport }, "Importa"),
    out);
  const closeBtn = s.box.querySelector(".sheet-head .btn");
  closeBtn.addEventListener("click", () => { if (imported && onDone) onDone(); });
  s.box.parentElement.addEventListener("click", (e) => { if (e.target === s.box.parentElement && imported && onDone) onDone(); });
}

// ---------- esame ----------
async function viewExam(id) {
  const { exam, modules, exam_maps } = await api(`/exams/${id}`);
  const nMaps = modules.reduce((a, m) => a + (m.n_mappe || 0), 0);
  const rows = modules.map((m, idx) => {
    const n = m.n_flashcard + m.n_chiuse + m.n_aperte + (m.n_mappe || 0);
    const parts = [m.n_flashcard && plural(m.n_flashcard, "card", "card"), m.n_chiuse && plural(m.n_chiuse, "chiusa", "chiuse"), m.n_aperte && plural(m.n_aperte, "aperta", "aperte"), m.n_mappe && plural(m.n_mappe, "mappa", "mappe")].filter(Boolean);
    return el("a", { class: "cell", href: `#/exam/${id}/module/${m.id}` },
      bubble(String(modNum(m, idx)), n ? "t-blue" : "t-gray"),
      el("div", { class: "cell-main" },
        el("span", { class: "cell-title" }, cleanName(m.name)),
        el("span", { class: "cell-sub" }, n ? parts.join(" · ") : "Vuoto")),
      el("div", { class: "cell-right" },
        m.da_ripassare ? el("span", { class: "count t-orange", "aria-label": `${m.da_ripassare} da ripassare` }, m.da_ripassare) : null,
        m.score != null ? el("strong", {}, grade(m.score)) : null,
        icon(ICON.chev)));
  });
  const tile = (href, svg, tint, title, sub) => el("a", { class: "tile", href }, bubble(svg, tint, "lg"), el("strong", {}, title), el("span", { class: "sub" }, sub));
  mount(
    nav("#/", "Esami", el("button", { class: "nav-action", onclick: () => openImport(id, () => route()) }, "Carica")),
    titleBlock(exam.title),
    el("div", { class: "tiles" },
      tile(`#/exam/${id}/general/teoria`, ICON.cards, "t-purple", "Teoria", "Flashcard miste"),
      tile(`#/exam/${id}/general/pratica`, ICON.list, "t-blue", "Pratica", "Domande miste"),
      tile(`#/exam/${id}/summary`, ICON.chart, "t-green", "Riepilogo", "Voti e lacune")),
    modules.length ? el("a", { class: "card", href: `#/exam/${id}/map` },
      el("div", { class: "card-row" }, bubble(ICON.map, "t-orange", "lg"),
        el("div", { class: "cell-main" },
          el("span", { style: "font-size:17px;font-weight:600" }, "Mappa complessiva"),
          el("span", { class: "cell-sub" }, exam_maps ? "Creata da Claude, con i collegamenti tra moduli"
            : nMaps ? "Unisce le mappe dei moduli" : "Tutti i moduli in un colpo d’occhio")),
        icon(ICON.chev))) : null,
    section("Moduli"),
    rows.length ? el("div", { class: "group" }, rows)
      : el("div", { class: "group" }, el("div", { class: "empty" }, bubble(ICON.upload, "t-blue", "xl"), el("strong", {}, "Nessun modulo"),
        el("p", {}, "Nel progetto Claude scrivi “moduli”, poi carica qui il file."),
        el("button", { class: "btn btn-primary", onclick: () => openImport(id, () => route()) }, "Carica moduli"))),
    el("div", { class: "spacer" }),
    el("div", { class: "group" },
      el("button", { class: "cell no-icon blue", onclick: () => openImport(id, () => route()) }, "Carica contenuti"),
      el("button", {
        class: "cell no-icon red", onclick: async () => {
          if (!confirm(`Eliminare “${exam.title}” con tutti i moduli e lo storico?`)) return;
          await api(`/exams/${id}`, { method: "DELETE" }); go("#/");
        },
      }, "Elimina esame")),
  );
}

// ---------- modulo ----------
async function viewModule(examId, moduleId) {
  const { exam, modules } = await api(`/exams/${examId}`);
  const mIdx = modules.findIndex((x) => String(x.id) === String(moduleId));
  const m = modules[mIdx];
  if (!m) return go(`#/exam/${examId}`);
  const label = cleanName(m.name);
  const maps = m.n_mappe ? await api(`/exams/${examId}/items?kind=mappa&module=${m.id}`) : [];
  maps.sort((a, b) => a.item_key.localeCompare(b.item_key));
  const sections = [
    { kind: "flashcard", n: m.n_flashcard, sub: m.n_flashcard ? `${plural(m.n_flashcard, "card", "card")} · ${m.flashcard_so} sai già` : "Vuoto" },
    { kind: "chiusa", n: m.n_chiuse, sub: m.n_chiuse ? `${plural(m.n_chiuse, "domanda", "domande")} · crocette e vero/falso` : "Vuoto" },
    { kind: "aperta", n: m.n_aperte, sub: m.n_aperte ? `${plural(m.n_aperte, "domanda", "domande")} · risposta scritta` : "Vuoto" },
  ];
  const start = async (kind) => {
    const items = await api(`/exams/${examId}/items?kind=${kind}&module=${m.id}`);
    startSession({ examId, moduleId: m.id, label: `${label} · ${KINDS[kind].label}`, kind, items, back: `#/exam/${examId}/module/${m.id}` });
  };
  const load = () => openImport(examId, () => route());
  mount(
    nav(`#/exam/${examId}`, exam.title),
    titleBlock(cleanName(m.name), `Modulo ${modNum(m, mIdx)}`),
    el("div", { class: "card" },
      el("div", { class: "card-row" },
        ring(m.score, 76, 8, grade(m.score), "voto"),
        el("div", { class: "cell-main", style: "gap:4px" },
          el("span", { style: "font-size:17px;font-weight:600" }, m.score == null ? "Ancora da iniziare" : m.score >= 0.8 ? "Ottimo lavoro" : m.score >= 0.6 ? "Ci sei quasi" : "Da rinforzare"),
          el("span", { class: "cell-sub" }, m.da_ripassare ? `${plural(m.da_ripassare, "elemento", "elementi")} da ripassare` : "Niente in sospeso")))),
    sections.map((sec) => el("div", { class: "card" },
      el("div", { class: "card-row" }, bubble(KINDS[sec.kind].icon, KINDS[sec.kind].tint, "lg"),
        el("div", { class: "cell-main" }, el("span", { style: "font-size:18px;font-weight:600" }, KINDS[sec.kind].label), el("span", { class: "cell-sub" }, sec.sub))),
      sec.n
        ? el("div", { class: "row" },
          el("button", { class: "btn btn-primary grow", onclick: () => start(sec.kind) }, "Inizia"),
          el("button", { class: "btn btn-tinted", onclick: load, "aria-label": `Carica ${KINDS[sec.kind].label}` }, icon(ICON.upload), "Carica"))
        : el("button", { class: "btn btn-tinted btn-block", onclick: load }, icon(ICON.upload), "Carica il file da Claude"))),
    el("div", { class: "card" },
      el("div", { class: "card-row" }, bubble(KINDS.mappa.icon, KINDS.mappa.tint, "lg"),
        el("div", { class: "cell-main" }, el("span", { style: "font-size:18px;font-weight:600" }, "Mappe"),
          el("span", { class: "cell-sub" }, maps.length ? `${plural(maps.length, "mappa", "mappe")} · concetti ed esercizi` : "Vuoto"))),
      maps.length ? el("div", { class: "group inset" }, maps.map((mp) => el("a", { class: "cell", href: `#/exam/${examId}/module/${m.id}/map/${mp.id}` },
        bubble(mp.data.tipo === "esercizi" ? ICON.route : ICON.map, mp.data.tipo === "esercizi" ? "t-green" : "t-orange"),
        el("div", { class: "cell-main" }, el("span", { class: "cell-title" }, mp.data.titolo || "Mappa"),
          el("span", { class: "cell-sub" }, mp.data.tipo === "esercizi" ? "Schema per gli esercizi" : "Mappa dei concetti")),
        icon(ICON.chev)))) : null,
      maps.length ? el("button", { class: "btn btn-tinted btn-block", onclick: load }, icon(ICON.upload), "Carica")
        : el("button", { class: "btn btn-tinted btn-block", onclick: load }, icon(ICON.upload), "Carica il file da Claude")),
    el("p", { class: "foot center" }, "Ricaricare un file aggiunge solo le novità: lo storico resta."),
  );
}

// ---------- teoria / pratica generale ----------
async function viewGeneral(examId, startMode) {
  const { exam, modules } = await api(`/exams/${examId}`);
  const withContent = modules.map((m, idx) => ({ ...m, idx })).filter((m) => m.n_flashcard + m.n_chiuse + m.n_aperte > 0);
  const st = { mode: startMode, only: false, nFlash: 20, nChiuse: 15, nAperte: 5, sel: new Set(withContent.map((m) => m.id)) };
  const render = () => {
    const stepper = (label, key) => el("div", { class: "cell no-icon" },
      el("span", { class: "cell-main cell-title" }, label),
      el("div", { class: "cell-right" }, el("span", { class: "value" }, st[key]),
        el("div", { class: "stepper" },
          el("button", { "aria-label": `Meno ${label}`, onclick: () => { st[key] = Math.max(0, st[key] - 5); render(); } }, "−"),
          el("button", { "aria-label": `Più ${label}`, onclick: () => { st[key] = Math.min(200, st[key] + 5); render(); } }, "+"))));
    const total = st.mode === "teoria" ? st.nFlash : st.nChiuse + st.nAperte;
    const sw = el("input", { type: "checkbox", role: "switch", "aria-label": "Solo da ripassare", checked: st.only });
    sw.addEventListener("change", () => { st.only = sw.checked; render(); });
    mount(
      nav(`#/exam/${examId}`, exam.title),
      titleBlock(st.mode === "teoria" ? "Teoria" : "Pratica", "Tutti i moduli"),
      el("div", { class: "segmented", role: "group", "aria-label": "Tipo di esercitazione" },
        el("button", { "aria-pressed": String(st.mode === "teoria"), onclick: () => { st.mode = "teoria"; render(); } }, "Flashcard"),
        el("button", { "aria-pressed": String(st.mode === "pratica"), onclick: () => { st.mode = "pratica"; render(); } }, "Domande")),
      section("Quante"),
      el("div", { class: "group" }, st.mode === "teoria" ? stepper("Flashcard", "nFlash")
        : [stepper("Domande chiuse", "nChiuse"), stepper("Domande aperte", "nAperte")]),
      el("div", { class: "group" },
        el("div", { class: "cell no-icon" },
          el("div", { class: "cell-main" }, el("span", { class: "cell-title" }, "Solo da ripassare"), el("span", { class: "cell-sub" }, "Errori e risposte parziali")),
          el("label", { class: "switch" }, sw, el("span")))),
      section("Moduli"),
      withContent.length ? el("div", { class: "group" }, withContent.map((m) => el("button", {
        class: "cell", "aria-pressed": String(st.sel.has(m.id)),
        onclick: () => { st.sel.has(m.id) ? st.sel.delete(m.id) : st.sel.add(m.id); render(); },
      }, bubble(String(modNum(m, m.idx)), st.sel.has(m.id) ? "t-blue" : "t-gray"),
        el("span", { class: "cell-main cell-title" }, cleanName(m.name)),
        st.sel.has(m.id) ? icon(ICON.check) : el("span", { style: "width:22px" }))))
        : el("div", { class: "group" }, el("div", { class: "empty" }, el("p", {}, "Carica prima i contenuti di almeno un modulo."))),
      el("div", { class: "spacer" }),
      el("div", { class: "bottom-bar" },
        el("button", { class: "btn btn-primary btn-lg btn-block", disabled: !total || !st.sel.size, onclick: begin }, `Inizia · ${total}`)),
    );
  };
  const pick = async (kind, n) => {
    if (!n) return [];
    const all = await api(`/exams/${examId}/items?kind=${kind}${st.only ? "&only=1" : ""}`);
    return all.filter((i) => st.sel.has(i.module_id)).slice(0, n);
  };
  const begin = async () => {
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
  const scored = modules.map((m, idx) => ({ ...m, idx })).filter((m) => m.score != null).sort((a, b) => a.score - b.score);
  const weak = totals?.da_ripassare || 0;
  mount(
    nav(`#/exam/${examId}`, exam.title),
    titleBlock("Riepilogo"),
    el("div", { class: "hero" }, ring(totals?.score, 148, 13, grade(totals?.score), "voto medio")),
    el("div", { class: "stats" },
      el("div", { class: "stat" }, el("b", {}, `${pct(totals?.flashcard_so || 0, totals?.n_flashcard || 0)}%`), el("span", {}, "card che sai")),
      el("div", { class: "stat" }, el("b", { style: weak ? "color:var(--orange)" : "" }, weak), el("span", {}, "da ripassare")),
      el("div", { class: "stat" }, el("b", {}, sessions.length), el("span", {}, "sessioni"))),
    section("Moduli dal più debole"),
    scored.length ? el("div", { class: "group" }, scored.map((m) => el("a", { class: "cell", href: `#/exam/${examId}/module/${m.id}` },
      bubble(String(modNum(m, m.idx)), m.score < 0.6 ? "t-orange" : m.score >= 0.8 ? "t-green" : "t-blue"),
      el("div", { class: "cell-main", style: "gap:6px" }, el("span", { class: "cell-title" }, cleanName(m.name)), bar(m.score * 100, m.score < 0.6)),
      el("div", { class: "cell-right" }, el("strong", {}, grade(m.score)), icon(ICON.chev)))))
      : el("div", { class: "group" }, el("div", { class: "empty" }, el("p", {}, "Ancora nessun voto: fai la prima sessione da un modulo."))),
    sessions.length ? [section("Ultime sessioni"), el("div", { class: "group" }, sessions.map((s) => el("div", { class: "cell no-icon" },
      el("div", { class: "cell-main" }, el("span", { class: "cell-title", style: "font-size:16px" }, s.label || s.kind), el("span", { class: "cell-sub" }, `${dateIt(s.created_at)} · ${plural(s.total, "elemento", "elementi")}`)),
      el("div", { class: "cell-right" }, el("strong", {}, s.score == null ? "–" : fmt(s.score))))))] : null,
    el("div", { class: "spacer" }),
    el("div", { class: "bottom-bar" },
      el("button", {
        class: "btn btn-primary btn-lg btn-block", disabled: !weak, onclick: async () => {
          const items = await api(`/exams/${examId}/items?only=1&n=40`);
          startSession({ examId, moduleId: null, kind: "mista", items, label: "Ripasso elementi deboli", back: `#/exam/${examId}/summary` });
        },
      }, weak ? `Ripassa ${plural(Math.min(weak, 40), "elemento debole", "elementi deboli")}` : "Niente da ripassare")),
  );
}

// ---------- sessione di studio ----------
function startSession(cfg) {
  const items = shuffle(cfg.items || []);
  if (!items.length) return toast("Nessun elemento da studiare qui");
  renderStep({ cfg, items, i: 0, results: [] });
}

function sessionTop(s) {
  return el("div", { class: "session-top" },
    el("button", {
      class: "close-bubble", "aria-label": "Chiudi sessione", html: ICON.close,
      onclick: () => { if (!s.results.length || confirm("Uscire? Le risposte già date restano salvate.")) go(s.cfg.back); },
    }),
    el("div", { class: "progress", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": s.items.length, "aria-valuenow": s.i },
      el("span", { style: `width:${pct(s.i, s.items.length)}%` })),
    el("span", { class: "counter" }, `${s.i + 1}/${s.items.length}`));
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

const tag = (s, it, text, tint) => el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" },
  el("span", { class: `pill ${tint}` }, text),
  s.cfg.moduleId ? null : el("span", { class: "pill t-gray" }, cleanName(it.module_name)));

function renderFlash(s, it) {
  const d = it.data;
  const card = el("button", { class: "flip", "aria-label": "Gira la carta" },
    el("div", { class: "flip-inner" },
      el("div", { class: "face" }, el("div", { class: "front-text" }, d.fronte || ""), el("p", { class: "hint" }, "Tocca per vedere la risposta")),
      el("div", { class: "face back" }, el("span", { class: "back-title" }, d.fronte || ""), el("div", { class: "back-text" }, d.retro || ""),
        el("p", { class: "hint" }, "Tocca per tornare alla domanda"))));
  card.addEventListener("click", () => card.classList.toggle("flipped"));
  const answer = (r) => { record(s, it, r); s.i++; renderStep(s); };
  mount(sessionTop(s), tag(s, it, "Flashcard", "t-purple"), card,
    el("div", { class: "row" },
      el("button", { class: "btn btn-gray btn-lg grow", style: "color:var(--orange)", onclick: () => answer("ripassare") }, "Da ripassare"),
      el("button", { class: "btn btn-primary btn-lg grow", onclick: () => answer("so") }, "Lo so")));
}

function renderChiusa(s, it) {
  const d = it.data;
  const opts = Array.isArray(d.opzioni) ? d.opzioni : [];
  const vf = d.formato === "vero_falso";
  const letters = "ABCDEFGH";
  const after = el("div", { style: "display:flex;flex-direction:column;gap:12px" });
  const buttons = opts.map((o, idx) => el("button", { class: "option", onclick: () => choose(idx) },
    el("span", { class: "letter" }, vf ? (idx === 0 ? "V" : "F") : letters[idx]), el("span", { class: "txt" }, o)));
  function choose(idx) {
    const right = Number(d.corretta);
    buttons.forEach((b, j) => {
      b.disabled = true;
      if (j === right) { b.classList.add("right"); b.append(el("span", { class: "mark" }, j === idx ? "Esatto" : "Giusta")); }
      else if (j === idx) { b.classList.add("wrong"); b.append(el("span", { class: "mark" }, "La tua")); }
    });
    record(s, it, idx === right ? "giusta" : "sbagliata", { scelta: idx });
    if (d.spiegazione) after.append(el("div", { class: "card", style: "gap:6px" }, el("span", { class: "back-title", style: "font-size:15px;font-weight:600;color:var(--muted)" }, "Perché"), el("div", { class: "prose" }, d.spiegazione)));
    after.append(el("button", { class: "btn btn-primary btn-lg btn-block", onclick: () => { s.i++; renderStep(s); } }, "Continua"));
    renderMath(after);
    after.scrollIntoView({ behavior: "smooth", block: "end" });
  }
  mount(sessionTop(s), tag(s, it, vf ? "Vero o falso" : "Scelta multipla", "t-blue"),
    el("p", { class: "question" }, d.domanda || ""), el("div", { class: "options" }, buttons), after);
}

function renderAperta(s, it) {
  const d = it.data;
  const ta = el("textarea", { class: "field", placeholder: "Scrivi la tua risposta come se fossi all’esame", "aria-label": "La tua risposta", style: "background:var(--surface);min-height:150px" });
  const reveal = el("div", { style: "display:flex;flex-direction:column;gap:12px" });
  const rate = (r) => { record(s, it, r, { risposta: ta.value.trim() }); s.i++; renderStep(s); };
  const showBtn = el("button", {
    class: "btn btn-tinted btn-lg btn-block", onclick: () => {
      showBtn.remove(); ta.readOnly = true;
      reveal.append(
        el("div", { class: "card", style: "gap:8px" },
          el("span", { style: "font-size:15px;font-weight:600;color:var(--muted)" }, "Risposta modello"),
          el("div", { class: "prose" }, d.risposta_modello || ""),
          Array.isArray(d.punti_chiave) && d.punti_chiave.length
            ? [el("span", { style: "font-size:15px;font-weight:600;color:var(--muted);margin-top:4px" }, "Punti chiave"),
              el("div", { style: "display:flex;flex-direction:column;gap:6px" }, d.punti_chiave.map((p) =>
                el("div", { style: "display:flex;gap:10px;align-items:flex-start;font-size:16px" }, el("span", { class: "bubble t-green", style: "width:22px;height:22px;margin-top:1px", html: ICON.ok }), el("span", {}, p))))]
            : null),
        el("p", { class: "section", style: "margin:4px 0 -4px" }, "Come è andata?"),
        el("div", { class: "rate" },
          el("button", { class: "t-red", onclick: () => rate("sbagliata") }, icon(ICON.no), "Sbagliata"),
          el("button", { class: "t-orange", onclick: () => rate("parziale") }, icon(ICON.half), "Parziale"),
          el("button", { class: "t-green", onclick: () => rate("giusta") }, icon(ICON.ok), "Giusta")));
      renderMath(reveal);
      reveal.scrollIntoView({ behavior: "smooth", block: "start" });
    },
  }, "Mostra la risposta modello");
  mount(sessionTop(s), tag(s, it, "Domanda aperta", "t-green"), el("p", { class: "question" }, d.domanda || ""), ta, showBtn, reveal);
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
      out.push("", `[${r.item.item_key}] (${cleanName(r.item.module_name)}) ${d.domanda}`);
      if (!vf) out.push(`Opzioni: ${o.map((x, i) => `${letters[i]}) ${x}`).join("  ")}`);
      out.push(`Mia risposta: ${lab(r.scelta)}`, `Risposta corretta: ${lab(Number(d.corretta))}`);
      if (d.spiegazione) out.push(`Spiegazione fornita: ${d.spiegazione}`);
    }
  }
  if (open.length) {
    out.push("", "--- DOMANDE APERTE ---");
    for (const r of open) {
      const d = r.item.data;
      out.push("", `[${r.item.item_key}] (${cleanName(r.item.module_name)}) ${d.domanda}`,
        `Mia risposta: ${r.risposta || "(nessuna risposta)"}`, `Risposta modello: ${d.risposta_modello || ""}`);
      if (Array.isArray(d.punti_chiave) && d.punti_chiave.length) out.push(`Punti chiave: ${d.punti_chiave.join("; ")}`);
      out.push(`Autovalutazione: ${r.result}`);
    }
  }
  return out.join("\n");
}

async function finishSession(s) {
  const n = s.results.length;
  const frac = n ? s.results.reduce((a, r) => a + SCORE[r.result], 0) / n : 0;
  api("/sessions", { method: "POST", body: { exam_id: Number(s.cfg.examId), module_id: s.cfg.moduleId, label: s.cfg.label, kind: s.cfg.kind, total: n, score: frac * 10 } }).catch(() => {});
  const count = (r) => s.results.filter((x) => x.result === r).length;
  const onlyFlash = s.results.every((r) => r.item.kind === "flashcard");
  let examTitle = "";
  try { examTitle = (await api(`/exams/${s.cfg.examId}`)).exam.title; } catch {}
  const text = buildExport(s, examTitle);
  const failed = s.results.filter((r) => WEAK.includes(r.result)).map((r) => r.item);
  const stats = onlyFlash
    ? [["Lo so", count("so"), "var(--green)"], ["Da ripassare", count("ripassare"), "var(--orange)"], ["Totale", n, ""]]
    : [["Giuste", count("giusta"), "var(--green)"], ["Parziali", count("parziale"), "var(--orange)"], ["Sbagliate", count("sbagliata"), "var(--red)"]];
  const msg = frac >= 0.8 ? "Ottimo lavoro" : frac >= 0.6 ? "Ci sei quasi" : "Continua così, ripassa gli errori";
  mount(
    el("div", { class: "hero", style: "padding-top:24px" },
      ring(frac, 156, 14, fmt(frac * 10), "su 10"),
      el("h1", { class: "large-title", style: "font-size:28px;text-align:center" }, msg),
      el("p", { class: "muted center", style: "margin:0" }, s.cfg.label)),
    el("div", { class: "stats" }, stats.map(([l, v, c]) => el("div", { class: "stat" }, el("b", { style: c ? `color:${c}` : "" }, v), el("span", {}, l)))),
    text ? [
      el("div", { class: "card", style: "gap:10px" },
        el("div", { class: "card-row" }, bubble(ICON.sparkle, "t-purple", "lg"),
          el("div", { class: "cell-main" }, el("span", { style: "font-size:17px;font-weight:600" }, "Capisci dove hai sbagliato"),
            el("span", { class: "cell-sub" }, "Copio tutto e apro Claude: incolla nel progetto dell’esame."))),
        el("button", {
          class: "btn btn-primary btn-block", onclick: async () => {
            const ok = await copyText(text);
            toast(ok ? "Copiato: incollalo nel progetto Claude" : "Copia non riuscita: apri il testo e copialo a mano");
            window.open(CLAUDE_URL, "_blank", "noopener");
          },
        }, "Copia e apri Claude")),
      el("details", { class: "export" }, el("summary", {}, "Vedi il testo copiato", icon(ICON.chev)), el("pre", {}, text)),
    ] : null,
    el("div", { class: "spacer" }),
    el("div", { class: "bottom-bar" },
      failed.length ? el("button", { class: "btn btn-tinted btn-lg btn-block", onclick: () => startSession({ ...s.cfg, items: failed, label: s.cfg.label + " · errori" }) },
        failed.length === 1 ? "Ripeti l’errore" : `Ripeti i ${failed.length} errori`) : null,
      el("button", { class: "btn btn-gray btn-lg btn-block", onclick: () => go(s.cfg.back) }, "Fine")),
  );
}


// ---------- mappe ----------
async function viewMap(examId, moduleId, itemId) {
  const [{ modules }, maps] = await Promise.all([api(`/exams/${examId}`), api(`/exams/${examId}/items?kind=mappa&module=${moduleId}`)]);
  const m = modules.find((x) => String(x.id) === String(moduleId));
  const it = maps.find((x) => String(x.id) === String(itemId));
  if (!m || !it) return go(`#/exam/${examId}/module/${moduleId}`);
  const d = it.data;
  mapScreen({
    backHash: `#/exam/${examId}/module/${moduleId}`, backText: cleanName(m.name), titolo: d.titolo || "Mappa",
    eyebrow: d.tipo === "esercizi" ? "Schema per gli esercizi" : "Mappa dei concetti", tipo: d.tipo, radice: d.radice || { testo: d.titolo || "Mappa" },
  });
}

async function viewExamMap(examId) {
  const [{ exam, modules }, maps] = await Promise.all([api(`/exams/${examId}`), api(`/exams/${examId}/items?kind=mappa`)]);
  const own = maps.filter((x) => x.module_id === 0).sort((a, b) => b.item_key.localeCompare(a.item_key))[0];
  const nameOf = (code) => { const i = modules.findIndex((x) => x.code === code); return i >= 0 ? modLabel(modules[i], i) : String(code || ""); };
  const back = { backHash: `#/exam/${examId}`, backText: exam.title };
  if (own) {
    const d = own.data;
    const links = Array.isArray(d.collegamenti) ? d.collegamenti : [];
    return mapScreen({
      ...back, titolo: d.titolo || "Mappa dell’esame", eyebrow: "Mappa complessiva", tipo: "concetti", radice: d.radice || { testo: exam.title },
      after: links.length ? [section("Collegamenti tra moduli"), el("div", { class: "group" }, links.map((l) => el("div", { class: "cell no-icon" },
        el("div", { class: "cell-main" },
          el("span", { class: "cell-title", style: "white-space:normal;font-weight:600" }, `${nameOf(l.da)} → ${nameOf(l.a)}`),
          l.testo ? el("span", { class: "cell-sub" }, l.testo) : null))))] : null,
    });
  }
  // nessuna mappa d'esame caricata: la compongo dalle mappe dei moduli
  const byModule = {};
  for (const mp of maps) if (mp.module_id && mp.data.tipo !== "esercizi" && !byModule[mp.module_id]) byModule[mp.module_id] = mp.data;
  const radice = {
    testo: exam.title,
    figli: modules.map((m, idx) => {
      const mp = byModule[m.id];
      return { testo: modLabel(m, idx), nota: mp ? "" : "Mappa non ancora caricata", figli: mp?.radice?.figli || [] };
    }),
  };
  const missing = modules.filter((m) => !byModule[m.id]).length;
  mapScreen({
    ...back, titolo: "Mappa dell’esame", eyebrow: "Mappa complessiva", tipo: "concetti", radice,
    after: el("div", { class: "card", style: "gap:8px" },
      el("div", { class: "card-row" }, bubble(ICON.sparkle, "t-purple", "lg"),
        el("div", { class: "cell-main" },
          el("span", { style: "font-size:16px;font-weight:600" }, "Creata unendo le mappe dei moduli"),
          el("span", { class: "cell-sub" }, missing ? `${plural(missing, "modulo", "moduli")} senza mappa. ` : "",
            "Per una mappa con i collegamenti tra moduli, scrivi “mappa esame” nel progetto Claude e carica il file."))),
      el("button", { class: "btn btn-tinted btn-block", onclick: () => openImport(examId, () => route()) }, icon(ICON.upload), "Carica mappa dell’esame")),
  });
}

function mapScreen({ backHash, backText, titolo, eyebrow, tipo, radice, after }) {
  const isEx = tipo === "esercizi";
  let uid = 0;
  const norm = (n, depth, branch, parent) => {
    const node = { id: uid++, testo: String(n.testo ?? n.titolo ?? ""), nota: String(n.nota || ""), etichetta: String(n.etichetta || ""), depth, branch, parent };
    const kids = Array.isArray(n.figli) ? n.figli : Array.isArray(n.children) ? n.children : [];
    node.figli = kids.map((c, i) => norm(c, depth + 1, depth === 0 ? i : branch, node));
    return node;
  };
  const root = norm(radice, 0, -1, null);
  const views = isEx ? [["percorso", "Percorso"], ["cascata", "Schema"]] : [["mappa", "Mappa"], ["cascata", "Cascata"]];
  let view = views[0][0];
  const body = el("div", { class: "map-body" });
  const seg = el("div", { class: "segmented", role: "group", "aria-label": "Vista" });
  const paint = () => {
    seg.replaceChildren(...views.map(([k, l]) => el("button", { "aria-pressed": String(view === k), onclick: () => { view = k; paint(); } }, l)));
    body.replaceChildren();
    if (view === "mappa") drawMindMap(body, root);
    else if (view === "cascata") drawOutline(body, root, isEx);
    else drawPath(body, root);
  };
  mount(nav(backHash, backText), titleBlock(titolo, eyebrow), seg, body, after || null);
  paint();
}

const countAll = (n) => n.figli.reduce((a, c) => a + 1 + countAll(c), 0);
const branchClass = (n) => (n.depth === 0 ? "root" : `br${n.branch % 6}`);

function drawMindMap(container, root) {
  const GAPX = 44, GAPY = 14, PAD = 48;
  const all = []; (function walk(n) { all.push(n); n.figli.forEach(walk); })(root);
  const collapsed = new Set();
  if (all.length > 20) all.forEach((n) => { if (n.depth >= 2 && n.figli.length) collapsed.add(n.id); });
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "map-links"); svg.setAttribute("aria-hidden", "true");
  const canvas = el("div", { class: "map-canvas" }, svg);
  const vp = el("div", { class: "map-viewport", role: "application", "aria-label": "Mappa: trascina per spostarti, pizzica per ingrandire, tocca un ramo per aprirlo o chiuderlo" }, canvas);
  const T = { x: 0, y: 0, k: 1 };
  let W = 0, H = 0;
  const apply = () => { canvas.style.transform = `translate(${T.x}px, ${T.y}px) scale(${T.k})`; };
  const fit = () => {
    const r = vp.getBoundingClientRect();
    T.k = Math.max(0.25, Math.min(1.1, (r.width - 16) / W, (r.height - 16) / H));
    T.x = (r.width - W * T.k) / 2; T.y = (r.height - H * T.k) / 2; apply();
  };
  const toggle = (id) => {
    const n = all.find((x) => x.id === id);
    if (!n || !n.figli.length) return;
    const before = n.el.getBoundingClientRect();
    collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id);
    layout();
    const after = n.el.getBoundingClientRect();
    T.x += before.left - after.left; T.y += before.top - after.top; apply();
  };
  function layout() {
    canvas.querySelectorAll(".mnode").forEach((x) => x.remove());
    svg.replaceChildren();
    const visible = [];
    (function walk(n) { visible.push(n); if (!collapsed.has(n.id)) n.figli.forEach(walk); })(root);
    for (const n of visible) {
      const closed = collapsed.has(n.id) && n.figli.length;
      n.el = el("div", {
        class: `mnode ${branchClass(n)}${n.figli.length ? " has-kids" : ""}${closed ? " closed" : ""}`,
        "data-id": n.id, tabindex: n.figli.length ? "0" : null, role: n.figli.length ? "button" : null,
        "aria-expanded": n.figli.length ? String(!closed) : null,
      }, n.etichetta ? el("span", { class: "mlabel" }, n.etichetta) : null, el("span", { class: "mtext" }, n.testo),
        closed ? el("span", { class: "mcount" }, `+${countAll(n)}`) : null);
      canvas.append(n.el);
    }
    renderMath(canvas);
    for (const n of visible) { n.w = n.el.offsetWidth; n.h = n.el.offsetHeight; }
    const open = (n) => !collapsed.has(n.id) && n.figli.length;
    const weight = (n) => (open(n) ? Math.max(n.h + GAPY, n.figli.reduce((a, c) => a + weight(c), 0)) : n.h + GAPY);
    const kids = open(root) ? root.figli : [];
    const right = [], left = []; let wr = 0, wl = 0;
    kids.forEach((c) => { const w = weight(c); if (wr <= wl) { right.push(c); wr += w; } else { left.push(c); wl += w; } });
    const placeSide = (list, dir) => {
      const colW = {};
      const visit = (n) => { colW[n.depth] = Math.max(colW[n.depth] || 0, n.w); if (open(n)) n.figli.forEach(visit); };
      list.forEach(visit);
      const xAt = {}; let x = root.w / 2 + GAPX;
      for (let dep = 1; colW[dep] != null; dep++) { xAt[dep] = x; x += colW[dep] + GAPX; }
      const put = (n, top) => {
        n.side = dir; n.cy = top + weight(n) / 2; n.x = dir > 0 ? xAt[n.depth] : -xAt[n.depth] - n.w;
        if (open(n)) { let t = n.cy - n.figli.reduce((a, c) => a + weight(c), 0) / 2; n.figli.forEach((c) => { put(c, t); t += weight(c); }); }
      };
      let y = -list.reduce((a, c) => a + weight(c), 0) / 2;
      list.forEach((c) => { put(c, y); y += weight(c); });
    };
    root.x = -root.w / 2; root.cy = 0; root.side = 0;
    placeSide(right, 1); placeSide(left, -1);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of visible) {
      n.y = n.cy - n.h / 2;
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x + n.w); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y + n.h);
    }
    const ox = PAD - minX, oy = PAD - minY;
    W = maxX - minX + PAD * 2; H = maxY - minY + PAD * 2;
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    svg.setAttribute("width", W); svg.setAttribute("height", H);
    for (const n of visible) {
      n.el.style.transform = `translate(${n.x + ox}px, ${n.y + oy}px)`;
      if (!n.parent) continue;
      const p = n.parent;
      const x1 = (n.side > 0 ? p.x + p.w : p.x) + ox, y1 = p.cy + oy;
      const x2 = (n.side > 0 ? n.x : n.x + n.w) + ox, y2 = n.cy + oy;
      const mx = (x1 + x2) / 2;
      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
      path.setAttribute("class", `mlink ${branchClass(n)}`);
      svg.append(path);
    }
  }
  // spostamento, zoom e tocchi
  const pts = new Map();
  let start = null, moved = false, downNode = null;
  const snap = () => {
    const a = [...pts.values()];
    const mid = a.length > 1 ? { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 } : a[0];
    const dist = a.length > 1 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : 0;
    start = { T: { ...T }, mid, dist };
  };
  vp.addEventListener("pointerdown", (e) => {
    vp.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { moved = false; downNode = e.target.closest(".mnode.has-kids"); }
    snap();
  });
  vp.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const a = [...pts.values()];
    const r = vp.getBoundingClientRect();
    if (a.length > 1 && start.dist) {
      const mid = { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 };
      const k = Math.max(0.25, Math.min(3, start.T.k * Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) / start.dist));
      const cx = (start.mid.x - r.left - start.T.x) / start.T.k, cy = (start.mid.y - r.top - start.T.y) / start.T.k;
      T.k = k; T.x = mid.x - r.left - cx * k; T.y = mid.y - r.top - cy * k; moved = true;
    } else {
      const dx = a[0].x - start.mid.x, dy = a[0].y - start.mid.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      if (moved) { T.x = start.T.x + dx; T.y = start.T.y + dy; }
    }
    apply();
  });
  const end = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (!pts.size && !moved && downNode) toggle(Number(downNode.dataset.id));
    if (pts.size) snap();
  };
  vp.addEventListener("pointerup", end);
  vp.addEventListener("pointercancel", end);
  vp.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = vp.getBoundingClientRect();
    const k = Math.max(0.25, Math.min(3, T.k * Math.exp(-e.deltaY * 0.0015)));
    const cx = (e.clientX - r.left - T.x) / T.k, cy = (e.clientY - r.top - T.y) / T.k;
    T.k = k; T.x = e.clientX - r.left - cx * k; T.y = e.clientY - r.top - cy * k; apply();
  }, { passive: false });
  canvas.addEventListener("keydown", (e) => {
    const n = e.target.closest(".mnode.has-kids");
    if (n && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(Number(n.dataset.id)); }
  });
  const tools = el("div", { class: "map-tools" },
    el("button", { class: "btn btn-gray btn-small", onclick: fit }, "Adatta"),
    el("button", { class: "btn btn-gray btn-small", onclick: () => { collapsed.clear(); layout(); fit(); } }, "Apri tutto"),
    el("button", { class: "btn btn-gray btn-small", onclick: () => { root.figli.forEach((c) => c.figli.length && collapsed.add(c.id)); layout(); fit(); } }, "Chiudi"));
  container.append(vp, tools, el("p", { class: "foot center" }, "Tocca un ramo per aprirlo o chiuderlo. Trascina e pizzica per muoverti."));
  layout(); fit();
  // all'apertura: leggibile e centrata sul titolo, anche se la mappa è più grande dello schermo
  if (T.k < 0.72) {
    const r = vp.getBoundingClientRect(), rr = root.el.getBoundingClientRect();
    const cx = (rr.left + rr.width / 2 - r.left - T.x) / T.k, cy = (rr.top + rr.height / 2 - r.top - T.y) / T.k;
    T.k = 0.72; T.x = r.width / 2 - cx * T.k; T.y = r.height / 2 - cy * T.k; apply();
  }
}

function drawOutline(container, root, isEx) {
  const open = new Set();
  (function walk(n) { if (n.depth < 2 && n.figli.length) open.add(n.id); n.figli.forEach(walk); })(root);
  const list = el("div", { class: "group outline" });
  const row = (n) => {
    const has = n.figli.length > 0, isOpen = open.has(n.id);
    const head = el(has ? "button" : "div", {
      class: `orow ${branchClass(n)}`, style: `--depth:${Math.min(n.depth, 6)}`, "aria-expanded": has ? String(isOpen) : null,
      onclick: has ? () => { isOpen ? open.delete(n.id) : open.add(n.id); paint(); } : null,
    },
      has ? el("span", { class: "odisc" + (isOpen ? " open" : ""), html: ICON.chev }) : el("span", { class: "odot" }),
      el("span", { class: "cell-main" },
        el("span", { class: "otext" }, n.etichetta ? el("span", { class: "pill t-gray olabel" }, n.etichetta) : null, n.testo),
        n.nota ? el("span", { class: "cell-sub" }, n.nota) : null),
      has && !isOpen ? el("span", { class: "count t-gray" }, countAll(n)) : null);
    return [head, has && isOpen ? n.figli.map(row) : null];
  };
  const paint = () => { list.replaceChildren(...[row(root)].flat(Infinity).filter(Boolean)); renderMath(list); };
  container.append(list,
    el("div", { class: "row" },
      el("button", { class: "btn btn-gray btn-small grow", onclick: () => { (function w(n) { if (n.figli.length) open.add(n.id); n.figli.forEach(w); })(root); paint(); } }, "Apri tutto"),
      el("button", { class: "btn btn-gray btn-small grow", onclick: () => { open.clear(); open.add(root.id); paint(); } }, "Chiudi tutto")));
  paint();
}

function drawPath(container, root) {
  const path = [root];
  const box = el("div", { style: "display:flex;flex-direction:column;gap:12px" });
  const paint = () => {
    const cur = path[path.length - 1];
    const steps = path.slice(1).map((n, i) => el("div", { class: "cell no-icon" },
      el("div", { class: "cell-main" }, el("span", { class: "cell-sub" }, path[i].testo),
        el("span", { class: "cell-title", style: "font-weight:600" }, n.etichetta || n.testo))));
    const leaf = !cur.figli.length;
    box.replaceChildren(...[
      steps.length ? el("div", { class: "group" }, steps) : null,
      el("div", { class: "card path-card" + (leaf ? " leaf" : "") },
        el("div", { class: "card-row" }, bubble(leaf ? ICON.ok : ICON.question, leaf ? "t-green" : "t-blue", "lg"),
          el("span", { class: "eyebrow" }, leaf ? "Ecco come procedere" : path.length === 1 ? "Parti da qui" : "Poi chiediti")),
        el("p", { class: "question", style: "font-size:21px" }, leaf && cur.etichetta && !cur.testo ? cur.etichetta : cur.testo),
        cur.nota ? el("div", { class: "prose" }, cur.nota) : null),
      leaf ? null : el("div", { class: "options" }, cur.figli.map((c) => el("button", { class: "option", onclick: () => { path.push(c); paint(); } },
        el("span", { class: "txt" }, c.etichetta || c.testo), icon(ICON.chev)))),
      el("div", { class: "row" },
        path.length > 1 ? el("button", { class: "btn btn-gray grow", onclick: () => { path.pop(); paint(); } }, "Indietro") : null,
        path.length > 1 ? el("button", { class: "btn btn-tinted grow", onclick: () => { path.length = 1; paint(); } }, "Ricomincia") : null),
    ].filter(Boolean));
    renderMath(box);
  };
  container.append(box);
  paint();
}

// ---------- avvio ----------
route();
