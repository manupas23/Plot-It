'use strict';
// table.js: la hoja de datos (rejilla virtualizada, selección, edición, portapapeles) y sus
// paneles: columna, fórmulas, operaciones, nueva gráfica, estadística y tabla.

const ROW_H = 22; // altura de fila, fijada también en style.css
const gridWrap = $('gridWrap'), gridEl = $('grid'), cellEdit = $('cellEdit');
const gridHead = gridEl.tHead, gridBody = gridEl.tBodies[0], gridColsEl = gridEl.querySelector('colgroup');
const ROLE_TAG = { X: 'X', Y: 'Y', xErr: 'xEr', yErr: 'yEr', none: '–' };
// Elementos de una rejilla: la principal y, en pantalla dividida, la de solo lectura de al lado.
const mainGrid = { wrap: gridWrap, table: gridEl, head: gridHead, body: gridBody, cols: gridColsEl };

const activeTable = () => { const w = activeWin(); return w && w.type === 'table' ? w : null; };

function selOf(tb) {
  let s = UI.sel.get(tb.id);
  if (!s) { s = { r0: 0, c0: 0, r1: 0, c1: 0, extra: [] }; UI.sel.set(tb.id, s); }
  const R = tb.rows - 1, C = Math.max(0, tb.cols.length - 1);
  s.r0 = clamp(s.r0, 0, R); s.r1 = clamp(s.r1, 0, R);
  s.c0 = clamp(s.c0, 0, C); s.c1 = clamp(s.c1, 0, C);
  s.extra = s.extra.filter((id) => colById(tb, id));
  return s;
}
const selRect = (s) => ({ ra: Math.min(s.r0, s.r1), rb: Math.max(s.r0, s.r1), ca: Math.min(s.c0, s.c1), cb: Math.max(s.c0, s.c1) });
const curCol = (tb) => tb.cols[selOf(tb).c0];
const isSingleCell = (s) => s.r0 === s.r1 && s.c0 === s.c1 && !s.extra.length;

// Columnas seleccionadas (rectángulo y Ctrl+clic en cabeceras), en el orden de la tabla.
function selectedCols(tb) {
  const s = selOf(tb), R = selRect(s);
  return tb.cols.filter((c, i) => (i >= R.ca && i <= R.cb) || s.extra.includes(c.id));
}
function selectedRows(tb) {
  const R = selRect(selOf(tb));
  return { ra: R.ra, rb: R.rb, n: R.rb - R.ra + 1 };
}

// Columna X de una Y: la X más cercana a su izquierda (o la primera X de la tabla).
function xFor(tb, col) {
  const i = tb.cols.indexOf(col);
  for (let j = i - 1; j >= 0; j--) if (tb.cols[j].role === 'X') return tb.cols[j];
  return tb.cols.find((c) => c.role === 'X' && c !== col) || null;
}
// Columna de error de una Y: la primera con ese papel a su derecha, antes de otra X o Y.
function errFor(tb, col, role) {
  const i = tb.cols.indexOf(col);
  for (let j = i + 1; j < tb.cols.length; j++) {
    const r = tb.cols[j].role;
    if (r === role) return tb.cols[j];
    if (r === 'X' || r === 'Y') break;
  }
  return null;
}

/* ---------- dibujo de la rejilla ---------- */

const rowHeadW = (tb) => Math.max(44, 14 + 8 * String(tb.rows).length);

function gridRenderHead(tb, G = mainGrid) {
  const s = selOf(tb), R = selRect(s), whole = R.ra === 0 && R.rb === tb.rows - 1;
  const rw = rowHeadW(tb);
  G.cols.innerHTML = `<col style="width:${rw}px">` + tb.cols.map((c) => `<col style="width:${c.w}px">`).join('');
  G.table.style.width = rw + tb.cols.reduce((a, c) => a + c.w, 0) + 'px';
  G.head.innerHTML = `<tr><th class="rh" title="${esc(t('select_all'))}"></th>` + tb.cols.map((c, i) => {
    const sel = (whole && i >= R.ca && i <= R.cb) || s.extra.includes(c.id);
    const tip = `${colLabel(c)} · ${t('role_' + c.role)}${c.formula ? '\n= ' + c.formula : ''}`;
    return `<th data-c="${i}" class="${sel ? 'sel' : ''}" title="${esc(tip)}"><div class="ch"><span class="cn">${esc(c.name)}</span><span class="role r-${c.role}">${ROLE_TAG[c.role]}</span></div><div class="cu">${c.unit ? esc(c.unit) : '&nbsp;'}</div><span class="rs" data-rs="${i}"></span></th>`;
  }).join('') + '</tr>';
}

function gridRenderBody(G = mainGrid, tb = activeTable()) {
  if (!tb) return;
  const s = selOf(tb), R = selRect(s);
  const headH = G.head.offsetHeight || 40;
  const top = Math.max(0, G.wrap.scrollTop - headH);
  const first = Math.max(0, Math.floor(top / ROW_H) - 8);
  const last = Math.min(tb.rows - 1, Math.ceil((top + (G.wrap.clientHeight || 600)) / ROW_H) + 8);
  const nc = tb.cols.length;
  const extra = new Set(s.extra.map((id) => tb.cols.findIndex((c) => c.id === id)));
  let h = '';
  if (first > 0) h += `<tr class="spacer"><td colspan="${nc + 1}" style="height:${first * ROW_H}px"></td></tr>`;
  for (let r = first; r <= last; r++) {
    const inR = r >= R.ra && r <= R.rb;
    h += `<tr data-r="${r}"><th class="rh${inR && R.ca === 0 && R.cb === nc - 1 ? ' sel' : ''}">${r + 1}</th>`;
    for (let ci = 0; ci < nc; ci++) {
      const v = tb.cols[ci].data[r];
      let cls = typeof v === 'string' ? 'txt' : '';
      if ((inR && ci >= R.ca && ci <= R.cb) || extra.has(ci)) cls += ' sel';
      if (r === s.r0 && ci === s.c0) cls += ' cur';
      h += cls ? `<td class="${cls}">` : '<td>';
      if (v != null) h += esc(fmtCell(v));
      h += '</td>';
    }
    h += '</tr>';
  }
  if (last < tb.rows - 1) h += `<tr class="spacer"><td colspan="${nc + 1}" style="height:${(tb.rows - 1 - last) * ROW_H}px"></td></tr>`;
  G.body.innerHTML = h;
}

function gridRender() {
  const tb = activeTable();
  if (!tb) return;
  gridRenderHead(tb);
  gridRenderBody();
  $('emptyHint').hidden = tableHasData(tb) || tablesList().length > 1 || graphsList().length > 0;
  syncReadouts();
}

