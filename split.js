'use strict';
// split.js: pantalla dividida, dos pestañas a la vez. La que tiene el foco es la normal (con su
// barra, sus paneles y el ratón); la otra se dibuja aquí solo para verla, y un clic en ella la
// convierte en la activa sin que nada cambie de sitio.

const panes = $('panes'), slotMain = $('slotMain'), slotSide = $('slotSide'), splitter = $('splitter');
const sidePane = $('sidePane'), gview2 = $('gview2'), gv2ctx = gview2.getContext('2d');
const grid2 = $('grid2');
const sideGrid = { wrap: $('gridWrap2'), table: grid2, head: grid2.tHead, body: grid2.tBodies[0], cols: grid2.querySelector('colgroup') };
let splitRatio = 0.5;   // reparto del último uso (parte de la izquierda o de arriba)
let sideShown = null;   // id dibujado al lado, para recuperar el desplazamiento de su tabla

// Id de la ventana que se ve al lado (la que no tiene el foco), o null.
function sideId() {
  const S = UI.split;
  return S ? (S.focus === 'left' ? S.right : S.left) : null;
}

// Ajusta la división a la pestaña activa y coloca los dos huecos. Si se activa la de al lado, el
// foco pasa a ella; si se activa otra, ocupa el sitio de la que tenía el foco.
function splitLayout() {
  let S = UI.split;
  if (S) {
    if (P.active === S.left) S.focus = 'left';
    else if (P.active === S.right) S.focus = 'right';
    else S[S.focus] = P.active;
    if (!win(S.left) || !win(S.right) || S.left === S.right) S = UI.split = null;
  }
  const on = !!S;
  panes.classList.toggle('split', on);
  splitter.hidden = slotSide.hidden = !on;
  slotMain.classList.toggle('focus', on);
  $('btnSplit').setAttribute('aria-pressed', String(on));
  if (!on) {
    slotMain.style.order = slotMain.style.flexGrow = slotSide.style.order = slotSide.style.flexGrow = '';
    sideShown = null;
    return;
  }
  const mainFirst = S.focus === 'left', f = mainFirst ? S.ratio : 1 - S.ratio;
  slotMain.style.order = mainFirst ? 0 : 2;
  slotSide.style.order = mainFirst ? 2 : 0;
  slotMain.style.flexGrow = f;
  slotSide.style.flexGrow = 1 - f;
}

// La vista de al lado: se dibuja en el siguiente fotograma, una vez por muchos cambios seguidos.
let sideQueued = false;
function renderSide() {
  if (sideQueued) return;
  sideQueued = true;
  requestAnimationFrame(renderSideNow);
}
function renderSideNow() {
  sideQueued = false;
  const id = sideId(), w = id != null && win(id);
  if (!w) { sideShown = null; return; }
  const isT = w.type === 'table';
  $('sideName').innerHTML = (isT ? ICON_TABLE : ICON_GRAPH) + `<span>${esc(w.name)}</span>`;
  sideGrid.wrap.hidden = !isT;
  gview2.hidden = isT;
  sidePane.classList.toggle('graph', !isT);
  if (isT) {
    gridRenderHead(w, sideGrid);
    if (sideShown !== id) {
      const [top, left] = scrollMem.get(id) || [0, 0];
      sideGrid.wrap.scrollTop = top;
      sideGrid.wrap.scrollLeft = left;
    }
    gridRenderBody(sideGrid, w);
  } else {
    paintGraph(gview2, gv2ctx, sidePane, w);
  }
  sideShown = id;
}

function splitOpen(left, right) {
  commitEdit(false);
  UI.split = { left, right, focus: left === P.active ? 'left' : 'right', ratio: splitRatio };
  renderAll();
}
function splitClose() {
  if (!UI.split) return;
  UI.split = null;
  renderAll();
}
function splitToggle() {
  if (UI.split) { splitClose(); return; }
  const other = splitPartner(P.active);
  if (other == null) { toast(t('split_need'), 4000); return; }
  splitOpen(P.active, other);
}
// Cada ventana cambia de lado y conserva su anchura.
function splitSwap() {
  const S = UI.split;
  if (!S) return;
  [S.left, S.right] = [S.right, S.left];
  S.focus = S.focus === 'left' ? 'right' : 'left';
  S.ratio = splitRatio = 1 - S.ratio;
  renderAll();
}
// Pestaña id al lado de la activa (o en lugar de la que ya estaba al lado).
function openBeside(id) {
  if (!win(id) || id === P.active) return;
  const S = UI.split;
  if (!S) { splitOpen(P.active, id); return; }
  S[S.focus === 'left' ? 'right' : 'left'] = id;
  renderAll();
}

