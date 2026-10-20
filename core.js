'use strict';
// Plot.It: tablas, gráficas y ajustes en el navegador, al estilo de SciDAVis.
// core.js: utilidades, modelo del proyecto, importación y exportación, historial y pestañas.
//
// El proyecto (P) es un objeto JSON plano: así el historial, el autoguardado y el archivo
// .plotit.json son simplemente copias suyas. Las ventanas son tablas o gráficas; las columnas
// y las curvas tienen un id propio, de modo que renombrar o mover columnas no rompe las gráficas.

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#a66bd6', '#e05252'];
const isNum = (v) => typeof v === 'number' && isFinite(v);

let P = null;
const UI = {
  sel: new Map(),   // id de tabla → selección { r0, c0 (ancla), r1, c1 (extremo), extra: [ids de columna] }
  curve: new Map(), // id de gráfica → id de la curva seleccionada
  fit: new Map(),   // id de gráfica → estado del panel de ajuste
  fitSel: new Map(), // id de gráfica → id de la curva de ajuste cuyo resultado se ve
  plotStyle: 'scatter',
  split: null,      // pantalla dividida: { right: [ids de la derecha], act: [activa izq, dcha], focus: 0 | 1, ratio, known }
};

/* ---------- utilidades ---------- */

function toast(msg, ms = 3200) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.h);
  toast.h = setTimeout(() => { el.hidden = true; }, ms);
}

// Diálogo de confirmación con el estilo de la app. Devuelve el `value` del botón pulsado,
// o null si se cierra con Esc o haciendo clic fuera.
function ask({ title, text = '', detail = '', buttons }) {
  const dlg = $('ask');
  $('askTitle').textContent = title;
  $('askText').textContent = text;
  $('askDetail').textContent = detail;
  const box = $('askActions');
  box.innerHTML = '';
  return new Promise((resolve) => {
    const finish = (v) => {
      dlg.removeEventListener('close', onClose);
      dlg.removeEventListener('click', onBackdrop);
      if (dlg.open) dlg.close();
      resolve(v);
    };
    const onClose = () => finish(null);
    const onBackdrop = (e) => {
      if (e.target !== dlg) return;
      const r = dlg.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) finish(null);
    };
    let focus = null;
    for (const b of buttons) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'btn' + (b.kind ? ' ' + b.kind : '');
      el.textContent = b.label;
      el.addEventListener('click', () => finish(b.value));
      box.appendChild(el);
      if (b.focus) focus = el;
    }
    dlg.addEventListener('close', onClose);
    dlg.addEventListener('click', onBackdrop);
    dlg.showModal();
    (focus || box.lastChild).focus();
  });
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Número para leer (resultados, estadística): 6 cifras significativas.
function fmtNum(v, digits = 6) {
  if (v === null || v === undefined || Number.isNaN(v)) return '–';
  if (!isFinite(v)) return v > 0 ? '∞' : '−∞';
  if (v === 0) return '0';
  const a = Math.abs(v);
  const s = a >= 1e6 || a < 1e-4 ? v.toExponential(digits - 1).replace(/\.?0+e/, 'e') : String(+v.toPrecision(digits));
  return s.replace('-', '−');
}
// Valor de una celda tal como se muestra en la tabla.
function fmtCell(v) {
  if (typeof v !== 'number') return v == null ? '' : String(v);
  if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
  return String(+v.toPrecision(10));
}

// Texto → número. Acepta coma decimal ("1,5"). Devuelve null si está vacío y undefined si no
// es un número.
function parseNum(s) {
  if (typeof s === 'number') return s;
  s = String(s).trim();
  if (!s) return null;
  if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return parseFloat(s);
  if (/^[-+]?\d*,\d+([eE][-+]?\d+)?$/.test(s)) return parseFloat(s.replace(',', '.'));
  return undefined;
}
function cellFromText(s) {
  const v = parseNum(s);
  return v === undefined ? String(s).trim() : v;
}