let gridScrollQueued = false;
gridWrap.addEventListener('scroll', () => {
  if (gridScrollQueued) return;
  gridScrollQueued = true;
  requestAnimationFrame(() => { gridScrollQueued = false; gridRenderBody(); if (editing) placeEditor(); });
});

function ensureVisible(tb, r, c) {
  const headH = gridHead.offsetHeight || 40;
  const top = r * ROW_H;
  if (top < gridWrap.scrollTop) gridWrap.scrollTop = top;
  else if (top + ROW_H + headH > gridWrap.scrollTop + gridWrap.clientHeight) gridWrap.scrollTop = top + ROW_H + headH - gridWrap.clientHeight;
  const rw = rowHeadW(tb);
  let left = 0;
  for (let j = 0; j < c; j++) left += tb.cols[j].w;
  const w = tb.cols[c] ? tb.cols[c].w : 0;
  if (left < gridWrap.scrollLeft) gridWrap.scrollLeft = left;
  else if (rw + left + w > gridWrap.scrollLeft + gridWrap.clientWidth) gridWrap.scrollLeft = rw + left + w - gridWrap.clientWidth;
}

// Tras cambiar la selección: rejilla, lecturas y paneles que dependen de ella.
function selChanged(tb, scrollTo = true) {
  const s = selOf(tb);
  if (scrollTo) ensureVisible(tb, s.r1, s.c1);
  gridRenderHead(tb);
  gridRenderBody();
  syncReadouts();
  syncColumnPanel();
  syncStats();
}

function syncReadouts() {
  const tb = activeTable();
  if (!tb || !tb.cols.length) { $('cellReadout').textContent = ''; $('selReadout').textContent = ''; return; }
  const s = selOf(tb), c = tb.cols[s.c0], v = c.data[s.r0];
  $('cellReadout').textContent = `${c.name}[${s.r0 + 1}]` + (v != null ? `  =  ${fmtCell(v)}` : '');
  if (isSingleCell(s)) { $('selReadout').textContent = ''; return; }
  const R = selRect(s), vals = [];
  for (let j = R.ca; j <= R.cb; j++) for (let r = R.ra; r <= R.rb; r++) vals.push(tb.cols[j].data[r]);
  const st = colStats(vals);
  $('selReadout').textContent = `${R.rb - R.ra + 1} × ${R.cb - R.ca + 1}` + (st.n ? `  ·  N = ${st.n}  ·  Σ = ${fmtNum(st.sum)}  ·  ${t('st_mean')} = ${fmtNum(st.mean)}` : '');
}

/* ---------- ratón ---------- */

let dragSel = null, resizing = null;
// Doble clic detectado aquí: cada clic vuelve a dibujar la tabla y, al desaparecer el elemento
// pulsado, el navegador no envía ni click ni dblclick.
let lastDown = null;
function isDouble(key, e) {
  const now = performance.now(), L = lastDown;
  const dbl = !!L && L.key === key && now - L.t < 450 && Math.abs(e.clientX - L.x) < 6 && Math.abs(e.clientY - L.y) < 6;
  lastDown = dbl ? null : { key, t: now, x: e.clientX, y: e.clientY };
  return dbl;
}
// Una tecla entre los dos clics (escribir y volver a pulsar la celda) no es un doble clic.
document.addEventListener('keydown', () => { lastDown = null; }, true);
gridEl.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || e.target.closest('.hedit')) return;
  const tb = activeTable();
  if (!tb) return;
  commitEdit(false);
  const s = selOf(tb);
  const rs = e.target.closest('.rs');
  if (rs) {
    const c = tb.cols[+rs.dataset.rs];
    resizing = { c, x0: e.clientX, w0: c.w };
    e.preventDefault();
    return;
  }
  const td = e.target.closest('td'), th = e.target.closest('th');
  const tr = (td || th) && (td || th).parentElement;
  const plain = !e.shiftKey && !e.ctrlKey && !e.metaKey;
  if (td && tr.dataset.r != null) {
    const r = +tr.dataset.r, c = td.cellIndex - 1;
    if (isDouble(`c${r},${c}`, e) && plain) { e.preventDefault(); startEdit(true); return; }
    if (e.shiftKey) { s.r1 = r; s.c1 = c; } else { s.r0 = s.r1 = r; s.c0 = s.c1 = c; s.extra = []; }
    dragSel = 'cell';
  } else if (th && th.dataset.c != null) {
    const c = +th.dataset.c, unit = !!e.target.closest('.cu');
    if (isDouble(`h${c}${unit ? 'u' : 'n'}`, e) && plain) { e.preventDefault(); editHeader(c, unit); return; }
    if (e.ctrlKey || e.metaKey) {
      const id = tb.cols[c].id;
      s.extra = s.extra.includes(id) ? s.extra.filter((x) => x !== id) : [...s.extra, id];
    } else if (e.shiftKey) {
      s.c1 = c; s.r0 = 0; s.r1 = tb.rows - 1;
      dragSel = 'col';
    } else {
      // Si se pulsa dentro de un bloque de columnas ya seleccionado, se arrastra el bloque entero;
      // si se suelta sin arrastrar, queda seleccionada solo esa columna.
      const R0 = selRect(s), inBlock = R0.ra === 0 && R0.rb === tb.rows - 1 && !s.extra.length && c >= R0.ca && c <= R0.cb;
      if (!inBlock) { s.c0 = s.c1 = c; s.extra = []; }
      s.r0 = 0; s.r1 = tb.rows - 1;
      colDrag = { tb, x0: e.clientX, on: false, gap: -1, collapse: inBlock && R0.ca !== R0.cb ? c : null };
    }
  } else if (th && tr.dataset.r != null) {
    const r = +tr.dataset.r;
    if (!e.shiftKey) s.r0 = r;
    s.r1 = r; s.c0 = 0; s.c1 = tb.cols.length - 1; s.extra = [];
    dragSel = 'row';
  } else if (th) {
    s.r0 = 0; s.c0 = 0; s.r1 = tb.rows - 1; s.c1 = tb.cols.length - 1; s.extra = [];
  } else return;
  e.preventDefault();
  gridWrap.focus({ preventScroll: true });
  selChanged(tb, false);
});
gridEl.addEventListener('pointerover', (e) => {
  if (!dragSel) return;
  if (!(e.buttons & 1)) { dragSel = null; return; }
  const tb = activeTable(), s = selOf(tb);
  const cell = e.target.closest('td, th');
  if (!cell) return;
  const tr = cell.parentElement;
  if (dragSel === 'cell' && cell.tagName === 'TD' && tr.dataset.r != null) { s.r1 = +tr.dataset.r; s.c1 = cell.cellIndex - 1; }
  else if (dragSel === 'col' && cell.dataset.c != null) s.c1 = +cell.dataset.c;
  else if (dragSel === 'row' && tr.dataset.r != null) s.r1 = +tr.dataset.r;
  else return;
  selChanged(tb, false);
});
window.addEventListener('pointermove', (e) => {
  if (colDrag) colDragMove(e);
  if (!resizing) return;
  resizing.c.w = Math.max(48, Math.round(resizing.w0 + e.clientX - resizing.x0));
  gridRenderHead(activeTable());
});
window.addEventListener('pointerup', () => {
  dragSel = null;
  if (colDrag) colDragEnd();
  if (resizing) { resizing = null; hist.commit(); }
});
// Arrastrar una cabecera mueve la columna (o el bloque seleccionado). Una raya azul marca el hueco
// donde caerá; cerca de los bordes, la tabla se desplaza sola; Esc cancela.
let colDrag = null;
const colMark = document.createElement('div');
colMark.className = 'colmark';
colMark.hidden = true;
gridWrap.appendChild(colMark);
function colDragMove(e) {
  const D = colDrag;
  if (!(e.buttons & 1)) { colDragEnd(); return; }
  if (!D.on) {
    if (Math.abs(e.clientX - D.x0) < 6) return;
    D.on = true;
    document.body.classList.add('col-moving');
    const R = selRect(selOf(D.tb));
    gridHead.querySelectorAll('th[data-c]').forEach((th) => th.classList.toggle('moving', +th.dataset.c >= R.ca && +th.dataset.c <= R.cb));
  }
  const wr = gridWrap.getBoundingClientRect();
  if (e.clientX < wr.left + rowHeadW(D.tb) + 24) gridWrap.scrollLeft -= 20;
  else if (e.clientX > wr.right - 24) gridWrap.scrollLeft += 20;
  const ths = [...gridHead.querySelectorAll('th[data-c]')];
  let gap = ths.findIndex((th) => { const r = th.getBoundingClientRect(); return e.clientX < r.left + r.width / 2; });
  if (gap < 0) gap = ths.length;
  D.gap = gap;
  const x = ths[gap] ? ths[gap].getBoundingClientRect().left : ths[ths.length - 1].getBoundingClientRect().right;
  colMark.style.left = `${x - wr.left + gridWrap.scrollLeft - 1}px`;
  colMark.style.top = `${gridWrap.scrollTop}px`;
  colMark.style.height = `${gridWrap.clientHeight}px`;
  colMark.hidden = false;
}
function colDragEnd(cancel = false) {
  const D = colDrag;
  colDrag = null;
  colMark.hidden = true;
  document.body.classList.remove('col-moving');
  if (!D) return;
  const tb = D.tb, s = selOf(tb), R = selRect(s), n = R.cb - R.ca + 1, g = D.gap;
  if (!D.on) {
    if (D.collapse != null) { s.c0 = s.c1 = D.collapse; selChanged(tb, false); }
    return;
  }
  if (cancel || g < 0 || (g >= R.ca && g <= R.cb + 1)) { gridRenderHead(tb); return; }
  const block = tb.cols.splice(R.ca, n), at = g > R.cb ? g - n : g;
  tb.cols.splice(at, 0, ...block);
  s.c0 = at; s.c1 = at + n - 1; s.extra = [];
  hist.commit();
  afterDataChange();
}
document.addEventListener('keydown', (e) => { if (colDrag && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); colDragEnd(true); } }, true);

