'use strict';
// split.js: pantalla dividida al estilo de VS Code. Hay una o dos ventanas, cada una con sus
// pestañas, y cada pestaña está en una sola. La ventana con el foco es la normal (con su barra,
// sus paneles y el ratón); la otra se dibuja aquí solo para verla, y un clic en ella le pasa el
// foco. Las pestañas se ordenan y se cambian de ventana arrastrándolas; llevar una a la zona que
// ocuparía la segunda ventana la abre.

const panes = $('panes'), slotMain = $('slotMain'), slotSide = $('slotSide'), splitter = $('splitter');
const sidePane = $('sidePane'), gview2 = $('gview2'), gv2ctx = gview2.getContext('2d');
const grid2 = $('grid2');
const sideGrid = { wrap: $('gridWrap2'), table: grid2, head: grid2.tHead, body: grid2.tBodies[0], cols: grid2.querySelector('colgroup') };
let splitRatio = 0.5;   // reparto del último uso (parte de la izquierda o de arriba)
let sideShown = null;   // id dibujado en la otra ventana, para recuperar el desplazamiento de su tabla
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrowScreen = () => matchMedia('(max-width: 1100px)').matches; // las ventanas van una encima de otra

// Ventana de cada pestaña: 0 (izquierda o única) o 1 (derecha).
const groupOf = (id) => (UI.split && UI.split.right.includes(id) ? 1 : 0);
const groupWins = (g) => P.wins.filter((w) => groupOf(w.id) === g);
// Id de la pestaña que se ve en la ventana sin foco, o null.
function sideId() {
  const S = UI.split;
  return S ? S.act[1 - S.focus] : null;
}

// Pone la división de acuerdo con el proyecto: las pestañas nuevas van a la ventana con el foco,
// el foco pasa a la ventana de la pestaña activa y, si una ventana se queda vacía, se vuelve a una.
function splitSync() {
  const S = UI.split;
  if (!S) return;
  const ids = new Set(P.wins.map((w) => w.id));
  for (const id of ids) if (!S.known.has(id) && S.focus === 1) S.right.push(id);
  S.known = ids;
  S.right = S.right.filter((id) => ids.has(id));
  S.focus = groupOf(P.active);
  S.act[S.focus] = P.active;
  for (const g of [0, 1]) {
    const ws = groupWins(g);
    if (!ws.length) { UI.split = null; return; }
    if (!ws.some((w) => w.id === S.act[g])) S.act[g] = ws[0].id;
  }
}
// Coloca las dos ventanas: la que tiene el foco usa los elementos normales (#slotMain) y queda a
// su lado; la otra va en #slotSide.
function splitLayout() {
  splitSync();
  const S = UI.split, on = !!S;
  panes.classList.toggle('split', on);
  splitter.hidden = slotSide.hidden = !on;
  slotMain.classList.toggle('focus', on);
  $('btnSplit').setAttribute('aria-pressed', String(on));
  if (!on) {
    slotMain.style.order = slotMain.style.flexGrow = slotSide.style.order = slotSide.style.flexGrow = '';
    sideShown = null;
    focusShown = null;
    return;
  }
  const moved = focusShown !== null && focusShown !== S.focus;
  focusShown = S.focus;
  if (moved) fadeOutAddButtons();
  const mainFirst = S.focus === 0, f = mainFirst ? S.ratio : 1 - S.ratio;
  slotMain.style.order = mainFirst ? 0 : 2;
  slotSide.style.order = mainFirst ? 2 : 0;
  slotMain.style.flexGrow = f;
  slotSide.style.flexGrow = 1 - f;
  if (moved && !reducedMotion()) {
    for (const b of addButtons()) b.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
  }
}
let focusShown = null;

// Los botones de añadir van con la ventana activa: al cambiar de ventana se desvanecen donde
// estaban (una copia, porque los de verdad ya se han ido) y aparecen en la otra.
const addButtons = () => ['btnNewTable', 'btnNewGraph', 'btnSplit'].map($);
function fadeOutAddButtons() {
  document.querySelectorAll('.add-ghost').forEach((g) => g.remove());
  if (reducedMotion()) return;
  for (const b of addButtons()) {
    const r = b.getBoundingClientRect();
    if (!r.width) continue;
    const g = b.cloneNode(true);
    g.removeAttribute('id');
    g.classList.add('add-ghost');
    g.querySelectorAll('svg').forEach((s, k) => {
      const orig = b.querySelectorAll('svg')[k], sr = orig.getBoundingClientRect();
      s.style.display = getComputedStyle(orig).display;
      s.style.width = `${sr.width}px`;
      s.style.height = `${sr.height}px`;
    });
    Object.assign(g.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    document.body.appendChild(g);
    g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: 'ease-in' }).onfinish = () => g.remove();
  }
}

