'use strict';
// menu.js: la barra de menús (Análisis y Gráfica) y sus diálogos. El panel lateral queda para lo
// rápido; aquí van las opciones detalladas: análisis de datos (FFT, filtros, suavizado,
// interpolación, correlación, histograma, picos) y el formato completo de gráficas y curvas.

/* ---------- menús desplegables ---------- */

const menubar = $('menubar');
function closeMenus() {
  menubar.querySelectorAll('.menu-list').forEach((l) => { l.hidden = true; });
  menubar.querySelectorAll('.menu-btn').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}
function openMenu(btn) {
  const list = btn.nextElementSibling;
  closeMenus();
  // Lo que necesita una gráfica a la vista se desactiva en las tablas.
  list.querySelectorAll('[data-need="graph"]').forEach((b) => { b.disabled = !activeGraph(); });
  list.querySelectorAll('[data-need="split"]').forEach((b) => { b.disabled = !UI.split; });
  list.querySelectorAll('[data-cmd="split"]').forEach((b) => b.setAttribute('aria-checked', String(!!UI.split)));
  list.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
  const first = list.querySelector('button:not(:disabled)');
  if (first) first.focus({ preventScroll: true });
}
menubar.addEventListener('click', (e) => {
  const btn = e.target.closest('.menu-btn');
  if (btn) {
    if (btn.getAttribute('aria-expanded') === 'true') closeMenus(); else openMenu(btn);
    return;
  }
  const item = e.target.closest('.menu-list button');
  if (!item) return;
  closeMenus();
  commitEdit(false);
  if (item.dataset.an) openAnalysis(item.dataset.an);
  else menuCommand(item.dataset.cmd);
});
// Con un menú abierto, pasar el ratón por otro botón lo abre (como en un programa de escritorio).
menubar.addEventListener('pointerover', (e) => {
  const btn = e.target.closest('.menu-btn');
  if (btn && menubar.querySelector('.menu-list:not([hidden])') && btn.getAttribute('aria-expanded') !== 'true') openMenu(btn);
});
menubar.addEventListener('keydown', (e) => {
  const list = e.target.closest('.menu-list');
  if (e.key === 'Escape') { const b = list && list.previousElementSibling; closeMenus(); if (b) b.focus(); return; }
  if (!list || !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
  e.preventDefault();
  const items = [...list.querySelectorAll('button:not(:disabled)')];
  const i = items.indexOf(document.activeElement);
  items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
});
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#menubar')) closeMenus(); });

function menuCommand(cmd) {
  const g = activeGraph();
  if (cmd === 'gformat' && g) openGraphFormat();
  else if (cmd === 'cformat' && g) openCurveFormat();
  else if (cmd === 'autoscale') autoscale();
  else if (cmd === 'png' && g) exportPng(g);
  else if (cmd === 'svg' && g) exportSvg(g);
  else if (cmd === 'split') splitToggle();
  else if (cmd === 'swap') splitSwap();
}

/* ---------- menú contextual de la gráfica ---------- */

// Clic derecho en la gráfica: los menús Análisis y Gráfica como submenús, y abrir la imagen en
// una pestaña nueva o guardarla. Si el clic cae sobre un punto, su curva queda seleccionada.
const ctxMenu = $('ctxMenu');
gview.addEventListener('contextmenu', (e) => {
  const g = activeGraph();
  if (!g) return;
  e.preventDefault();
  stopScaleAnim();
  $('gtip').hidden = true;
  const hit = gGeom && nearestPoint(toPage(e));
  if (hit && UI.curve.get(g.id) !== hit.s.c.id) { UI.curve.set(g.id, hit.s.c.id); syncCurvesPanel(); }
  openCtxMenu(e.clientX, e.clientY);
});
function openCtxMenu(x, y) {
  const [an, gr] = menubar.querySelectorAll('.menu-list');
  const sub = (label, list) => `<div class="ctx-sub"><button role="menuitem" aria-haspopup="menu">${esc(label)}</button><div class="menu-list" role="menu">${list.innerHTML}</div></div>`;
  showCtxMenu(sub(t('m_analysis'), an) + sub(t('m_graph'), gr) + '<hr>' +
    `<button role="menuitem" data-ctx="open">${esc(t('ctx_open'))}</button>` +
    `<button role="menuitem" data-ctx="save">${esc(t('ctx_save'))}</button>`, x, y);
}
function showCtxMenu(html, x, y) {
  closeMenus();
  ctxMenu.innerHTML = html;
  ctxMenu.querySelectorAll('button').forEach((b) => { b.disabled = false; });
  ctxMenu.hidden = false;
  // Dentro de la ventana; si no caben los submenús a la derecha, se abren a la izquierda.
  const r = ctxMenu.getBoundingClientRect();
  const left = Math.min(x, innerWidth - r.width - 4), top = Math.min(y, innerHeight - r.height - 4);
  ctxMenu.style.left = Math.max(4, left) + 'px';
  ctxMenu.style.top = Math.max(4, top) + 'px';
  ctxMenu.classList.toggle('flip', left + 2 * r.width + 40 > innerWidth);
  ctxMenu.querySelector('button').focus({ preventScroll: true });
}
function closeCtxMenu() { ctxMenu.hidden = true; }
function openSub(sub) {
  ctxMenu.querySelectorAll('.ctx-sub').forEach((s) => s.classList.toggle('open', s === sub));
  if (!sub) return;
  // El submenú no debe salirse por abajo.
  const list = sub.querySelector('.menu-list');
  list.style.top = '';
  const r = list.getBoundingClientRect();
  if (r.bottom > innerHeight - 4) list.style.top = `${-5 - (r.bottom - innerHeight + 4)}px`;
}
ctxMenu.addEventListener('pointerover', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const sub = b.parentElement.classList.contains('ctx-sub') ? b.parentElement : b.closest('.ctx-sub');
  openSub(sub);
  if (!b.disabled) b.focus({ preventScroll: true });
});
ctxMenu.addEventListener('click', (e) => {
  const item = e.target.closest('button');
  if (!item) return;
  if (item.parentElement.classList.contains('ctx-sub')) { openSub(item.parentElement); item.nextElementSibling.querySelector('button').focus(); return; }
  closeCtxMenu();
  const g = activeGraph();
  if (item.dataset.an) openAnalysis(item.dataset.an);
  else if (item.dataset.cmd) menuCommand(item.dataset.cmd);
  else if (item.dataset.ctx === 'open' && g) openImageTab(g);
  else if (item.dataset.ctx === 'save' && g) saveImageAs(g);
  else if (/^(col|row)/.test(item.dataset.ctx)) gridCtxCommand(item.dataset.ctx, +item.dataset.c);
  else if (item.dataset.ctx === 'beside') openBeside(+item.dataset.id);
  else if (item.dataset.ctx === 'unsplit') splitClose();
  else if (item.dataset.ctx === 'rename') { const el = document.querySelector(`.tablist .tab[data-id="${item.dataset.id}"]`); if (el) renameTab(el); }
  else if (item.dataset.ctx === 'closewin') closeWin(+item.dataset.id);
});
ctxMenu.addEventListener('keydown', (e) => {
  const b = document.activeElement, level = b && b.closest('.menu-list');
  if (e.key === 'Escape') { e.preventDefault(); closeCtxMenu(); return; }
  if (!level) return;
  const items = [...level.children].map((el) => (el.classList.contains('ctx-sub') ? el.firstElementChild : el)).filter((el) => el.tagName === 'BUTTON');
  const i = items.indexOf(b);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
  } else if (e.key === 'ArrowRight' && b.parentElement.classList.contains('ctx-sub')) {
    e.preventDefault();
    openSub(b.parentElement);
    b.nextElementSibling.querySelector('button').focus();
  } else if (e.key === 'ArrowLeft' && level !== ctxMenu) {
    e.preventDefault();
    const s = level.parentElement;
    openSub(null);
    s.firstElementChild.focus();
  }
});
document.addEventListener('pointerdown', (e) => { if (!ctxMenu.hidden && !ctxMenu.contains(e.target)) closeCtxMenu(); });
window.addEventListener('blur', closeCtxMenu);
window.addEventListener('resize', closeCtxMenu);