// Clic derecho en la cabecera de una columna o en el número de una fila: su menú. Si no estaba
// seleccionada, se selecciona antes; las acciones valen para toda la selección.
gridEl.addEventListener('contextmenu', (e) => {
  const tb = activeTable(), th = e.target.closest('th');
  if (!tb || !th || e.target.closest('.hedit')) return;
  const tr = th.parentElement;
  if (th.dataset.c != null) { e.preventDefault(); openColMenu(tb, +th.dataset.c, e.clientX, e.clientY); }
  else if (tr.dataset.r != null) { e.preventDefault(); openRowMenu(tb, +tr.dataset.r, e.clientX, e.clientY); }
});
// Clic derecho en la zona en blanco, fuera de las celdas: columna nueva al final, tabla o gráfica nuevas.
gridWrap.addEventListener('contextmenu', (e) => {
  if (!activeTable() || e.target !== gridWrap || e.offsetX >= gridWrap.clientWidth || e.offsetY >= gridWrap.clientHeight) return;
  e.preventDefault();
  commitEdit(false);
  showCtxMenu(gridItem('blankcol', t('bc_col')) + '<hr>' + gridItem('blanktable', t('bc_table')) + gridItem('blankgraph', t('bc_graph')), e.clientX, e.clientY);
});
const gridItem = (ctx, label, c = '', danger = false) => `<button role="menuitem" data-ctx="${ctx}" data-c="${c}"${danger ? ' class="danger"' : ''}>${esc(label)}</button>`;
function openColMenu(tb, c, x, y) {
  commitEdit(false);
  const s = selOf(tb), R = selRect(s);
  const inSel = (R.ra === 0 && R.rb === tb.rows - 1 && c >= R.ca && c <= R.cb) || s.extra.includes(tb.cols[c].id);
  if (!inSel) { s.c0 = s.c1 = c; s.r0 = 0; s.r1 = tb.rows - 1; s.extra = []; selChanged(tb, false); }
  const n = selectedCols(tb).length;
  showCtxMenu(gridItem('colrename', t('hc_rename'), c) + '<hr>' + gridItem('colbefore', t('hc_before')) + gridItem('colafter', t('hc_after')) +
    '<hr>' + gridItem('coldel', t('hc_del', { n }), '', true), x, y);
}
function openRowMenu(tb, r, x, y) {
  commitEdit(false);
  const s = selOf(tb), R = selRect(s);
  const inSel = r >= R.ra && r <= R.rb && R.ca === 0 && R.cb === tb.cols.length - 1 && !s.extra.length;
  if (!inSel) { s.r0 = s.r1 = r; s.c0 = 0; s.c1 = tb.cols.length - 1; s.extra = []; selChanged(tb, false); }
  const { n } = selectedRows(tb), k = n === tb.rows ? 1 : n;
  showCtxMenu(gridItem('rowabove', t('rc_above', { n: k })) + gridItem('rowbelow', t('rc_below', { n: k })) +
    '<hr>' + gridItem('rowdel', t('rc_del', { n }), '', true), x, y);
}
function gridCtxCommand(cmd, c) {
  const tb = activeTable();
  if (!tb) return;
  const cols = selectedCols(tb), { ra, rb, n } = selectedRows(tb), k = n === tb.rows ? 1 : n;
  if (cmd === 'colrename') editHeader(c, false);
  else if (cmd === 'colbefore' || cmd === 'colafter') {
    // La columna nueva se crea con nombre de letra y se abre su nombre para escribir otro.
    const i = cmd === 'colbefore' ? tb.cols.indexOf(cols[0]) : tb.cols.indexOf(cols[cols.length - 1]) + 1;
    editHeader(insertCol(tb, i), false);
  } else if (cmd === 'coldel') deleteCols(tb);
  else if (cmd === 'rowabove') insertRows(tb, ra, k, true);
  else if (cmd === 'rowbelow') insertRows(tb, rb + 1, k, true);
  else if (cmd === 'rowdel') deleteRows(tb);
  else if (cmd === 'blankcol') editHeader(insertCol(tb, tb.cols.length), false);
  else if (cmd === 'blanktable') $('btnNewTable').click();
  else if (cmd === 'blankgraph') $('btnNewGraph').click();
}