function download(name, data, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const fileSafe = (s) => String(s).replace(/[\\/:*?"<>|]+/g, '_').trim() || 'plotit';

/* ---------- modelo del proyecto ---------- */

const nid = () => P.nextId++;
const win = (id) => P.wins.find((w) => w.id === id) || null;
const activeWin = () => win(P.active);
const tablesList = () => P.wins.filter((w) => w.type === 'table');
const graphsList = () => P.wins.filter((w) => w.type === 'graph');
const colById = (tb, id) => (tb && id != null ? tb.cols.find((c) => c.id === id) || null : null);

function newProject() {
  P = { app: 'plot-it', version: 1, name: '', wins: [], log: [], active: null, nextId: 1 };
  const tb = addTable();
  P.active = tb.id;
}

// Nombre libre: "Table1", "Table2"... o, si se da uno concreto, ese, "nombre-2", "nombre-3"...
function uniqueName(base, numbered = true) {
  const used = new Set(P.wins.map((w) => w.name));
  if (numbered) { for (let i = 1; ; i++) if (!used.has(base + i)) return base + i; }
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}-${i}`)) return `${base}-${i}`;
}

function colLetter(n) {
  let s = '';
  for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
function nextColName(tb) {
  const used = new Set(tb.cols.map((c) => c.name));
  for (let i = 0; ; i++) if (!used.has(colLetter(i))) return colLetter(i);
}
function uniqueColName(tb, name, except) {
  const used = new Set(tb.cols.filter((c) => c !== except).map((c) => c.name));
  if (!used.has(name)) return name;
  for (let i = 2; ; i++) if (!used.has(`${name}_${i}`)) return `${name}_${i}`;
}

function makeCol(name, role = 'Y', rows = 0) {
  return { id: nid(), name, role, unit: '', formula: '', w: 110, data: new Array(rows).fill(null) };
}

function addTable({ name, cols, rows = 30, numbered = !name } = {}) {
  const tb = { type: 'table', id: nid(), name: uniqueName(name || 'Table', numbered), rows, cols: [] };
  if (cols) tb.cols = cols;
  else tb.cols = [makeCol('A', 'X', rows), makeCol('B', 'Y', rows)];
  tb.cols.forEach((c) => { c.data.length = rows; for (let i = 0; i < rows; i++) if (c.data[i] === undefined) c.data[i] = null; });
  P.wins.push(tb);
  return tb;
}

function setRows(tb, n) {
  n = Math.max(1, Math.round(n));
  for (const c of tb.cols) {
    if (c.data.length > n) c.data.length = n;
    else while (c.data.length < n) c.data.push(null);
  }
  tb.rows = n;
}

function addGraph(name) {
  const g = {
    type: 'graph', id: nid(), name: uniqueName(name || 'Graph', !name),
    title: '', xlab: '', ylab: '',
    x: { min: null, max: null, log: false }, y: { min: null, max: null, log: false },
    grid: false, legend: 'auto', W: 800, H: 600, font: 18, curves: [],
  };
  P.wins.push(g);
  return g;
}

// Etiqueta de una columna para ejes y leyendas: "nombre (unidad)".
const colLabel = (c) => (c ? (c.unit ? `${c.name} (${c.unit})` : c.name) : '');

// Al borrar columnas o tablas, las curvas que dependían de ellas desaparecen.
function pruneCurves() {
  for (const g of graphsList()) {
    g.curves = g.curves.filter((c) => {
      if (c.kind !== 'data') return true;
      const tb = win(c.table);
      if (!tb || !colById(tb, c.yc)) return false;
      if (c.xc != null && !colById(tb, c.xc)) c.xc = null;
      if (c.ye != null && !colById(tb, c.ye)) c.ye = null;
      if (c.xe != null && !colById(tb, c.xe)) c.xe = null;
      return true;
    });
    // Un ajuste sin sus datos sigue siendo una función válida: se queda, pero suelto.
    for (const c of g.curves) if (c.fitOf != null && !g.curves.some((d) => d.id === c.fitOf)) c.fitOf = null;
  }
}

/* ---------- importación de texto ---------- */

const DELIMS = ['\t', ';', ',', 'ws'];
function splitLine(line, d) {
  if (d === 'ws') return line.trim().split(/\s+/);
  if (!line.includes('"')) return line.split(d).map((s) => s.trim());
  // CSV con comillas: "a, b";c
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === d) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}
const COMMENT = /^\s*(#|%|\/\/|!)/;
const stripComment = (l) => l.replace(COMMENT, '').trim();

// Números de una línea, o null si no es una línea de datos. Con coma como separador no se
// admite la coma decimal. Con `text`, los campos que no son números se guardan como texto
// (una columna de etiquetas, como el "objeto" de los CSV de TrackIt), pero sigue haciendo
// falta al menos un número.
function numericFields(line, d, text = false) {
  if (!line.trim() || COMMENT.test(line)) return null;
  const f = splitLine(line, d);
  const out = [];
  let any = false;
  for (const s of f) {
    if (!s) { out.push(null); continue; }
    if (d === ',' && s.includes(',') && !(text && parseNum(s) === undefined)) return null;
    const v = parseNum(s);
    if (v === undefined || v === null) {
      if (/^[-+]?(nan|inf(inity)?)$/i.test(s)) { out.push(null); continue; }
      if (text) { out.push(s); continue; }
      return null;
    }
    out.push(v);
    any = true;
  }
  return any ? out : null;
}

// Lee un archivo de texto con columnas de números. Elige el separador (tabulador, ;, , o
// espacios) con el que más líneas son numéricas, toma el bloque de datos más largo y, como
// cabecera, la línea que lo precede si tiene el mismo número de campos. Los demás bloques con
// la misma cabecera se añaden detrás: así un log de LAMMPS con varios run da una sola tabla.
// Si no hay ninguna línea solo de números, se repite admitiendo columnas de texto: así los
// archivos que ya se leían salen exactamente igual.
function parseDataText(text) {
  const lines = text.replace(/^﻿/, '').split(/\r\n|\n|\r/);
  return parseDataLines(lines, false) || parseDataLines(lines, true);
}
function parseDataLines(lines, allowText) {
  let best = null;
  for (const d of DELIMS) {
    const parsed = lines.map((l) => numericFields(l, d, allowText));
    const counts = new Map();
    for (const p of parsed) if (p) counts.set(p.length, (counts.get(p.length) || 0) + 1);
    let F = 0, nF = 0;
    for (const [k, v] of counts) if (v > nF || (v === nF && k > F)) { F = k; nF = v; }
    const score = nF * 64 + Math.min(F, 63);
    if (!best || score > best.score) best = { d, parsed, F, score };
  }
  if (!best || !best.F) return null;
  const { d, parsed, F } = best;
  // Bloques de líneas numéricas seguidas con F campos (las líneas vacías no cortan).
  const blocks = [];
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const p = parsed[i];
    if (p && p.length === F) {
      if (!cur) {
        let h = null;
        for (let j = i - 1; j >= 0; j--) {
          if (!lines[j].trim()) continue;
          // La cabecera puede ir separada con espacios aunque los datos lleven tabuladores.
          const hl = stripComment(lines[j]);
          const f = [splitLine(hl, d).filter((s) => d !== 'ws' || s), splitLine(hl, 'ws')].find((x) => x.length === F);
          if (f && !parsed[j]) h = f.join('\u0001');
          break;
        }
        cur = { header: h, rows: [] };
        blocks.push(cur);
      }
      cur.rows.push(p);
    } else if (lines[i].trim()) cur = null;
  }
  const main = blocks.reduce((a, b) => (b.rows.length > a.rows.length ? b : a));
  const rows = [];
  for (const b of blocks) if (b.header === main.header) rows.push(...b.rows);
  let names = main.header ? main.header.split('\u0001') : null;
  if (names) {
    const seen = new Map();
    names = names.map((n) => {
      n = n.replace(/^"|"$/g, '').trim() || '?';
      const k = (seen.get(n) || 0) + 1;
      seen.set(n, k);
      return k > 1 ? `${n}_${k}` : n;
    });
  }
  return { names, rows, F, delim: d, blocks: blocks.filter((b) => b.header === main.header).length };
}

// ¿Es una columna de error? "err", "sd", "sigma", "x_err", "err_y"... o "dE" justo detrás de "E".
const ERR_NAME = /^(err|errs|error|errors|sigma|sd|std|stdev|stddev|unc|uncertainty|delta)$|[_ .-](err|error|sd|std|sigma)$|^(err|error|sd|std|sigma)[_ .-]/i;
const isErrName = (n, prev) => ERR_NAME.test(n) || (prev != null && (n === 'd' + prev || n === 'Δ' + prev || n === 'δ' + prev));

// Columnas que solo tienen texto (o vacíos).
function textCols(parsed) {
  const out = [];
  for (let j = 0; j < parsed.F; j++) {
    let txt = false, num = false;
    for (const r of parsed.rows) { if (typeof r[j] === 'string') txt = true; else if (r[j] != null) num = true; }
    if (txt && !num) out.push(j);
  }
  return out;
}

// Un archivo con una sola columna de etiquetas que se repiten (el CSV de TrackIt con varios
// objetos) da una tabla por etiqueta, sin esa columna. Si no, una sola parte.
const MAX_GROUPS = 50;
function splitByLabel(parsed) {
  const tc = textCols(parsed);
  if (tc.length !== 1) return [{ parsed }];
  const j = tc[0];
  const groups = new Map();
  for (const r of parsed.rows) {
    const k = r[j] ?? '';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r.filter((_, i) => i !== j));
  }
  if (groups.size < 2 || groups.size > MAX_GROUPS) return [{ parsed }];
  const names = parsed.names && parsed.names.filter((_, i) => i !== j);
  return [...groups].map(([label, rows]) => ({ label, parsed: { ...parsed, names, rows, F: parsed.F - 1 } }));
}

function tableFromParsed(parsed, name) {
  const { rows, F } = parsed;
  const text = new Set(textCols(parsed));
  // X es la primera columna de números; las de texto no tienen papel en las gráficas.
  let xj = 0;
  while (text.has(xj) && xj < F - 1) xj++;
  const cols = [];
  for (let j = 0; j < F; j++) {
    const nm = parsed.names ? parsed.names[j] : colLetter(j);
    const err = j > xj && parsed.names && isErrName(nm, parsed.names[j - 1]);
    const c = makeCol(nm, text.has(j) ? 'none' : F === 1 ? 'Y' : j === xj ? 'X' : err ? 'yErr' : 'Y');
    c.data = rows.map((r) => (r[j] === undefined ? null : r[j]));
    cols.push(c);
  }
  return addTable({ name, cols, rows: rows.length, numbered: false });
}

async function importFiles(files) {
  let last = null, n = 0, added = 0;
  for (const f of files) {
    if (/\.json$/i.test(f.name)) { openProject(f); continue; }
    let parsed = null;
    try { parsed = parseDataText(await f.text()); } catch (e) { parsed = null; }
    if (!parsed || !parsed.rows.length) { toast(t('import_none', { name: f.name }), 5000); continue; }
    const base = f.name.replace(/\.[^.]+$/, '') || 'data';
    const parts = splitByLabel(parsed);
    for (const part of parts) last = tableFromParsed(part.parsed, part.label ? `${base} · ${part.label}` : base);
    added += parts.length;
    if (!P.name) P.name = base;
    n++;
    if (parts.length > 1) toast(t('import_split', { name: f.name, n: parts.length }), 5000);
    else toast(t('import_ok', { name: f.name, rows: parsed.rows.length, cols: parsed.F, blocks: parsed.blocks }), 5000);
  }
  if (!last) return;
  dropUnusedFirstTable(last, added);
  P.active = last.id;
  hist.commit();
  renderAll();
  if (n > 1) toast(t('import_many', { n }), 4000);
}

// Si el proyecto solo tenía la tabla vacía del principio, se quita al importar. `added` son
// las ventanas recién creadas (un archivo puede dar varias tablas).
function dropUnusedFirstTable(except, added = 1) {
  const first = P.wins[0];
  if (P.wins.length === 1 + added && first !== except && first.type === 'table' && !tableHasData(first)) {
    P.wins.splice(0, 1);
  }
}
const tableHasData = (tb) => tb.cols.some((c) => c.data.some((v) => v !== null && v !== ''));

/* ---------- exportación CSV ---------- */

async function exportCsv(tb) {
  const choice = await ask({
    title: t('csv_title'), text: t('csv_text'), detail: t('csv_detail'),
    buttons: [
      { label: t('cancel'), value: null },
      { label: t('csv_std'), value: 'std' },
      { label: t('csv_excel'), value: 'excel', kind: 'primary', focus: true },
    ],
  });
  if (!choice) return;
  const excel = choice === 'excel', sep = excel ? ';' : ',';
  const cell = (v) => {
    if (v == null) return '';
    if (typeof v === 'number') { const s = String(v); return excel ? s.replace('.', ',') : s; }
    return /[;,"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const lines = [tb.cols.map((c) => cell(colLabel(c))).join(sep)];
  let last = tb.rows - 1;
  while (last > 0 && tb.cols.every((c) => c.data[last] == null)) last--;
  for (let r = 0; r <= last; r++) lines.push(tb.cols.map((c) => cell(c.data[r])).join(sep));
  download(fileSafe(tb.name) + '.csv', '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
}

/* ---------- deshacer, autoguardado y proyectos ---------- */

const snapshot = () => JSON.stringify(P);
function applySnapshot(s) {
  P = typeof s === 'string' ? JSON.parse(s) : s;
  if (!P.wins.length) { const tb = addTable(); P.active = tb.id; }
  if (!win(P.active)) P.active = P.wins[0].id;
}

// Cada estado es el proyecto entero en JSON; con tablas grandes se guardan menos pasos.
const HIST_MAX_CHARS = 60e6;
const hist = {
  stack: [], pos: -1, saved: 0,
  reset() { this.stack = [snapshot()]; this.pos = 0; this.saved = 0; UI.split = null; this.syncButtons(); },
  commit() {
    const s = snapshot();
    if (this.stack[this.pos] === s) return;
    this.stack = this.stack.slice(0, this.pos + 1);
    this.stack.push(s);
    let total = this.stack.reduce((a, x) => a + x.length, 0);
    while (this.stack.length > 2 && (this.stack.length > 100 || total > HIST_MAX_CHARS)) {
      total -= this.stack.shift().length;
      this.saved--;
    }
    this.pos = this.stack.length - 1;
    this.syncButtons();
    autosave(s);
    renderSide(); // en pantalla dividida, la otra vista refleja el cambio
  },
  go(k) {
    const p = this.pos + k;
    if (p < 0 || p >= this.stack.length) return;
    commitEdit(false);
    this.pos = p;
    applySnapshot(this.stack[p]);
    autosave(this.stack[p]);
    this.syncButtons();
    renderAll();
  },
  dirty() { return this.pos !== this.saved; },
  syncButtons() {
    $('btnUndo').disabled = this.pos <= 0;
    $('btnRedo').disabled = this.pos >= this.stack.length - 1;
  },
};

// Escritura agrupada: localStorage es síncrono y tiene unos 5 MB; si no cabe, no se guarda.
const AUTOSAVE_KEY = 'plot-it:autosave';
let pendingSave = null, saveTimer = 0;
function autosave(s) {
  pendingSave = s;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 600);
}
function flushSave() {
  clearTimeout(saveTimer);
  if (pendingSave == null) return;
  try { localStorage.setItem(AUTOSAVE_KEY, pendingSave); } catch (e) { /* no cabe o no hay almacenamiento */ }
  pendingSave = null;
}
window.addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });

function projectHasContent(d) {
  return d && Array.isArray(d.wins) && (d.wins.length > 1 || d.wins.some((w) => (w.type === 'table' ? tableHasData(w) : w.curves.length)));
}
async function restoreAutosave() {
  let s = null;
  try { s = localStorage.getItem(AUTOSAVE_KEY); } catch (e) { return; }
  if (!s) return;
  let d;
  try { d = JSON.parse(s); } catch (e) { return; }
  if (d.app !== 'plot-it' || !projectHasContent(d)) return;
  const nT = d.wins.filter((w) => w.type === 'table').length, nG = d.wins.length - nT;
  const ok = await ask({
    title: t('resume_title'),
    text: t('resume_text', { t: nT, g: nG }),
    detail: t('resume_detail'),
    buttons: [{ label: t('start_fresh'), value: false }, { label: t('recover'), value: true, kind: 'primary', focus: true }],
  });
  if (!ok) return;
  applySnapshot(d);
  hist.reset();
  renderAll();
}

function saveProject() {
  commitEdit(false);
  const name = fileSafe(P.name || (tablesList()[0] || {}).name || 'plotit');
  download(name + '.plotit.json', JSON.stringify(P), 'application/json');
  hist.saved = hist.pos;
}

function openProject(file) {
  file.text().then((txt) => {
    let d;
    try { d = JSON.parse(txt); } catch (e) { toast(t('proj_invalid')); return; }
    if (d.app !== 'plot-it' || !Array.isArray(d.wins)) { toast(t('proj_not_plotit')); return; }
    d.name = file.name.replace(/\.plotit\.json$|\.json$/i, '');
    applySnapshot(d);
    hist.commit();
    hist.saved = hist.pos;
    renderAll();
    toast(t('proj_loaded'));
  });
}

/* ---------- registro de resultados ---------- */

function logResult(text) {
  P.log.push({ time: new Date().toISOString(), text });
  renderLog();
}
function renderLog() {
  const el = $('logOut');
  el.dataset.empty = t('log_empty');
  el.textContent = P.log.map((e) => {
    const d = new Date(e.time);
    const stamp = `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
    return `[${stamp}]\n${e.text}`;
  }).join('\n\n');
  el.scrollTop = el.scrollHeight;
}