// La imagen PNG en una pestaña nueva (la ventana se abre ya, dentro del clic, para que el
// navegador no la bloquee). El fondo a cuadros deja ver si la gráfica es transparente.
function openImageTab(g) {
  const w = window.open('', '_blank');
  if (!w) { toast(t('ctx_blocked'), 5000); return; }
  const url = pngCanvas(g).toDataURL('image/png');
  w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(g.name)}.png</title>` +
    '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#2a2a2a">' +
    `<img src="${url}" alt="${esc(g.name)}" width="${g.W}" style="max-width:100%;height:auto;background:repeating-conic-gradient(#e6e6e6 0 25%,#fff 0 50%) 0 0/16px 16px">`);
  w.document.close();
}

// Guardar como: el cuadro del sistema para elegir carpeta, nombre y formato (PNG o SVG, según la
// extensión). Si el navegador no lo tiene, se descarga el PNG como con el botón.
async function saveImageAs(g) {
  if (!window.showSaveFilePicker) { exportPng(g); return; }
  let h;
  try {
    h = await window.showSaveFilePicker({
      suggestedName: fileSafe(g.name) + '.png',
      types: [{ description: 'PNG', accept: { 'image/png': ['.png'] } }, { description: 'SVG', accept: { 'image/svg+xml': ['.svg'] } }],
    });
  } catch (err) {
    if (err.name !== 'AbortError') exportPng(g);
    return;
  }
  try {
    const data = /\.svg$/i.test(h.name)
      ? new Blob([svgString(g)], { type: 'image/svg+xml' })
      : await new Promise((res) => pngCanvas(g).toBlob(res, 'image/png'));
    const out = await h.createWritable();
    await out.write(data);
    await out.close();
    toast(t('ctx_saved', { name: h.name }), 3000);
  } catch (err) {
    toast(t('ctx_save_err', { msg: err.message || String(err) }), 6000);
  }
}

/* ---------- formularios de los diálogos ---------- */

// Un campo: { k, type: 'num' | 'int' | 'sel' | 'chk' | 'color' | 'ocolor' | 'text', label, opts: [[valor, texto]],
// ph, attrs, wide }. 'ocolor' es un color opcional: con la casilla marcada vale null (= el de la curva).
function inputHtml(f, v) {
  const a = f.attrs || '';
  if (f.type === 'sel') return `<select data-k="${f.k}" data-type="sel">${f.opts.map(([o, l]) => opt(o, l, v ?? '')).join('')}</select>`;
  if (f.type === 'chk') return `<input type="checkbox" data-k="${f.k}" data-type="chk"${v ? ' checked' : ''}>`;
  if (f.type === 'color') return `<input type="color" data-k="${f.k}" data-type="color" value="${esc(v || '#000000')}">`;
  if (f.type === 'ocolor') {
    return `<span class="ocolor" data-k="${f.k}" data-type="ocolor"><input type="color" value="${esc(v || f.def || '#000000')}"${v ? '' : ' disabled'}>` +
      `<label class="chk"><input type="checkbox"${v ? '' : ' checked'}> <span>${esc(f.same || t('fmt_same'))}</span></label></span>`;
  }
  if (f.type === 'text') return `<input type="text" data-k="${f.k}" data-type="text" value="${esc(v ?? '')}"${a}>`;
  const step = f.type === 'int' ? '1' : 'any';
  return `<input type="number" data-k="${f.k}" data-type="${f.type}" step="${step}" value="${v ?? ''}" placeholder="${esc(f.ph ?? t('auto'))}"${a}>`;
}
function fieldsHtml(fields, get) {
  return fields.map((f) => (f.type === 'chk'
    ? `<label class="chk${f.wide ? ' wide' : ''}">${inputHtml(f, get(f.k))} <span>${esc(f.label)}</span></label>`
    : `<label${f.wide ? ' class="wide"' : ''}><span>${esc(f.label)}</span>${inputHtml(f, get(f.k))}</label>`)).join('');
}
function readInput(el) {
  const type = el.dataset.type;
  if (type === 'chk') return el.checked;
  if (type === 'ocolor') return el.querySelector('input[type=checkbox]').checked ? null : el.querySelector('input[type=color]').value;
  if (type === 'num' || type === 'int') {
    const v = parseFloat(String(el.value).replace(',', '.'));
    return isFinite(v) ? (type === 'int' ? Math.round(v) : v) : null;
  }
  if (type === 'sel') return el.value === '' ? null : /^-?\d+$/.test(el.value) ? +el.value : el.value;
  return el.value;
}
function readFields(root) {
  const o = {};
  root.querySelectorAll('[data-k]').forEach((el) => { o[el.dataset.k] = readInput(el); });
  return o;
}
// La casilla de un color opcional activa o desactiva su selector.
document.addEventListener('change', (e) => {
  const oc = e.target.closest('.ocolor');
  if (oc && e.target.type === 'checkbox') oc.querySelector('input[type=color]').disabled = e.target.checked;
});
// Caminos tipo 'x.min' dentro de un objeto.
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setPath(o, p, v) {
  const ks = p.split('.');
  const last = ks.pop();
  const tgt = ks.reduce((a, k) => a[k] || (a[k] = {}), o);
  tgt[last] = v;
}

/* ---------- diálogo de análisis ---------- */

const anDlg = $('anDlg');
const AN = { op: null };
const anLast = {}; // opciones usadas por última vez en cada análisis

function anFields(op) {
  const o = (k) => [k, t('an_o_' + k)];
  const F = {
    fft: [
      { k: 'window', type: 'sel', label: t('an_f_window'), opts: ['hann', 'hamming', 'blackman', 'rect'].map(o), def: 'hann' },
      { k: 'demean', type: 'chk', label: t('an_f_demean'), def: true },
    ],
    filter: [
      { k: 'ftype', type: 'sel', label: t('an_f_ftype'), opts: ['low', 'high', 'band', 'stop'].map(o), def: 'low', wide: true },
      { k: 'f1', type: 'num', label: t('an_f_f1'), ph: '' },
      { k: 'f2', type: 'num', label: t('an_f_f2'), ph: '' },
    ],
    smooth: [
      { k: 'method', type: 'sel', label: t('an_f_method'), opts: ['sg', 'avg'].map(o), def: 'sg', wide: true },
      { k: 'win', type: 'int', label: t('an_f_win'), def: 9, attrs: ' min="3" step="2"' },
      { k: 'order', type: 'int', label: t('an_f_order'), def: 2, attrs: ' min="0" max="10"' },
    ],
    interp: [
      { k: 'imethod', type: 'sel', label: t('an_f_method'), opts: ['spline', 'linear'].map(o), def: 'spline' },
      { k: 'npts', type: 'int', label: t('an_f_npts'), def: 500, attrs: ' min="2" max="100000"' },
      { k: 'from', type: 'num', label: t('an_f_from') },
      { k: 'to', type: 'num', label: t('an_f_to') },
    ],
    corr: [{ k: 'cmode', type: 'sel', label: t('an_f_cmode'), opts: ['auto', 'cross'].map(o), def: 'auto', wide: true }],
    hist: [
      { k: 'bins', type: 'int', label: t('an_f_bins'), attrs: ' min="1" max="1000"' },
      { k: 'hy', type: 'sel', label: t('an_f_hy'), opts: ['count', 'density'].map(o), def: 'count' },
      { k: 'from', type: 'num', label: t('an_f_from') },
      { k: 'to', type: 'num', label: t('an_f_to') },
    ],
    peaks: [
      { k: 'ptype', type: 'sel', label: t('an_f_ptype'), opts: ['max', 'min'].map(o), def: 'max', wide: true },
      { k: 'prom', type: 'num', label: t('an_f_prom'), def: 5, ph: '' },
      { k: 'dist', type: 'num', label: t('an_f_dist'), ph: '0' },
    ],
  };
  return F[op] || [];
}

const hasNum = (c) => c && c.data.some(isNum);

// Datos de partida: la columna seleccionada de la tabla a la vista (y sus filas si hay varias
// marcadas), o la curva seleccionada de la gráfica, o la primera Y con números.
function anDefault() {
  const w = activeWin();
  let tb = null, col = null, r0 = null, r1 = null;
  if (w && w.type === 'table') {
    tb = w;
    const c = curCol(w);
    col = c && c.role !== 'X' && hasNum(c) ? c : w.cols.find((k) => k.role === 'Y' && hasNum(k)) || c;
    const R = selRect(selOf(w));
    if (R.ra !== R.rb) { r0 = R.ra; r1 = R.rb; }
  } else if (w && w.type === 'graph') {
    const id = UI.curve.get(w.id);
    const c = w.curves.find((k) => k.id === id && k.kind === 'data') || w.curves.find((k) => k.kind === 'data');
    if (c) { tb = win(c.table); col = colById(tb, c.yc); }
  }
  if (!tb || !hasNum(col)) {
    r0 = r1 = null;
    tb = tablesList().find((k) => k.cols.some((c) => c.role !== 'X' && hasNum(c)));
    col = tb && tb.cols.find((c) => c.role !== 'X' && hasNum(c));
  }
  return tb && col ? { tb, col, r0, r1 } : null;
}

function openAnalysis(op) {
  if (op === 'deriv' || op === 'integ') { anQuick(op); return; }
  const src = anDefault();
  if (!src) { toast(t('an_err_nocol'), 5000); return; }
  AN.op = op;
  $('anTitle').textContent = t('an_' + op).replace(/…$/, '');
  $('anDesc').textContent = t('an_d_' + op);
  const tables = tablesList();
  $('anSrc').innerHTML =
    `<label><span>${esc(t('an_table'))}</span><select id="anTb">${tables.map((w) => opt(w.id, w.name, src.tb.id)).join('')}</select></label>` +
    `<label><span>${esc(t(op === 'hist' ? 'an_col_v' : 'an_col'))}</span><select id="anCol"></select></label>` +
    `<label class="wide" id="anCol2Wrap"><span>${esc(t('an_col2'))}</span><select id="anCol2"></select></label>` +
    `<label><span>${esc(t('an_rows'))}</span><input type="number" id="anR0" min="1" step="1"></label>` +
    `<label><span>${esc(t('an_to'))}</span><input type="number" id="anR1" min="1" step="1"></label>`;
  anFillCols(src.col);
  $('anR0').value = src.r0 != null ? src.r0 + 1 : 1;
  $('anR1').value = src.r1 != null ? src.r1 + 1 : src.tb.rows;
  const last = anLast[op] || {};
  $('anOpts').innerHTML = fieldsHtml(anFields(op), (k) => (k in last ? last[k] : anFields(op).find((f) => f.k === k).def));
  $('anOpts').hidden = !anFields(op).length;
  $('anPlot').checked = last.plot ?? true;
  $('anErr').hidden = true;
  anSync();
  anDlg.showModal();
}

function anFillCols(prefer) {
  const tb = win(+$('anTb').value);
  const cols = tb.cols.filter((c) => hasNum(c));
  const pick = cols.includes(prefer) ? prefer : cols.find((c) => c.role === 'Y') || cols[0];
  $('anCol').innerHTML = cols.map((c) => opt(c.id, colLabel(c), pick && pick.id)).join('');
  const second = cols.find((c) => c !== pick && c.role === 'Y') || cols.find((c) => c !== pick);
  $('anCol2').innerHTML = cols.map((c) => opt(c.id, colLabel(c), second && second.id)).join('');
}

// Línea informativa (X, puntos, paso) y campos que dependen de otros.
function anSync() {
  const op = AN.op, v = readFields($('anOpts'));
  $('anCol2Wrap').hidden = !(op === 'corr' && v.cmode === 'cross');
  if (op === 'filter') $('anOpts').querySelector('[data-k="f2"]').disabled = !(v.ftype === 'band' || v.ftype === 'stop');
  if (op === 'smooth') $('anOpts').querySelector('[data-k="order"]').disabled = v.method !== 'sg';
  const D = anInput();
  if (!D) { $('anInfo').textContent = ''; return; }
  const parts = [t('an_info_n', { n: D.x.length })];
  parts.push(D.xc ? `X = ${colLabel(D.xc)}` : t('an_info_rowx'));
  if (op !== 'hist' && D.x.length > 1) {
    const dt = uniformStep(D.x);
    if (dt) {
      parts.push(t('an_info_step', { dt: fmtNum(dt) }));
      if (op === 'fft' || op === 'filter') parts.push(t('an_info_nyq', { f: fmtNum(1 / (2 * dt)), df: fmtNum(1 / (D.x.length * dt)) }));
    } else parts.push(t(op === 'fft' ? 'an_info_resample' : 'an_info_uneven'));
  }
  $('anInfo').textContent = parts.join(' · ');
}

// Lee la tabla, la columna y las filas elegidas: x e y solo de las filas con números.
function anInput() {
  const tb = win(+$('anTb').value), col = tb && colById(tb, +$('anCol').value);
  if (!col) return null;
  const r0 = clamp((parseInt($('anR0').value, 10) || 1) - 1, 0, tb.rows - 1);
  const r1 = clamp((parseInt($('anR1').value, 10) || tb.rows) - 1, r0, tb.rows - 1);
  let xc = xFor(tb, col);
  if (xc === col) xc = null;
  const col2 = AN.op === 'corr' ? colById(tb, +$('anCol2').value) : null;
  const rows = [];
  for (let r = r0; r <= r1; r++) {
    const xv = xc ? xc.data[r] : r + 1;
    if (AN.op === 'hist' ? isNum(col.data[r]) : isNum(xv) && isNum(col.data[r]) && (!col2 || $('anCol2Wrap').hidden || isNum(col2.data[r]))) rows.push(r);
  }
  return {
    tb, col, xc, col2, rows, r0, r1,
    x: rows.map((r) => (xc ? xc.data[r] : r + 1)), y: rows.map((r) => col.data[r]), y2: col2 ? rows.map((r) => col2.data[r]) : null,
  };
}

anDlg.addEventListener('change', (e) => {
  if (e.target.id === 'anTb') anFillCols(null);
  $('anErr').hidden = true;
  anSync();
});
anDlg.addEventListener('input', (e) => { if (e.target.id === 'anR0' || e.target.id === 'anR1') anSync(); });
anDlg.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); anRun(); }
});
$('anCancel').addEventListener('click', () => anDlg.close());
$('anRun').addEventListener('click', () => anRun());

function anFail(msg) { $('anErr').textContent = msg; $('anErr').hidden = false; }

// Columna nueva con los valores dados en las filas indicadas.
function colFrom(name, role, values, unit = '') {
  const c = makeCol(name, role);
  c.data = Array.from(values, (v) => (v != null && isFinite(v) ? +(+v).toPrecision(15) : null));
  c.unit = unit;
  return c;
}
// Gráficas donde ya está dibujada una columna (la activa primero).
function graphsShowing(tb, col) {
  const gs = graphsList().filter((g) => g.curves.some((c) => c.kind === 'data' && c.table === tb.id && c.yc === col.id));
  const a = activeGraph();
  return a && gs.includes(a) ? [a, ...gs.filter((g) => g !== a)] : gs;
}
function resultCurve(g, tb, y, style, extra) {
  const c = makeDataCurve(g, tb, y, style);
  c.ye = c.xe = null;
  Object.assign(c, extra || {});
  g.curves.push(c);
  UI.curve.set(g.id, c.id);
  return c;
}
// Resultado que se compara con los datos: a la gráfica donde ya están, o a una nueva con ambos.
function plotOver(D, tb, y, style, extra) {
  let g = graphsShowing(D.tb, D.col)[0];
  if (!g) {
    g = addGraph();
    const c0 = makeDataCurve(g, D.tb, D.col, 'scatter');
    g.curves.push(c0);
    g.xlab = D.xc ? colLabel(D.xc) : t('row_number');
    g.ylab = colLabel(D.col);
  }
  resultCurve(g, tb, y, style, extra);
  return g;
}
// Resultado con otros ejes (espectro, correlación, histograma): gráfica nueva.
function plotNew(tb, y, style, extra) {
  const g = addGraph();
  resultCurve(g, tb, y, style, extra);
  const x = xFor(tb, y);
  g.xlab = x ? colLabel(x) : t('row_number');
  g.ylab = colLabel(y);
  return g;
}

function anRun() {
  const op = AN.op, v = readFields($('anOpts')), D = anInput();
  if (!D) { anFail(t('an_err_nocol')); return; }
  const plot = $('anPlot').checked;
  anLast[op] = { ...v, plot };
  const n = D.x.length, src = `${D.tb.name}: ${D.col.name}`;
  const xu = D.xc && D.xc.unit ? D.xc.unit : '', xname = D.xc ? D.xc.name : 'i';
  let res;
  try {
    res = AN_RUN[op](D, v, { n, src, xu, xname, plot });
  } catch (e) {
    anFail(e.userMsg || String(e.message || e));
    return;
  }
  if (!res) return;
  anDlg.close();
  P.active = res.g ? res.g.id : res.show.id;
  hist.commit();
  renderAll();
  logResult(res.log);
  toast(res.toast || res.log, 6500);
}
const userErr = (msg) => Object.assign(new Error(msg), { userMsg: msg });
const need = (n, k) => { if (n < k) throw userErr(t('an_err_few', { n: k })); };

// Cada análisis: calcula, crea su tabla o columna y, si se pide, su gráfica.
const AN_RUN = {
  fft(D, v, c) {
    need(c.n, 4);
    const S = spectrum(D.x, D.y, { window: v.window, demean: v.demean });
    if (!S.amp.some((a) => a > 0)) throw userErr(t('an_err_const'));
    const fu = c.xu ? `1/${c.xu}` : '';
    const cols = [
      colFrom('f', 'X', S.f, fu), colFrom(t('an_c_amp'), 'Y', S.amp, D.col.unit),
      colFrom(t('an_c_phase'), 'none', S.phase, '°'), colFrom('PSD', 'none', S.psd),
    ];
    const tb = addTable({ name: t('an_name_fft', { name: D.col.name }), cols, rows: S.f.length, numbered: false });
    const g = c.plot ? plotNew(tb, cols[1], 'line') : null;
    const log = t('an_log_fft', {
      src: c.src, n: S.n, dt: fmtNum(S.dt), df: fmtNum(S.df), fn: fmtNum(1 / (2 * S.dt)), win: t('an_o_' + v.window),
      res: S.resampled ? t('an_log_resampled') : '', fp: fmtNum(S.fpeak), per: fmtNum(1 / S.fpeak), amp: fmtNum(S.apeak),
    });
    return { g, show: tb, log };
  },

  filter(D, v, c) {
    need(c.n, 4);
    const dt = uniformStep(D.x);
    if (!dt) throw userErr(t('an_err_uneven'));
    const two = v.ftype === 'band' || v.ftype === 'stop';
    if (!(v.f1 >= 0) || (two && !(v.f2 > v.f1))) throw userErr(t('an_err_f'));
    const out = fftFilter(D.y, dt, v.ftype, v.f1, v.f2);
    const data = new Array(D.tb.rows).fill(null);
    D.rows.forEach((r, k) => { data[r] = out[k]; });
    const nc = colFrom(uniqueColName(D.tb, `${D.col.name}_${t('an_c_filt')}`), 'Y', data, D.col.unit);
    insertColAfter(D.tb, D.col, nc);
    const g = c.plot ? plotOver(D, D.tb, nc, 'line', { width: 2 }) : null;
    const fr = two ? `${fmtNum(v.f1)}–${fmtNum(v.f2)}` : fmtNum(v.f1);
    return { g, show: D.tb, log: t('an_log_filter', { src: c.src, type: t('an_o_' + v.ftype), f: fr, col: nc.name }) };
  },

  smooth(D, v, c) {
    const w = v.win;
    const sg = v.method === 'sg';
    if (!(w >= 3) || w % 2 === 0 || w > c.n || (sg && !(v.order >= 0 && v.order < w))) throw userErr(t('an_err_win', { n: c.n }));
    const out = sg ? savgol(D.x, D.y, w, v.order) : movingAverage(D.y, w);
    const data = new Array(D.tb.rows).fill(null);
    D.rows.forEach((r, k) => { data[r] = out[k]; });
    const nc = colFrom(uniqueColName(D.tb, `${D.col.name}_${t('an_c_smooth')}`), 'Y', data, D.col.unit);
    insertColAfter(D.tb, D.col, nc);
    const g = c.plot ? plotOver(D, D.tb, nc, 'line', { width: 2 }) : null;
    const how = sg ? t('an_log_sg', { w, p: v.order }) : t('an_log_avg', { w });
    return { g, show: D.tb, log: t('an_log_smooth', { src: c.src, how, col: nc.name }) };
  },

  interp(D, v, c) {
    const P2 = sortedPairs(D.x, D.y);
    need(P2.x.length, 2);
    const a = v.from ?? P2.x[0], b = v.to ?? P2.x[P2.x.length - 1];
    if (!(b > a)) throw userErr(t('an_err_range'));
    const N = clamp(v.npts || 500, 2, 100000);
    const xs = linspace(a, b, N);
    const ys = (v.imethod === 'linear' ? interpLinear : interpSpline)(P2.x, P2.y, xs);
    const cols = [colFrom(c.xname, 'X', xs, c.xu), colFrom(D.col.name, 'Y', ys, D.col.unit)];
    const tb = addTable({ name: t('an_name_interp', { name: D.col.name }), cols, rows: N, numbered: false });
    const g = c.plot ? plotOver(D, tb, cols[1], 'line', { width: 1.5 }) : null;
    return { g, show: tb, log: t('an_log_interp', { src: c.src, how: t('an_o_' + v.imethod), n: N, a: fmtNum(a), b: fmtNum(b) }) };
  },

  corr(D, v, c) {
    need(c.n, 3);
    const cross = v.cmode === 'cross';
    if (cross && (!D.col2 || D.col2 === D.col)) throw userErr(t('an_err_col2'));
    if (D.y.every((a) => a === D.y[0]) || (cross && D.y2.every((a) => a === D.y2[0]))) throw userErr(t('an_err_const'));
    const dt = uniformStep(D.x);
    const R = correlate(D.y, cross ? D.y2 : D.y, cross);
    const step = dt || 1;
    const lags = R.lag.map((k) => k * step);
    const cols = [colFrom(t('an_c_lag'), 'X', lags, dt ? c.xu : ''), colFrom('r', 'Y', R.r)];
    const tb = addTable({ name: t('an_name_corr', { name: D.col.name }), cols, rows: lags.length, numbered: false });
    const g = c.plot ? plotNew(tb, cols[1], 'line') : null;
    let log;
    const unit = dt ? (c.xu ? ' ' + c.xu : '') : ' ' + t('an_rows_unit');
    if (cross) {
      let best = 0;
      R.r.forEach((r, k) => { if (Math.abs(r) > Math.abs(R.r[best])) best = k; });
      log = t('an_log_cross', { src: c.src, b: D.col2.name, r: fmtNum(R.r[best], 4), lag: fmtNum(lags[best]) + unit });
    } else {
      // Primer cruce por cero y por 1/e (interpolando) e integral de r hasta el primer cero.
      const cut = (lvl) => {
        for (let k = 1; k < R.r.length; k++) if (R.r[k] <= lvl) return lags[k - 1] + ((lags[k] - lags[k - 1]) * (R.r[k - 1] - lvl)) / (R.r[k - 1] - R.r[k]);
        return null;
      };
      const z = cut(0), e1 = cut(Math.exp(-1));
      let tau = 0;
      for (let k = 1; k < R.r.length && R.r[k - 1] > 0; k++) tau += ((Math.max(R.r[k], 0) + R.r[k - 1]) / 2) * (lags[k] - lags[k - 1]);
      log = t('an_log_auto', { src: c.src, z: z == null ? '–' : fmtNum(z) + unit, e: e1 == null ? '–' : fmtNum(e1) + unit, tau: fmtNum(tau) + unit });
    }
    if (!dt) log += ' ' + t('an_log_lagrows');
    return { g, show: tb, log };
  },

  hist(D, v, c) {
    need(c.n, 2);
    if (v.from != null && v.to != null && !(v.to > v.from)) throw userErr(t('an_err_range'));
    const H = histogram(D.y, { bins: v.bins, lo: v.from, hi: v.to });
    const dens = v.hy === 'density';
    const cols = [
      colFrom(D.col.name, 'X', H.center, D.col.unit),
      colFrom(t('an_c_count'), dens ? 'none' : 'Y', H.count),
      colFrom(t('an_c_density'), dens ? 'Y' : 'none', H.density, D.col.unit ? `1/${D.col.unit}` : ''),
    ];
    const tb = addTable({ name: t('an_name_hist', { name: D.col.name }), cols, rows: H.bins, numbered: false });
    const g = c.plot ? plotNew(tb, cols[dens ? 2 : 1], 'bars', { barW: 1, alpha: 0.55 }) : null;
    const st = colStats(D.y);
    return {
      g, show: tb,
      log: t('an_log_hist', { src: c.src, n: H.inside, bins: H.bins, w: fmtNum(H.w), out: H.n - H.inside, mean: fmtNum(st.mean), sd: fmtNum(st.sd) }),
    };
  },

  peaks(D, v, c) {
    need(c.n, 3);
    const P2 = sortedPairs(D.x, D.y);
    const lo = Math.min(...P2.y), hi = Math.max(...P2.y);
    if (!(hi > lo)) throw userErr(t('an_err_const'));
    const minima = v.ptype === 'min';
    const pk = findPeaks(P2.x, P2.y, { minProm: ((v.prom ?? 5) / 100) * (hi - lo), minDist: v.dist || 0, minima });
    if (!pk.length) throw userErr(t('an_none_peaks'));
    const cols = [
      colFrom(c.xname, 'X', pk.map((p) => p.x), c.xu), colFrom(D.col.name, 'Y', pk.map((p) => p.y), D.col.unit),
      colFrom(t('an_c_prom'), 'none', pk.map((p) => p.prom), D.col.unit), colFrom(t('an_c_width'), 'none', pk.map((p) => p.width), c.xu),
    ];
    const tb = addTable({ name: t('an_name_peaks', { name: D.col.name }), cols, rows: pk.length, numbered: false });
    const g = c.plot ? plotOver(D, tb, cols[1], 'scatter', { symbol: minima ? 'triangle' : 'down', size: 12, color: '#e05252' }) : null;
    const list = pk.slice(0, 12).map((p) => `  x = ${fmtNum(p.x)}   y = ${fmtNum(p.y)}   ${t('an_c_prom')} = ${fmtNum(p.prom, 4)}   ${t('an_c_width')} = ${fmtNum(p.width, 4)}`);
    if (pk.length > 12) list.push('  …');
    return { g, show: tb, log: t('an_log_peaks', { src: c.src, n: pk.length }) + '\n' + list.join('\n'), toast: t('an_log_peaks', { src: c.src, n: pk.length }) };
  },
};

// Derivar e integrar desde el menú: van a la tabla de la columna y usan lo del panel.
function anQuick(kind) {
  const s = anDefault();
  if (!s) { toast(t('an_err_nocol'), 5000); return; }
  P.active = s.tb.id;
  const sel = selOf(s.tb);
  sel.c0 = sel.c1 = s.tb.cols.indexOf(s.col);
  sel.r0 = sel.r1 = 0;
  sel.extra = [];
  renderAll();
  calcColumn(kind);
}

/* ---------- formato de la gráfica ---------- */

const gfDlg = $('gfDlg');
let gfSnap = null, gfTab = 'axes';

function gfAxisRows() {
  const dirs = ['in', 'out', 'both', 'none'].map((k) => [k, t('tk_' + k)]);
  const minors = [['', t('auto')], ...Array.from({ length: 10 }, (_, k) => [k, String(k)])];
  return [
    ['fmt_ax_title', { k: 'lab', type: 'text' }],
    ['g_xmin', { k: 'min', type: 'num' }],
    ['g_xmax', { k: 'max', type: 'num' }],
    ['fmt_log', { k: 'log', type: 'chk' }],
    ['fmt_step', { k: 'step', type: 'num' }],
    ['fmt_minor', { k: 'minor', type: 'sel', opts: minors }],
    ['fmt_dir', { k: 'dir', type: 'sel', opts: dirs }],
    ['fmt_mirror', { k: 'mirror', type: 'chk' }],
    ['fmt_numfmt', { k: 'fmt', type: 'sel', opts: ['auto', 'dec', 'sci'].map((k) => [k, t('nf_' + k)]) }],
    ['fmt_dec', { k: 'dec', type: 'int', attrs: ' min="0" max="12"' }],
    ['fmt_labels', { k: 'labels', type: 'chk' }],
  ];
}
function gfOtherFields() {
  const fam = Object.keys(FAMILIES).map((k) => [k, k === 'Times' ? 'Times New Roman' : k === 'Mono' ? 'Consolas' : k]);
  return {
    frame: [
      { k: 'frame', type: 'sel', label: t('fmt_frame'), opts: ['box', 'axes', 'none'].map((k) => [k, t('fr_' + k)]) },
      { k: 'lw', type: 'num', label: t('fmt_lw'), attrs: ' min="0.25" max="10" step="0.25"' },
      { k: 'tickLen', type: 'num', label: t('fmt_ticklen'), attrs: ' min="0" max="40" step="0.5"' },
      { k: 'gridColor', type: 'color', label: t('fmt_gridcolor') },
      { k: 'grid', type: 'chk', label: t('fmt_grid') },
      { k: 'gridMinor', type: 'chk', label: t('fmt_gridminor') },
    ],
    text: [
      { k: 'title', type: 'text', label: t('g_title'), wide: true },
      { k: 'family', type: 'sel', label: t('fmt_family'), opts: fam },
      { k: 'font', type: 'int', label: t('g_font'), attrs: ' min="6" max="60"' },
      { k: 'titleScale', type: 'num', label: t('fmt_titlescale'), attrs: ' min="0.5" max="3" step="0.05"' },
      { k: 'tickScale', type: 'num', label: t('fmt_tickscale'), attrs: ' min="0.4" max="2" step="0.05"' },
      { k: 'legend', type: 'sel', label: t('g_legend'), opts: ['auto', 'tr', 'tl', 'br', 'bl', 'off'].map((k) => [k, t('lg_' + k)]) },
      { k: 'legendScale', type: 'num', label: t('fmt_legendscale'), attrs: ' min="0.4" max="2" step="0.05"' },
      { k: 'legendFrame', type: 'chk', label: t('fmt_legendframe') },
    ],
    page: [
      { k: 'W', type: 'int', label: t('g_w'), attrs: ' min="200" max="4000" step="10"' },
      { k: 'H', type: 'int', label: t('g_h'), attrs: ' min="150" max="4000" step="10"' },
      { k: 'bgColor', type: 'color', label: t('fmt_bg') },
      { k: 'bgNone', type: 'chk', label: t('fmt_bgnone') },
    ],
  };
}

function openGraphFormat(tab) {
  const g = activeGraph();
  if (!g) return;
  gfSnap = JSON.stringify(g);
  if (tab) gfTab = tab;
  gfRender();
  gfDlg.showModal();
}
function gfRender() {
  const g = activeGraph();
  const gd = withDef(g, GRAPH_DEF), A = { x: withDef(g.x, AXIS_DEF), y: withDef(g.y, AXIS_DEF) };
  A.x.lab = g.xlab; A.y.lab = g.ylab;
  const rows = gfAxisRows().map(([lk, f]) => `<tr><th>${esc(t(lk))}</th>${['x', 'y'].map((a) => `<td>${inputHtml({ ...f, k: `${a}.${f.k}` }, A[a][f.k])}</td>`).join('')}</tr>`).join('');
  const O = gfOtherFields();
  const get = (k) => (k === 'bgColor' ? (gd.bg === 'none' ? '#ffffff' : gd.bg) : k === 'bgNone' ? gd.bg === 'none' : gd[k]);
  $('gfBody').innerHTML =
    `<div class="fmt-pane" data-pane="axes"><table class="axtab"><thead><tr><th></th><th>${esc(t('fmt_xaxis'))}</th><th>${esc(t('fmt_yaxis'))}</th></tr></thead><tbody>${rows}</tbody></table></div>` +
    `<div class="fmt-pane grid2" data-pane="frame">${fieldsHtml(O.frame, get)}</div>` +
    `<div class="fmt-pane grid2" data-pane="text">${fieldsHtml(O.text, get)}<p class="hint wide">${t('fmt_text_hint')}</p></div>` +
    `<div class="fmt-pane grid2" data-pane="page">${fieldsHtml(O.page, get)}</div>`;
  gfShowTab(gfTab);
}
function gfShowTab(tab) {
  gfTab = tab;
  gfDlg.querySelectorAll('.fmt-tabs .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  gfDlg.querySelectorAll('.fmt-pane').forEach((p) => { p.hidden = p.dataset.pane !== tab; });
}
// Aplica lo del diálogo a la gráfica en cuanto cambia algo (vista previa en vivo).
function gfApply() {
  const g = activeGraph();
  if (!g) return;
  const v = readFields($('gfBody'));
  for (const [k, val] of Object.entries(v)) {
    if (k === 'x.lab') g.xlab = val;
    else if (k === 'y.lab') g.ylab = val;
    else if (k === 'bgColor' || k === 'bgNone') continue;
    else if (k === 'W' || k === 'H') { if (val >= 100) g[k] = clamp(val, 100, 6000); }
    else if (k === 'font') { if (val >= 4) g.font = clamp(val, 4, 80); }
    else setPath(g, k, val);
  }
  g.bg = v.bgNone ? 'none' : v.bgColor;
  graphRender();
}
gfDlg.addEventListener('input', (e) => { if (e.target.closest('#gfBody') && e.target.type !== 'number') gfApply(); });
gfDlg.addEventListener('change', (e) => { if (e.target.closest('#gfBody')) gfApply(); });
gfDlg.querySelector('.fmt-tabs').addEventListener('click', (e) => { const b = e.target.closest('.seg-btn'); if (b) gfShowTab(b.dataset.tab); });
gfDlg.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); gfApply(); gfOk(); } });
function gfOk() {
  gfApply();
  gfSnap = null;
  gfDlg.close();
  hist.commit();
  renderAll();
}
function gfCancel() {
  const g = activeGraph();
  if (g && gfSnap) { const s = JSON.parse(gfSnap); for (const k of Object.keys(g)) delete g[k]; Object.assign(g, s); }
  gfSnap = null;
  renderAll();
}
$('gfOk').addEventListener('click', gfOk);
$('gfCancel').addEventListener('click', () => { gfCancel(); gfDlg.close(); });
gfDlg.addEventListener('cancel', gfCancel);

/* ---------- formato de las curvas ---------- */

const cfDlg = $('cfDlg');
let cfSnap = null;

// Botón con el dibujo de un símbolo (SVG hecho con el mismo código que la gráfica).
function symbolSvg(sym) {
  const ctx = new SvgCtx(22, 22);
  ctx.beginPath();
  symbolPath(ctx, sym, 11, 11, 6.5);
  if (STROKE_SYMBOLS.has(sym)) { ctx.strokeStyle = 'currentColor'; ctx.lineWidth = 1.8; ctx.stroke(); } else { ctx.fillStyle = 'currentColor'; ctx.fill(); }
  return `<svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true">${ctx.out.join('')}</svg>`;
}