// Doble clic en la cabecera: se edita ahí mismo el nombre (o la unidad, si se pulsa en ella).
// Enter o salir del campo guarda; Esc cancela.
function editHeader(ci, unit) {
  const tb = activeTable(), c = tb && tb.cols[ci];
  const th = gridHead.querySelector(`th[data-c="${ci}"]`);
  if (!c || !th) return;
  const target = th.querySelector(unit ? '.cu' : '.cn');
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = unit ? 'hedit unit' : 'hedit';
  inp.value = unit ? c.unit || '' : c.name;
  inp.placeholder = unit ? t('col_unit_ph') : '';
  inp.spellcheck = false;
  target.replaceWith(inp);
  inp.focus();
  inp.select();
  let done = false;
  const finish = (ok) => {
    if (done) return;
    done = true;
    const v = inp.value.trim();
    if (ok && unit && v !== (c.unit || '')) { c.unit = v; hist.commit(); }
    else if (ok && !unit && v && v !== c.name) { c.name = uniqueColName(tb, v, c); hist.commit(); }
    gridRenderHead(tb);
    syncColumnPanel();
    syncStats();
    gridWrap.focus({ preventScroll: true });
  };
  inp.addEventListener('keydown', (e) => {
    if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's')) e.stopPropagation(); // Ctrl+S sigue guardando
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    else if (e.key === 'Tab') { e.preventDefault(); finish(true); if (tb.cols[ci + (e.shiftKey ? -1 : 1)]) editHeader(ci + (e.shiftKey ? -1 : 1), unit); }
  });
  inp.addEventListener('blur', () => finish(true));
  inp.addEventListener('dblclick', (e) => e.stopPropagation());
}

/* ---------- edición de celdas ---------- */

let editing = null; // { tb, r, c, typed }

function cellTd(r, c) {
  const tr = gridBody.querySelector(`tr[data-r="${r}"]`);
  return tr ? tr.cells[c + 1] : null;
}
function placeEditor() {
  const td = cellTd(editing.r, editing.c);
  if (!td) return;
  Object.assign(cellEdit.style, { left: td.offsetLeft + 'px', top: td.offsetTop + 'px', width: td.offsetWidth + 'px', height: td.offsetHeight + 'px' });
}
function startEdit(keep, ch = '') {
  const tb = activeTable();
  if (!tb || !tb.cols.length) return;
  const s = selOf(tb);
  ensureVisible(tb, s.r0, s.c0);
  gridRenderBody();
  editing = { tb, r: s.r0, c: s.c0, typed: !keep };
  const v = tb.cols[s.c0].data[s.r0];
  cellEdit.value = keep ? (v == null ? '' : String(v)) : ch;
  cellEdit.hidden = false;
  placeEditor();
  cellEdit.focus();
  const n = cellEdit.value.length;
  cellEdit.setSelectionRange(n, n);
}
// Guarda lo escrito; devuelve true si había una edición abierta.
function commitEdit(focusGrid = true) {
  if (!editing) return false;
  const { tb, r, c } = editing;
  editing = null;
  cellEdit.hidden = true;
  const col = tb.cols[c];
  if (col) {
    const v = cellFromText(cellEdit.value);
    const val = v === '' ? null : v;
    if (col.data[r] !== val) { col.data[r] = val; hist.commit(); afterDataChange(); }
  }
  if (focusGrid && activeTable() === tb) gridWrap.focus({ preventScroll: true });
  return true;
}
function cancelEdit() {
  editing = null;
  cellEdit.hidden = true;
  gridWrap.focus({ preventScroll: true });
}
cellEdit.addEventListener('keydown', (e) => {
  const typed = editing && editing.typed;
  if (e.key === 'Enter') { e.preventDefault(); commitEdit(); moveCursor(e.shiftKey ? -1 : 1, 0, false, true); }
  else if (e.key === 'Tab') { e.preventDefault(); commitEdit(); moveCursor(0, e.shiftKey ? -1 : 1); }
  else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  else if (typed && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); commitEdit(); moveCursor(e.key === 'ArrowUp' ? -1 : 1, 0); }
  e.stopPropagation();
});
cellEdit.addEventListener('blur', () => { if (editing) commitEdit(false); });

// Mueve el cursor (o amplía la selección). Con grow, bajar desde la última fila añade una.
function moveCursor(dr, dc, extend = false, grow = false) {
  const tb = activeTable();
  if (!tb) return;
  const s = selOf(tb);
  if (grow && dr > 0 && s.r0 === tb.rows - 1) { setRows(tb, tb.rows + 1); hist.commit(); }
  if (extend) {
    s.r1 = clamp(s.r1 + dr, 0, tb.rows - 1);
    s.c1 = clamp(s.c1 + dc, 0, tb.cols.length - 1);
  } else {
    s.r0 = s.r1 = clamp(s.r0 + dr, 0, tb.rows - 1);
    s.c0 = s.c1 = clamp(s.c0 + dc, 0, tb.cols.length - 1);
    s.extra = [];
  }
  selChanged(tb);
}

// Última fila con datos de una columna (para Ctrl+flechas).
function lastDataRow(tb, c) {
  const d = tb.cols[c].data;
  for (let r = tb.rows - 1; r >= 0; r--) if (d[r] != null) return r;
  return 0;
}