// La otra ventana: se dibuja en el siguiente fotograma, una vez por muchos cambios seguidos.
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

/* ---------- abrir, cerrar y mover ---------- */

// Abre la segunda ventana con la pestaña id; en la primera queda la activa o su vecina.
function splitStart(id, focusRight) {
  const i = P.wins.findIndex((w) => w.id === id);
  if (i < 0) return false;
  if (P.wins.length < 2) { toast(t('split_need'), 4000); return false; }
  commitEdit(false);
  const left = P.active !== id ? P.active : (P.wins[i + 1] || P.wins[i - 1]).id;
  UI.split = { right: [id], act: [left, id], focus: focusRight ? 1 : 0, ratio: splitRatio, known: new Set(P.wins.map((w) => w.id)) };
  P.active = focusRight ? id : left;
  return true;
}
// La ventana nueva entra desde la derecha (o desde abajo) hasta su sitio.
let splitAnimTimer = 0;
function animateSplitOpen() {
  const S = UI.split;
  if (!S || reducedMotion()) return;
  const second = S.focus === 1 ? slotMain : slotSide, first = second === slotMain ? slotSide : slotMain;
  const g1 = first.style.flexGrow, g2 = second.style.flexGrow;
  panes.classList.remove('anim');
  first.style.flexGrow = 1;
  second.style.flexGrow = 0;
  void panes.offsetWidth;
  panes.classList.add('anim');
  first.style.flexGrow = g1;
  second.style.flexGrow = g2;
  clearTimeout(splitAnimTimer);
  splitAnimTimer = setTimeout(() => panes.classList.remove('anim'), 400);
}
let splitClosing = false;
function splitClose() {
  if (!UI.split || splitClosing) return;
  const done = () => { splitClosing = false; panes.classList.remove('anim'); UI.split = null; renderAll(); };
  if (reducedMotion()) { done(); return; }
  splitClosing = true;
  panes.classList.add('anim');
  slotMain.style.flexGrow = 1;
  slotSide.style.flexGrow = 0;
  setTimeout(done, 300);
}
// Botón y menú Ver: la pestaña que mejor acompaña a la activa pasa a una ventana nueva.
function splitToggle() {
  if (UI.split) { splitClose(); return; }
  const other = splitPartner(P.active);
  if (other == null) { toast(t('split_need'), 4000); return; }
  if (!splitStart(other, false)) return;
  renderAll();
  animateSplitOpen();
}
// Las ventanas cambian de lado; cada una conserva su anchura.
function splitSwap() {
  const S = UI.split;
  if (!S) return;
  S.right = P.wins.filter((w) => !S.right.includes(w.id)).map((w) => w.id);
  S.act = [S.act[1], S.act[0]];
  S.ratio = splitRatio = 1 - S.ratio;
  renderAll();
}
// Mueve la pestaña id a la ventana g, delante de la pestaña beforeId (o al final), y la activa.
// Con g = 1 y una sola ventana, abre la segunda.
function moveTab(id, g, beforeId = null) {
  const w = win(id);
  if (!w) return false;
  commitEdit(false);
  let opened = false;
  const S = UI.split;
  if (g === 1 && !S) {
    if (!splitStart(id, true)) return false;
    opened = true;
  } else if (S && groupOf(id) !== g) {
    const from = groupOf(id), ws = groupWins(from), k = ws.indexOf(w);
    if (S.act[from] === id) { const nb = ws[k + 1] || ws[k - 1]; S.act[from] = nb ? nb.id : null; }
    if (g === 1) S.right.push(id);
    else S.right = S.right.filter((x) => x !== id);
  }
  P.wins.splice(P.wins.indexOf(w), 1);
  let j = beforeId != null ? P.wins.findIndex((o) => o.id === beforeId) : -1;
  if (j < 0) {
    const ws = groupWins(groupOf(id));
    j = ws.length ? P.wins.indexOf(ws[ws.length - 1]) + 1 : P.wins.length;
  }
  P.wins.splice(j, 0, w);
  P.active = id;
  hist.commit();
  renderAll();
  if (opened) animateSplitOpen();
  return true;
}
// Menú de la pestaña: abrirla al lado o pasarla a la otra ventana.
function openBeside(id) {
  moveTab(id, UI.split ? 1 - groupOf(id) : 1);
}
// Al cerrar la pestaña activa, se pasa a su vecina de la misma ventana, si queda alguna.
function nextAfterClose(id, i) {
  if (UI.split) {
    const g = groupOf(id), ws = P.wins.filter((w) => groupOf(w.id) === g);
    if (ws.length) return (ws.find((w) => P.wins.indexOf(w) >= i) || ws[ws.length - 1]).id;
  }
  return P.wins[Math.min(i, P.wins.length - 1)].id;
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

/* ---------- la ventana sin foco ---------- */

// Un clic le pasa el foco. En una tabla, además, selecciona la celda, la columna o la fila pulsada.
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
  if (e.target.closest('.tabs')) return; // sus pestañas funcionan como las de la otra ventana
  // Las barras de desplazamiento de la tabla siguen sirviendo para moverse sin activarla.
  const wr = sideGrid.wrap;
  if (e.target === wr && (e.offsetX >= wr.clientWidth || e.offsetY >= wr.clientHeight)) return;
  if (e.button !== 0) return;
  e.preventDefault();
  sideActivate(e);
});
// Clic derecho: recibe el foco y sale el menú de lo pulsado (la gráfica, una columna o una fila).
slotSide.addEventListener('contextmenu', (e) => {
  if (e.target.closest('.tabs')) return;
  e.preventDefault();
  if (!sideActivate(e)) return;
  if (activeGraph()) { openCtxMenu(e.clientX, e.clientY); return; }
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (el && gridWrap.contains(el)) el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY }));
});
// La rueda sobre la gráfica sin foco la activa; los siguientes giros ya hacen zoom en ella.
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