function cfFields(c) {
  const dash = Object.keys(DASHES).map((d) => [d, t('dash_' + d)]);
  if (c.kind === 'func') {
    return [
      { k: 'label', type: 'text', label: t('c_label'), wide: true },
      { k: 'color', type: 'color', label: t('cf_color') },
      { k: 'width', type: 'num', label: t('c_width'), attrs: ' min="0.25" max="20" step="0.25"' },
      { k: 'dash', type: 'sel', label: t('c_dash'), opts: dash },
      { k: 'n', type: 'int', label: t('c_points'), attrs: ' min="10" max="20000" step="10"' },
      { k: 'xmin', type: 'num', label: t('c_xmin') },
      { k: 'xmax', type: 'num', label: t('c_xmax') },
    ];
  }
  return [
    { k: 'label', type: 'text', label: t('c_label'), wide: true },
    { k: 'style', type: 'sel', label: t('c_style'), opts: ['scatter', 'line', 'both', 'bars'].map((s) => [s, t('st_' + s)]) },
    { k: 'color', type: 'color', label: t('cf_color') },
    { sec: t('cf_sec_sym') },
    { k: 'size', type: 'num', label: t('c_size'), attrs: ' min="1" max="60" step="0.5"' },
    { k: 'fill', type: 'sel', label: t('cf_fill'), opts: [['solid', t('cf_solid')], ['hollow', t('cf_hollow')]] },
    { k: 'fillColor', type: 'ocolor', label: t('cf_fillcolor'), def: c.color },
    { k: 'edge', type: 'num', label: t('cf_edge'), attrs: ' min="0" max="10" step="0.25"' },
    { k: 'alpha', type: 'num', label: t('cf_alpha'), attrs: ' min="0" max="1" step="0.05"' },
    { sec: t('cf_sec_line') },
    { k: 'connect', type: 'sel', label: t('cf_connect'), opts: ['straight', 'steps', 'spline'].map((s) => [s, t('cn_' + s)]) },
    { k: 'width', type: 'num', label: t('c_width'), attrs: ' min="0.25" max="20" step="0.25"' },
    { k: 'dash', type: 'sel', label: t('c_dash'), opts: dash },
    { sec: t('cf_sec_err') },
    { k: 'cap', type: 'num', label: t('cf_cap'), attrs: ' min="0" max="30" step="0.5"' },
    { k: 'errWidth', type: 'num', label: t('cf_errwidth'), attrs: ' min="0.25" max="10" step="0.25"' },
    { k: 'errColor', type: 'ocolor', label: t('cf_errcolor'), def: c.color },
    { sec: t('cf_sec_bars') },
    { k: 'barW', type: 'num', label: t('cf_barw'), attrs: ' min="0.05" max="1" step="0.05"' },
  ];
}