gridWrap.addEventListener('keydown', (e) => {
  if (e.target !== gridWrap) return;
  const tb = activeTable();
  if (!tb || !tb.cols.length) return;
  const s = selOf(tb);
  const ctrl = e.ctrlKey || e.metaKey;
  const page = Math.max(1, Math.floor(gridWrap.clientHeight / ROW_H) - 2);
  const k = e.key;
  const focusRow = e.shiftKey ? s.r1 : s.r0, focusCol = e.shiftKey ? s.c1 : s.c0;
  let handled = true;
  if (k === 'ArrowUp') moveCursor(ctrl ? -focusRow : -1, 0, e.shiftKey);
  else if (k === 'ArrowDown') moveCursor(ctrl ? lastDataRow(tb, focusCol) - focusRow : 1, 0, e.shiftKey);
  else if (k === 'ArrowLeft') moveCursor(0, ctrl ? -focusCol : -1, e.shiftKey);
  else if (k === 'ArrowRight') moveCursor(0, ctrl ? tb.cols.length - 1 - focusCol : 1, e.shiftKey);
  else if (k === 'PageUp') moveCursor(-page, 0, e.shiftKey);
  else if (k === 'PageDown') moveCursor(page, 0, e.shiftKey);
  else if (k === 'Home') moveCursor(ctrl ? -focusRow : 0, -focusCol, e.shiftKey);
  else if (k === 'End') moveCursor(ctrl ? lastDataRow(tb, focusCol) - focusRow : 0, tb.cols.length - 1 - focusCol, e.shiftKey);
  else if (k === 'Enter') moveCursor(e.shiftKey ? -1 : 1, 0, false, !e.shiftKey);
  else if (k === 'Tab') moveCursor(0, e.shiftKey ? -1 : 1);
  else if (k === 'F2') startEdit(true);
  else if (k === 'Delete' || k === 'Backspace') clearSelection(tb);
  else if (ctrl && k.toLowerCase() === 'a') { s.r0 = 0; s.c0 = 0; s.r1 = tb.rows - 1; s.c1 = tb.cols.length - 1; selChanged(tb, false); }
  else if (k === 'Escape' && s.extra.length) { s.extra = []; selChanged(tb, false); }
  else if (!ctrl && !e.altKey && k.length === 1) startEdit(false, k);
  else handled = false;
  if (handled) { e.preventDefault(); e.stopPropagation(); }
});

function clearSelection(tb) {
  const s = selOf(tb), R = selRect(s);
  let changed = false;
  const clearCol = (c, ra, rb) => { for (let r = ra; r <= rb; r++) if (c.data[r] != null) { c.data[r] = null; changed = true; } };
  for (let j = R.ca; j <= R.cb; j++) clearCol(tb.cols[j], R.ra, R.rb);
  for (const id of s.extra) clearCol(colById(tb, id), 0, tb.rows - 1);
  if (changed) { hist.commit(); afterDataChange(); }
}

/* ---------- portapapeles ---------- */

function selectionTSV(tb) {
  const R = selRect(selOf(tb));
  const lines = [];
  for (let r = R.ra; r <= R.rb; r++) {
    const row = [];
    for (let j = R.ca; j <= R.cb; j++) { const v = tb.cols[j].data[r]; row.push(v == null ? '' : String(v)); }
    lines.push(row.join('\t'));
  }
  return lines.join('\r\n');
}

// Divide el texto pegado en filas y celdas: tabuladores (Excel, Calc, SciDAVis), y si no hay,
// punto y coma, espacios o comas, solo si todas las líneas dan el mismo número de campos.
function splitPasted(text) {
  const lines = text.replace(/(\r\n|\n|\r)$/, '').split(/\r\n|\n|\r/);
  if (lines.some((l) => l.includes('\t'))) return lines.map((l) => l.split('\t'));
  const full = lines.filter((l) => l.trim());
  if (full.every((l) => parseNum(l) !== undefined)) return lines.map((l) => [l]);
  for (const d of [';', 'ws', ',']) {
    const parts = full.map((l) => splitLine(l, d));
    if (parts[0].length > 1 && parts.every((p) => p.length === parts[0].length)) return lines.map((l) => (l.trim() ? splitLine(l, d) : ['']));
  }
  return lines.map((l) => [l]);
}

function pasteText(tb, text) {
  let rows = splitPasted(text);
  if (!rows.length) return;
  const s = selOf(tb), R = selRect(s);
  const r0 = R.ra, c0 = R.ca;
  let names = null;
  // Primera línea de títulos pegada en la fila 1: se usan como nombres de columna.
  if (r0 === 0 && rows.length > 1 && rows[0].every((v) => v.trim() && parseNum(v) === undefined) && rows[1].some((v) => parseNum(v) != null)) {
    names = rows[0];
    rows = rows.slice(1);
  }
  const w = Math.max(...rows.map((r) => r.length));
  while (tb.cols.length < c0 + w) tb.cols.push(makeCol(nextColName(tb), 'Y', tb.rows));
  if (tb.rows < r0 + rows.length) setRows(tb, r0 + rows.length);
  rows.forEach((row, i) => row.forEach((v, j) => { const x = cellFromText(v); tb.cols[c0 + j].data[r0 + i] = x === '' ? null : x; }));
  if (names) {
    names.forEach((n, j) => { const c = tb.cols[c0 + j]; c.name = uniqueColName(tb, n.trim(), c); });
    names.forEach((n, j) => { if (j && c0 + j > 0 && isErrName(n.trim(), tb.cols[c0 + j - 1].name)) tb.cols[c0 + j].role = 'yErr'; });
  }
  s.r0 = r0; s.c0 = c0; s.r1 = r0 + rows.length - 1; s.c1 = c0 + w - 1; s.extra = [];
  hist.commit();
  afterDataChange();
  toast(t('pasted', { r: rows.length, c: w }));
}

const gridHasFocus = () => document.activeElement === gridWrap && activeTable();
document.addEventListener('copy', (e) => {
  if (!gridHasFocus()) return;
  e.clipboardData.setData('text/plain', selectionTSV(activeTable()));
  e.preventDefault();
});
document.addEventListener('cut', (e) => {
  if (!gridHasFocus()) return;
  const tb = activeTable();
  e.clipboardData.setData('text/plain', selectionTSV(tb));
  e.preventDefault();
  clearSelection(tb);
});
document.addEventListener('paste', (e) => {
  if (!gridHasFocus()) return;
  const text = e.clipboardData.getData('text/plain');
  e.preventDefault();
  if (text) pasteText(activeTable(), text);
});