/* ---------- arrastrar pestañas ---------- */

const tabMark = document.createElement('div');
tabMark.className = 'tabmark';
tabMark.hidden = true;
document.body.appendChild(tabMark);
const splitPreview = $('splitPreview');
let tabDrag = null, swallowClick = false;

// Sitio que ocuparía la segunda ventana: a la derecha (o debajo), con el reparto del último uso.
function newPaneRect() {
  const p = panes.getBoundingClientRect();
  return narrowScreen()
    ? { left: p.left, top: p.top + p.height * splitRatio, width: p.width, height: p.height * (1 - splitRatio) }
    : { left: p.left + p.width * splitRatio, top: p.top, width: p.width * (1 - splitRatio), height: p.height };
}
// Dentro de ese sitio: ahí se ofrece abrirla.
function pastSplitEdge(x, y) {
  const r = newPaneRect();
  return narrowScreen() ? y > r.top : x > r.left;
}
const inRect = (x, y, r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
// Dónde caería la pestaña id: en una barra de pestañas (y delante de cuál), en la otra ventana o
// en una ventana nueva.
function tabDropTarget(x, y, id) {
  const S = UI.split;
  const bars = S ? [[$('tabs'), S.focus], [$('tabs2'), 1 - S.focus]] : [[$('tabs'), 0]];
  for (const [el, g] of bars) {
    const r = el.parentElement.getBoundingClientRect();
    if (!inRect(x, y, r)) continue;
    const tabs = [...el.querySelectorAll('.tab')].filter((tb) => +tb.dataset.id !== id);
    const last = tabs[tabs.length - 1], lastR = last && last.getBoundingClientRect();
    if (!S && !narrowScreen() && pastSplitEdge(x, y) && (!last || x > lastR.right + 16)) return { kind: 'new' };
    const before = tabs.find((tb) => { const b = tb.getBoundingClientRect(); return x < b.left + b.width / 2; });
    const mx = before ? before.getBoundingClientRect().left - 2 : last ? lastR.right + 1 : el.getBoundingClientRect().left + 2;
    return { kind: 'tabs', g, before: before ? +before.dataset.id : null, x: mx, top: r.top + 6, h: r.height - 6 };
  }
  if (!inRect(x, y, panes.getBoundingClientRect())) return null;
  if (!S) return pastSplitEdge(x, y) ? { kind: 'new' } : null;
  const slot = [slotMain, slotSide].find((sl) => inRect(x, y, sl.getBoundingClientRect()));
  if (!slot) return null;
  const g = slot === slotMain ? S.focus : 1 - S.focus;
  return g !== groupOf(id) ? { kind: 'group', g, slot } : null;
}
function showDropFeedback(T) {
  tabMark.hidden = !(T && T.kind === 'tabs');
  if (!tabMark.hidden) Object.assign(tabMark.style, { left: `${T.x}px`, top: `${T.top}px`, height: `${T.h}px` });
  let r = null, text = '';
  if (T && T.kind === 'new') {
    r = newPaneRect();
    text = t('split_drop');
  } else if (T && T.kind === 'group') {
    r = T.slot.getBoundingClientRect();
    text = t('split_move');
  }
  if (!r) { splitPreview.classList.remove('show'); return; }
  Object.assign(splitPreview.style, { left: `${r.left + 4}px`, top: `${r.top + 4}px`, width: `${r.width - 8}px`, height: `${r.height - 8}px` });
  splitPreview.firstElementChild.textContent = text;
  splitPreview.classList.add('show');
}

function tabPointerDown(e) {
  const tab = e.target.closest('.tab');
  if (!tab || e.button !== 0 || e.target.closest('.tx, input')) return;
  const r = tab.getBoundingClientRect();
  tabDrag = { id: +tab.dataset.id, tab, x0: e.clientX, y0: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, on: false, target: null };
}
$('tabs').addEventListener('pointerdown', tabPointerDown);
$('tabs2').addEventListener('pointerdown', tabPointerDown);
window.addEventListener('pointermove', (e) => {
  const D = tabDrag;
  if (!D) return;
  if (!(e.buttons & 1)) { tabDragEnd(true); return; }
  if (!D.on) {
    if (Math.hypot(e.clientX - D.x0, e.clientY - D.y0) < 6) return;
    D.on = true;
    D.ghost = D.tab.cloneNode(true);
    D.ghost.classList.add('ghost');
    D.ghost.style.width = `${D.tab.getBoundingClientRect().width}px`;
    document.body.appendChild(D.ghost);
    D.tab.classList.add('dragging');
    document.body.classList.add('tab-moving');
    closeCtxMenu();
  }
  D.ghost.style.transform = `translate(${e.clientX - D.dx}px, ${e.clientY - D.dy}px)`;
  D.target = tabDropTarget(e.clientX, e.clientY, D.id);
  showDropFeedback(D.target);
});
window.addEventListener('pointerup', () => { if (tabDrag) tabDragEnd(false); });
document.addEventListener('keydown', (e) => {
  if (tabDrag && tabDrag.on && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); tabDragEnd(true); }
}, true);
// Tras arrastrar, el clic que manda el navegador al soltar no debe activar nada.
document.addEventListener('click', (e) => { if (swallowClick) { swallowClick = false; e.stopPropagation(); e.preventDefault(); } }, true);