function openCurveFormat() {
  const g = activeGraph();
  if (!g || !g.curves.length) { toast(t('no_curves'), 3500); return; }
  cfSnap = JSON.stringify(g.curves);
  cfRender();
  cfDlg.showModal();
}
function cfCurve() {
  const g = activeGraph();
  let id = UI.curve.get(g.id);
  if (!g.curves.some((c) => c.id === id)) id = g.curves[0].id;
  return g.curves.find((c) => c.id === id);
}
function cfRender() {
  const g = activeGraph(), c = cfCurve();
  $('cfCurve').innerHTML = g.curves.map((k) => opt(k.id, curveLabel(g, k), c.id)).join('');
  const f = withDef(c, CURVE_DEF);
  const get = (k) => (k === 'fill' ? (c.fill === false ? 'hollow' : 'solid') : f[k]);
  let h = '';
  if (c.kind === 'data') {
    h += `<div class="wide symgrid" role="group" aria-label="${esc(t('c_symbol'))}">` +
      SYMBOLS.map((s) => `<button type="button" class="symbtn${s === c.symbol ? ' active' : ''}" data-sym="${s}" title="${esc(t('sym_' + s))}">${symbolSvg(s)}</button>`).join('') + '</div>';
  }
  for (const fd of cfFields(c)) {
    if (fd.sec) h += `<div class="subhead wide">${esc(fd.sec)}</div>`;
    else h += fieldsHtml([fd], get);
  }
  $('cfBody').innerHTML = h;
  $('cfBody').querySelectorAll('.symbtn').forEach((b) => { b.style.color = c.color; });
}
function cfApply() {
  const c = cfCurve();
  const v = readFields($('cfBody'));
  for (const [k, val] of Object.entries(v)) {
    if (k === 'fill') c.fill = val !== 'hollow';
    else if (k === 'size') { if (val > 0) c.size = val; }
    else if (k === 'width') { if (val > 0) c.width = val; }
    else if (k === 'n') { if (val >= 10) c.n = clamp(val, 10, 20000); }
    else c[k] = val;
  }
  if (c.kind === 'func') funcCache.clear();
  $('cfBody').querySelectorAll('.symbtn').forEach((b) => { b.style.color = c.color; });
  graphRender();
}
cfDlg.addEventListener('input', (e) => { if (e.target.closest('#cfBody') && e.target.type !== 'number') cfApply(); });
cfDlg.addEventListener('change', (e) => {
  if (e.target.id === 'cfCurve') { UI.curve.set(activeGraph().id, +e.target.value); cfRender(); return; }
  if (e.target.closest('#cfBody')) cfApply();
});
cfDlg.addEventListener('click', (e) => {
  const b = e.target.closest('.symbtn');
  if (!b) return;
  const c = cfCurve();
  c.symbol = b.dataset.sym;
  if (c.style === 'line') c.style = 'both';
  cfDlg.querySelectorAll('.symbtn').forEach((x) => x.classList.toggle('active', x === b));
  const st = $('cfBody').querySelector('[data-k="style"]');
  if (st) st.value = c.style;
  graphRender();
});
cfDlg.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); cfApply(); cfOk(); } });
function cfOk() {
  cfApply();
  cfSnap = null;
  cfDlg.close();
  hist.commit();
  renderAll();
}
function cfCancel() {
  const g = activeGraph();
  if (g && cfSnap) g.curves = JSON.parse(cfSnap);
  cfSnap = null;
  funcCache.clear();
  renderAll();
}
$('cfOk').addEventListener('click', cfOk);
$('cfCancel').addEventListener('click', () => { cfCancel(); cfDlg.close(); });
cfDlg.addEventListener('cancel', cfCancel);

$('btnCurveFmt').addEventListener('click', openCurveFormat);
$('btnGraphFmt').addEventListener('click', () => openGraphFormat());