/* ---------- operaciones ---------- */

// Tras cambiar datos de la tabla activa: rejilla y paneles.
function afterDataChange() {
  gridRender();
  syncColumnPanel();
  syncStats();
}

function formulaResolver(tb) {
  const idx = (n) => tb.cols.findIndex((c) => c.name === n);
  const ref = (k, row) => `C[${k}][${row}]`;
  return {
    name: (n) => (n === 'i' ? 'v[0]' : idx(n) >= 0 ? ref(idx(n), 'v[0]-1') : null),
    col: (n) => (idx(n) >= 0 ? ref(idx(n), 'v[0]-1') : null),
    cell: (n, rowJs) => (idx(n) >= 0 ? ref(idx(n), `Math.round(${rowJs})-1`) : null),
  };
}

function exprErrText(e) {
  if (!e.code) return String(e.message || e);
  return t('expr_' + e.code, { arg: e.arg ?? '', pos: (e.pos ?? 0) + 1 });
}

function applyFormula() {
  const tb = activeTable(), col = tb && curCol(tb);
  if (!col) return;
  const src = $('colFormula').value.trim();
  const errEl = $('formulaErr');
  errEl.hidden = true;
  if (!src) return;
  let r0 = (parseInt($('fRow0').value, 10) || 1) - 1, r1 = (parseInt($('fRow1').value, 10) || tb.rows) - 1;
  if (r1 < r0) [r0, r1] = [r1, r0];
  r0 = clamp(r0, 0, tb.rows - 1);
  if (r1 >= tb.rows) setRows(tb, r1 + 1);
  let f;
  try { f = compileExpr(src, formulaResolver(tb)); } catch (e) { errEl.textContent = exprErrText(e); errEl.hidden = false; return; }
  const nums = tb.cols.map((c) => Float64Array.from(c.data, (v) => (typeof v === 'number' ? v : NaN)));
  // Solo se avisa de las filas sin resultado que están dentro de los datos, no de las vacías del final.
  let lastData = -1;
  for (const c of tb.cols) for (let r = c.data.length - 1; r > lastData; r--) if (c.data[r] != null) { lastData = r; break; }
  const v = [0];
  let bad = 0;
  for (let r = r0; r <= r1; r++) {
    v[0] = r + 1;
    let y;
    try { y = f(v, nums); } catch (e) { y = NaN; }
    if (typeof y === 'number' && isFinite(y)) col.data[r] = y;
    else { col.data[r] = null; if (r <= lastData) bad++; }
  }
  col.formula = src;
  hist.commit();
  afterDataChange();
  if (bad) toast(t('formula_bad', { n: bad }), 4500);
}

function sortTable(tb, col, dir) {
  const kind = (v) => (typeof v === 'number' ? 0 : v != null && v !== '' ? 1 : 2);
  const idx = Array.from({ length: tb.rows }, (_, i) => i);
  idx.sort((a, b) => {
    const va = col.data[a], vb = col.data[b], ka = kind(va), kb = kind(vb);
    if (ka !== kb) return ka - kb;
    if (ka === 0) return dir * (va - vb) || a - b;
    if (ka === 1) return dir * String(va).localeCompare(String(vb)) || a - b;
    return a - b;
  });
  for (const c of tb.cols) { const d = c.data; c.data = idx.map((i) => d[i]); }
}

// Columna nueva justo detrás de `col` y de sus columnas de error.
function insertColAfter(tb, col, nc) {
  let i = tb.cols.indexOf(col) + 1;
  while (i < tb.cols.length && (tb.cols[i].role === 'xErr' || tb.cols[i].role === 'yErr')) i++;
  tb.cols.splice(i, 0, nc);
  const s = selOf(tb);
  s.r0 = s.r1 = 0; s.c0 = s.c1 = i; s.extra = [];
  return i;
}

function calcColumn(kind) {
  const tb = activeTable(), col = tb && curCol(tb);
  if (!col) return;
  const xc = xFor(tb, col);
  if (xc === col) return;
  const x = xc ? xc.data : col.data.map((_, i) => i + 1);
  const xname = xc ? xc.name : 'i';
  if (kind === 'deriv') {
    const nc = makeCol(uniqueColName(tb, 'd' + col.name), 'Y');
    nc.data = derivative(x, col.data);
    nc.unit = col.unit && xc && xc.unit ? `${col.unit}/${xc.unit}` : '';
    nc.formula = `d(${col.name})/d(${xname})`;
    insertColAfter(tb, col, nc);
  } else {
    const r = cumTrapz(x, col.data);
    const nc = makeCol(uniqueColName(tb, 'int' + col.name), 'Y');
    nc.data = r.values;
    nc.unit = col.unit && xc && xc.unit ? `${col.unit}·${xc.unit}` : '';
    nc.formula = `∫ ${col.name} d${xname}`;
    insertColAfter(tb, col, nc);
    logResult(`${tb.name}: ∫ ${col.name} d${xname} = ${fmtNum(r.total, 10)}`);
    toast(t('area', { v: fmtNum(r.total) }), 5000);
  }
  hist.commit();
  afterDataChange();
}

/* ---------- paneles de tabla ---------- */