function tabDragEnd(cancel) {
  const D = tabDrag;
  tabDrag = null;
  if (!D || !D.on) return;
  swallowClick = true;
  setTimeout(() => { swallowClick = false; }, 0);
  document.body.classList.remove('tab-moving');
  D.tab.classList.remove('dragging');
  tabMark.hidden = true;
  splitPreview.classList.remove('show');
  const T = cancel ? null : D.target;
  let moved = false;
  if (T && T.kind === 'new') moved = moveTab(D.id, 1);
  else if (T && T.kind === 'group') moved = moveTab(D.id, T.g);
  else if (T && T.kind === 'tabs') moved = moveTab(D.id, T.g, T.before);
  // La copia vuela hasta la pestaña en su sitio (o vuelve a la original) y desaparece.
  const ghost = D.ghost, dest = document.querySelector(`.tablist .tab[data-id="${D.id}"]`);
  if (reducedMotion() || !dest || (moved && T.kind === 'new')) {
    ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reducedMotion() ? 0 : 200 }).onfinish = () => ghost.remove();
    return;
  }
  const r = dest.getBoundingClientRect();
  ghost.animate([{ transform: ghost.style.transform }, { transform: `translate(${r.left}px, ${r.top}px)` }], { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => ghost.remove();
}

/* ---------- entradas: botón y clic derecho en las pestañas ---------- */

$('btnSplit').addEventListener('click', splitToggle);
for (const bar of [$('tabs'), $('tabs2')]) {
  bar.addEventListener('contextmenu', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab || tab.querySelector('input')) return;
    e.preventDefault();
    const id = +tab.dataset.id;
    const item = (ctx, key) => `<button role="menuitem" data-ctx="${ctx}" data-id="${id}">${esc(t(key))}</button>`;
    let h = '';
    if (P.wins.length > 1) h += item('beside', UI.split ? 'tab_move' : 'tab_beside');
    if (UI.split) h += item('unsplit', 'split_close');
    if (h) h += '<hr>';
    showCtxMenu(h + item('rename', 'tab_rename') + item('closewin', 'tab_close'), e.clientX, e.clientY);
  });
}