// Compañera para dividir: de una gráfica, la tabla de su primera curva de datos; de una tabla, la
// última gráfica que la usa; si no, la pestaña vecina.
function splitPartner(id) {
  const w = win(id);
  if (!w || P.wins.length < 2) return null;
  if (w.type === 'graph') {
    const c = w.curves.find((c) => c.table != null && win(c.table));
    if (c) return c.table;
  } else {
    const users = graphsList().filter((g) => g.curves.some((c) => c.table === id));
    if (users.length) return users[users.length - 1].id;
  }
  const i = P.wins.indexOf(w);
  return (P.wins[i + 1] || P.wins[i - 1]).id;
}

/* ---------- la vista de al lado ---------- */

// Un clic la activa. En una tabla, además, selecciona la celda, la columna o la fila pulsada.
function sideActivate(e) {
  const id = sideId(), w = id != null && win(id);
  if (!w) return false;
  if (w.type === 'table' && e.button === 0) {
    const td = e.target.closest('td'), th = e.target.closest('th');
    const tr = (td || th) && (td || th).parentElement, s = selOf(w);
    if (td && tr.dataset.r != null) { s.r0 = s.r1 = +tr.dataset.r; s.c0 = s.c1 = td.cellIndex - 1; s.extra = []; }
    else if (th && th.dataset.c != null) { s.c0 = s.c1 = +th.dataset.c; s.r0 = 0; s.r1 = w.rows - 1; s.extra = []; }
    else if (th && tr.dataset.r != null) { s.r0 = s.r1 = +tr.dataset.r; s.c0 = 0; s.c1 = w.cols.length - 1; s.extra = []; }
  }
  activate(id);
  if (activeTable()) gridWrap.focus({ preventScroll: true });
  return true;
}
slotSide.addEventListener('pointerdown', (e) => {
  if (e.target.closest('#btnSplitClose')) return;
  // Las barras de desplazamiento de la tabla siguen sirviendo para moverse sin activarla.
  const wr = sideGrid.wrap;
  if (e.target === wr && (e.offsetX >= wr.clientWidth || e.offsetY >= wr.clientHeight)) return;
  if (e.button !== 0) return;
  e.preventDefault();
  sideActivate(e);
});
// Clic derecho: se activa y, si es una gráfica, sale su menú contextual.
slotSide.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (sideActivate(e) && activeGraph()) openCtxMenu(e.clientX, e.clientY);
});
// La rueda sobre la gráfica de al lado la activa; los siguientes giros ya hacen zoom en ella.
gview2.addEventListener('wheel', (e) => { e.preventDefault(); sideActivate(e); }, { passive: false });
$('btnSplitClose').addEventListener('click', splitClose);

sideGrid.wrap.addEventListener('scroll', () => {
  const id = sideId();
  if (id == null || id !== sideShown) return;
  scrollMem.set(id, [sideGrid.wrap.scrollTop, sideGrid.wrap.scrollLeft]);
  renderSide();
});
new ResizeObserver(() => { if (UI.split) renderSide(); }).observe(sidePane);

/* ---------- la barra que reparte el espacio ---------- */

function setSplitRatio(f) {
  if (!UI.split) return;
  UI.split.ratio = splitRatio = clamp(f, 0.15, 0.85);
  splitLayout();
}
splitter.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || !UI.split) return;
  e.preventDefault();
  splitter.setPointerCapture(e.pointerId);
  splitter.classList.add('drag');
  const r = panes.getBoundingClientRect(), vert = getComputedStyle(panes).flexDirection === 'column';
  const move = (ev) => setSplitRatio(vert ? (ev.clientY - r.top) / r.height : (ev.clientX - r.left) / r.width);
  const end = () => {
    splitter.classList.remove('drag');
    splitter.removeEventListener('pointermove', move);
    splitter.removeEventListener('lostpointercapture', end);
  };
  splitter.addEventListener('pointermove', move);
  splitter.addEventListener('lostpointercapture', end);
});
splitter.addEventListener('dblclick', () => setSplitRatio(0.5));
splitter.addEventListener('keydown', (e) => {
  const d = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
  if (!d || !UI.split) return;
  e.preventDefault();
  setSplitRatio(UI.split.ratio + d * 0.05);
});

/* ---------- entradas: botón y clic derecho en las pestañas ---------- */

$('btnSplit').addEventListener('click', splitToggle);
$('tabs').addEventListener('contextmenu', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab || tab.querySelector('input')) return;
  e.preventDefault();
  const id = +tab.dataset.id;
  const item = (ctx, key) => `<button role="menuitem" data-ctx="${ctx}" data-id="${id}">${esc(t(key))}</button>`;
  let h = '';
  if (id !== P.active && id !== sideId()) h += item('beside', 'tab_beside');
  if (UI.split) h += item('unsplit', 'split_close');
  if (h) h += '<hr>';
  showCtxMenu(h + item('rename', 'tab_rename') + item('closewin', 'tab_close'), e.clientX, e.clientY);
});