function syncColumnPanel() {
  const tb = activeTable();
  if (!tb) return;
  const c = curCol(tb);
  const off = !c;
  ['colName', 'colRole', 'colUnit', 'colFormula', 'btnApplyFormula'].forEach((id) => { $(id).disabled = off; });
  if (!c) return;
  if (document.activeElement !== $('colName')) $('colName').value = c.name;
  $('colRole').value = c.role;
  if (document.activeElement !== $('colUnit')) $('colUnit').value = c.unit || '';
  const lastId = $('colFormula').dataset.col;
  if (lastId !== String(c.id)) {
    $('colFormula').value = c.formula && !/^d\(|^∫/.test(c.formula) ? c.formula : '';
    $('colFormula').dataset.col = c.id;
    $('formulaErr').hidden = true;
  }
  // Las filas siguen a la selección: varias filas marcadas = solo esas; si no, toda la columna.
  if (![$('fRow0'), $('fRow1')].includes(document.activeElement)) {
    const R = selRect(selOf(tb)), multi = R.ra !== R.rb && !(R.ra === 0 && R.rb === tb.rows - 1);
    $('fRow0').value = multi ? R.ra + 1 : 1;
    $('fRow1').value = multi ? R.rb + 1 : tb.rows;
  }
  $('fRow0').max = $('fRow1').max = tb.rows;
  const ident = (n) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(n) && !(n in EXPR_FUNCS) && !(n in EXPR_CONSTS) && n !== 'i';
  $('colChips').innerHTML = ['i', ...tb.cols.map((k) => (ident(k.name) ? k.name : `col("${k.name}")`))]
    .map((s) => `<button class="chip" data-ins="${esc(s)}">${esc(s)}</button>`).join('');
}

function syncStats() {
  const tb = activeTable();
  if (!tb) return;
  const s = selOf(tb), R = selRect(s);
  let cols, ra = R.ra, rb = R.rb;
  if (isSingleCell(s)) { cols = [tb.cols[s.c0]]; ra = 0; rb = tb.rows - 1; } else cols = tb.cols.slice(R.ca, R.cb + 1);
  const extra = s.extra.map((id) => colById(tb, id)).filter((c) => !cols.includes(c));
  const sets = [...cols.map((c) => ({ c, v: c.data.slice(ra, rb + 1) })), ...extra.map((c) => ({ c, v: c.data }))].slice(0, 8);
  const st = sets.map((x) => colStats(x.v));
  const keys = ['n', 'mean', 'sd', 'se', 'min', 'max', 'sum', 'median'];
  if (!st.some((x) => x.n)) { $('statsOut').innerHTML = `<tbody><tr><td class="muted">${esc(t('stats_none'))}</td></tr></tbody>`; return; }
  $('statsOut').innerHTML = `<thead><tr><th></th>${sets.map((x) => `<th>${esc(x.c.name)}</th>`).join('')}</tr></thead><tbody>` +
    keys.map((k) => `<tr><th>${esc(t('st_' + k))}</th>${st.map((x) => `<td>${x.n ? (k === 'n' ? x.n : fmtNum(x[k])) : '–'}</td>`).join('')}</tr>`).join('') + '</tbody>';
}

function syncTablePanels() {
  const tb = activeTable();
  if (!tb) return;
  if (document.activeElement !== $('tblName')) $('tblName').value = tb.name;
  if (document.activeElement !== $('tblRows')) $('tblRows').value = tb.rows;
  const dest = $('plotDest'), prev = dest.value;
  dest.innerHTML = `<option value="new">${esc(t('plot_new_graph'))}</option>` + graphsList().map((g) => `<option value="${g.id}">${esc(t('plot_add_to', { name: g.name }))}</option>`).join('');
  dest.value = [...dest.options].some((o) => o.value === prev) ? prev : 'new';
  document.querySelectorAll('#plotStyle .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.style === UI.plotStyle));
  syncColumnPanel();
  syncStats();
}

/* ---------- de la tabla a una gráfica ---------- */

const SYMBOLS = ['circle', 'square', 'triangle', 'diamond', 'down', 'cross', 'plus', 'star', 'left', 'right', 'pentagon', 'hexagon'];
function nextColor(g) {
  const used = new Set(g.curves.map((c) => c.color));
  return COLORS.find((c) => !used.has(c)) || COLORS[g.curves.length % COLORS.length];
}
function makeDataCurve(g, tb, y, style) {
  const x = xFor(tb, y), ye = errFor(tb, y, 'yErr'), xe = errFor(tb, y, 'xErr');
  const nData = g.curves.filter((c) => c.kind === 'data').length;
  return {
    id: nid(), kind: 'data', table: tb.id, xc: x ? x.id : null, yc: y.id, ye: ye ? ye.id : null, xe: xe ? xe.id : null,
    label: '', style, color: nextColor(g), symbol: SYMBOLS[nData % SYMBOLS.length], size: 9, width: 1.5, dash: 'solid', fill: true, hidden: false,
  };
}

function plotSelection() {
  const tb = activeTable();
  if (!tb) return;
  commitEdit(false);
  const s = selOf(tb);
  let ys = selectedCols(tb).filter((c) => c.role === 'Y' || c.role === 'none');
  if (!ys.length && isSingleCell(s)) ys = tb.cols.filter((c) => c.role === 'Y');
  if (!ys.length) { toast(t('plot_need_y'), 4500); return; }
  const destV = $('plotDest').value;
  const g = destV === 'new' ? addGraph() : win(+destV);
  const isNew = destV === 'new';
  const curves = ys.map((y) => { const c = makeDataCurve(g, tb, y, UI.plotStyle); g.curves.push(c); return c; });
  if (isNew) {
    const x = xFor(tb, ys[0]);
    g.xlab = x ? colLabel(x) : t('row_number');
    g.ylab = ys.length === 1 ? colLabel(ys[0]) : '';
  }
  UI.curve.set(g.id, curves[0].id);
  P.active = g.id;
  hist.commit();
  renderAll();
}

/* ---------- controles de los paneles de tabla ---------- */

$('colName').addEventListener('change', (e) => {
  const tb = activeTable(), c = tb && curCol(tb);
  const v = e.target.value.trim();
  if (!c || !v) { syncColumnPanel(); return; }
  c.name = uniqueColName(tb, v, c);
  hist.commit();
  gridRender();
  syncColumnPanel();
  syncStats();
});
$('colRole').addEventListener('change', (e) => {
  const tb = activeTable(), c = tb && curCol(tb);
  if (!c) return;
  for (const col of selectedCols(tb)) col.role = e.target.value;
  c.role = e.target.value;
  hist.commit();
  gridRenderHead(tb);
});
$('colUnit').addEventListener('change', (e) => {
  const tb = activeTable(), c = tb && curCol(tb);
  if (!c) return;
  c.unit = e.target.value.trim();
  hist.commit();
  gridRenderHead(tb);
});
$('btnApplyFormula').addEventListener('click', applyFormula);
$('colFormula').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || !e.shiftKey)) { e.preventDefault(); applyFormula(); }
});
$('colFormula').addEventListener('input', () => { $('formulaErr').hidden = true; });
$('colChips').addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  const ta = $('colFormula'), ins = b.dataset.ins;
  const a = ta.selectionStart ?? ta.value.length, z = ta.selectionEnd ?? a;
  ta.value = ta.value.slice(0, a) + ins + ta.value.slice(z);
  ta.focus();
  ta.setSelectionRange(a + ins.length, a + ins.length);
});
$('btnSortAsc').addEventListener('click', () => { const tb = activeTable(); if (tb) { sortTable(tb, curCol(tb), 1); hist.commit(); afterDataChange(); } });
$('btnSortDesc').addEventListener('click', () => { const tb = activeTable(); if (tb) { sortTable(tb, curCol(tb), -1); hist.commit(); afterDataChange(); } });
$('btnNormalize').addEventListener('click', () => {
  const tb = activeTable(), c = tb && curCol(tb);
  if (!c) return;
  let m = 0;
  for (const v of c.data) if (isNum(v)) m = Math.max(m, Math.abs(v));
  if (!m) return;
  c.data = c.data.map((v) => (isNum(v) ? v / m : v));
  logResult(`${tb.name}: ${c.name} / ${fmtNum(m, 10)}`);
  hist.commit();
  afterDataChange();
});
$('btnDeriv').addEventListener('click', () => calcColumn('deriv'));
$('btnInteg').addEventListener('click', () => calcColumn('integ'));