/* ---------- pestañas ---------- */

const ICON_TABLE = '<svg class="ti" viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M1.5 6h13M6 6v7.5M10.5 6v7.5" stroke="currentColor" stroke-width="1.2"/></svg>';
const ICON_GRAPH = '<svg class="ti" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 1.5V14h12.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M4 12Q8 11 13 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

const tabHtml = (w, active) => `<div class="tab${active ? ' active' : ''}" role="tab" data-id="${w.id}" title="${esc(t('tab_t'))}">${w.type === 'table' ? ICON_TABLE : ICON_GRAPH}<span class="tn">${esc(w.name)}</span><button class="tx" data-close="${w.id}" title="${esc(t('close_t'))}">×</button></div>`;
// Con la pantalla dividida, cada ventana tiene sus pestañas: las de la que tiene el foco van en
// #tabs y las de la otra en #tabs2.
const seenTabs = new Set();
function renderTabs() {
  const S = UI.split, fg = S ? S.focus : 0;
  const bars = [[$('tabs'), groupWins(fg), P.active]];
  if (S) bars.push([$('tabs2'), groupWins(1 - fg), S.act[1 - fg]]);
  else $('tabs2').innerHTML = ''; // sin pestañas viejas ocultas con los mismos ids
  for (const [el, ws, act] of bars) {
    // La pestaña que se va (cerrada o pasada a la otra ventana) sale encogiéndose.
    const old = [...el.querySelectorAll('.tab[data-id]')], ids = new Set(ws.map((w) => w.id));
    const lost = old.filter((tb) => !ids.has(+tb.dataset.id));
    el.innerHTML = ws.map((w) => tabHtml(w, w.id === act)).join('');
    if (lost.length === 1 && seenTabs.size) {
      const i = old.indexOf(lost[0]);
      const next = old.slice(i + 1).map((tb) => el.querySelector(`.tab[data-id="${tb.dataset.id}"]`)).find(Boolean);
      shrinkTab(el, lost[0], next || null);
    }
  }
  // Una pestaña recién creada entra creciendo y empuja a la derecha los botones que la siguen
  // (no al arrancar ni al abrir un proyecto, que traen muchas a la vez).
  const fresh = P.wins.filter((w) => !seenTabs.has(w.id));
  const starting = !seenTabs.size;
  fresh.forEach((w) => seenTabs.add(w.id));
  if (!starting && fresh.length === 1) growTab(document.querySelector(`.tablist .tab[data-id="${fresh[0].id}"]`));
  for (const el of [$('tabs'), $('tabs2')]) {
    const cur = el.querySelector('.tab.active');
    if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

function shrinkTab(bar, el, before) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  el.removeAttribute('data-id');
  el.querySelectorAll('[data-close]').forEach((b) => b.removeAttribute('data-close'));
  el.classList.add('leaving');
  bar.insertBefore(el, before);
  const cs = getComputedStyle(el), w = el.getBoundingClientRect().width;
  el.style.overflow = 'hidden';
  el.animate([
    { width: `${w}px`, paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight, opacity: 1 },
    { width: '0px', paddingLeft: '0px', paddingRight: '0px', opacity: 0 },
  ], { duration: 220, easing: 'cubic-bezier(.4, 0, .2, 1)' }).onfinish = () => el.remove();
}

function growTab(el) {
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cs = getComputedStyle(el), w = el.getBoundingClientRect().width;
  el.style.overflow = 'hidden';
  el.animate([
    { width: '0px', paddingLeft: '0px', paddingRight: '0px', opacity: 0 },
    { width: `${w}px`, paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight, opacity: 1 },
  ], { duration: 280, easing: 'cubic-bezier(.2, .8, .2, 1)' }).onfinish = () => { el.style.overflow = ''; };
}

function activate(id) {
  if (P.active === id) return;
  commitEdit(false);
  P.active = id;
  renderAll();
}

async function closeWin(id) {
  const w = win(id);
  if (!w) return;
  if (w.type === 'table') {
    const users = graphsList().filter((g) => g.curves.some((c) => c.table === id));
    if (tableHasData(w) || users.length) {
      const ok = await ask({
        title: t('del_table_title', { name: w.name }),
        text: users.length ? t('del_table_users', { n: users.length }) : t('del_table_text'),
        detail: t('undo_hint'),
        buttons: [{ label: t('cancel'), value: false }, { label: t('delete'), value: true, kind: 'danger-fill', focus: true }],
      });
      if (!ok) return;
    }
  }
  const i = P.wins.indexOf(w);
  P.wins.splice(i, 1);
  pruneCurves();
  if (!P.wins.length) addTable();
  if (P.active === id) P.active = nextAfterClose(id, i);
  hist.commit();
  renderAll();
}

function renameTab(el) {
  const w = win(+el.dataset.id);
  const span = el.querySelector('.tn');
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.value = w.name;
  inp.maxLength = 40;
  span.replaceWith(inp);
  inp.focus();
  inp.select();
  let done = false;
  const finish = (ok) => {
    if (done) return;
    done = true;
    const v = inp.value.trim();
    if (ok && v && v !== w.name) {
      w.name = P.wins.some((o) => o !== w && o.name === v) ? uniqueName(v, false) : v;
      hist.commit();
    }
    renderAll();
  };
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(true);
    else if (e.key === 'Escape') finish(false);
    e.stopPropagation();
  });
  inp.addEventListener('blur', () => finish(true));
}