document.querySelectorAll('#plotStyle .seg-btn').forEach((b) => b.addEventListener('click', () => {
  UI.plotStyle = b.dataset.style;
  document.querySelectorAll('#plotStyle .seg-btn').forEach((x) => x.classList.toggle('active', x === b));
}));
$('btnPlot').addEventListener('click', plotSelection);

$('tblName').addEventListener('change', (e) => {
  const tb = activeTable();
  const v = e.target.value.trim();
  if (!tb || !v) { syncTablePanels(); return; }
  tb.name = P.wins.some((o) => o !== tb && o.name === v) ? uniqueName(v, false) : v;
  hist.commit();
  renderTabs();
  syncTablePanels();
});
$('tblRows').addEventListener('change', async (e) => {
  const tb = activeTable();
  const n = Math.round(parseFloat(e.target.value));
  if (!tb || !(n >= 1)) { syncTablePanels(); return; }
  if (n < tb.rows && tb.cols.some((c) => c.data.slice(n).some((v) => v != null))) {
    const ok = await ask({
      title: t('shrink_title'), text: t('shrink_text', { n: tb.rows - n }), detail: t('undo_hint'),
      buttons: [{ label: t('cancel'), value: false }, { label: t('delete'), value: true, kind: 'danger-fill', focus: true }],
    });
    if (!ok) { syncTablePanels(); return; }
  }
  setRows(tb, n);
  hist.commit();
  afterDataChange();
  syncTablePanels();
});
// Columna Y vacía en la posición i, seleccionada. Devuelve i.
function insertCol(tb, i) {
  tb.cols.splice(i, 0, makeCol(nextColName(tb), 'Y', tb.rows));
  const s = selOf(tb);
  s.c0 = s.c1 = i; s.r0 = s.r1 = 0; s.extra = [];
  hist.commit();
  afterDataChange();
  ensureVisible(tb, 0, i);
  return i;
}
// k filas vacías a partir de la fila r (y, si se pide, seleccionadas).
function insertRows(tb, r, k, select = false) {
  for (const c of tb.cols) c.data.splice(r, 0, ...new Array(k).fill(null));
  tb.rows += k;
  if (select) { const s = selOf(tb); s.r0 = r; s.r1 = r + k - 1; s.c0 = 0; s.c1 = tb.cols.length - 1; s.extra = []; }
  hist.commit();
  afterDataChange();
  syncTablePanels();
}
$('btnAddCol').addEventListener('click', () => {
  const tb = activeTable();
  if (tb) insertCol(tb, tb.cols.length ? selRect(selOf(tb)).cb + 1 : 0);
});
$('btnInsRows').addEventListener('click', () => {
  const tb = activeTable();
  if (!tb) return;
  const { ra, n } = selectedRows(tb);
  insertRows(tb, ra, n === tb.rows ? 1 : n);
});
$('btnDelRows').addEventListener('click', () => { const tb = activeTable(); if (tb) deleteRows(tb); });
$('btnDelCols').addEventListener('click', () => { const tb = activeTable(); if (tb) deleteCols(tb); });
function deleteRows(tb) {
  const { ra, n } = selectedRows(tb);
  for (const c of tb.cols) c.data.splice(ra, n);
  tb.rows -= n;
  if (tb.rows < 1) setRows(tb, 1);
  const s = selOf(tb);
  s.r0 = s.r1 = Math.min(ra, tb.rows - 1);
  hist.commit();
  afterDataChange();
  syncTablePanels();
}
async function deleteCols(tb) {
  const cols = selectedCols(tb);
  const ids = new Set(cols.map((c) => c.id));
  const used = graphsList().some((g) => g.curves.some((c) => c.table === tb.id && [c.xc, c.yc, c.ye, c.xe].some((id) => ids.has(id))));
  if (used || cols.some((c) => c.data.some((v) => v != null))) {
    const ok = await ask({
      title: t('del_cols_title', { n: cols.length }), text: used ? t('del_cols_used') : '', detail: t('undo_hint'),
      buttons: [{ label: t('cancel'), value: false }, { label: t('delete'), value: true, kind: 'danger-fill', focus: true }],
    });
    if (!ok) return;
  }
  tb.cols = tb.cols.filter((c) => !ids.has(c.id));
  if (!tb.cols.length) tb.cols.push(makeCol('A', 'X', tb.rows));
  const s = selOf(tb);
  s.r1 = s.r0; s.c1 = s.c0; s.extra = [];
  pruneCurves();
  hist.commit();
  afterDataChange();
}
$('btnCsv').addEventListener('click', () => { const tb = activeTable(); if (tb) { commitEdit(false); exportCsv(tb); } });

// Tabla de ejemplo: oscilación amortiguada con ruido y su error, ya en una gráfica.
function loadExample() {
  const n = 60;
  const tcol = makeCol('t', 'X'), xcol = makeCol('x', 'Y'), ecol = makeCol('err', 'yErr');
  tcol.unit = 's'; xcol.unit = 'cm'; ecol.unit = 'cm';
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
  for (let i = 0; i < n; i++) {
    const tt = i * 0.1;
    tcol.data.push(+tt.toFixed(2));
    xcol.data.push(+(0.4 + 5 * Math.exp(-tt / 2.5) * Math.sin((2 * Math.PI * tt) / 1.6 + 0.3) + 0.35 * rnd()).toFixed(3));
    ecol.data.push(0.2);
  }
  const tb = addTable({ name: t('example_name'), cols: [tcol, xcol, ecol], rows: n, numbered: false });
  dropUnusedFirstTable(tb);
  const g = addGraph();
  const c = makeDataCurve(g, tb, xcol, 'scatter');
  g.curves.push(c);
  g.xlab = 't (s)';
  g.ylab = 'x (cm)';
  UI.curve.set(g.id, c.id);
  UI.fit.set(g.id, { curve: c.id, model: 'damped' });
  P.active = g.id;
  hist.commit();
  renderAll();
  toast(t('example_toast'), 6000);
}
$('btnExample').addEventListener('click', loadExample);
