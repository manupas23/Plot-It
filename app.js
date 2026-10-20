'use strict';
// app.js: une las piezas. Cambia entre tabla y gráfica, conecta la barra superior, los atajos
// de teclado, el arrastrar y soltar, el idioma, y arranca la aplicación.

/* ---------- dibujo general ---------- */

const scrollMem = new Map(); // id de tabla → [scrollTop, scrollLeft]
let shownTable = null;

function renderAll() {
  splitLayout();
  const w = activeWin();
  const isT = w.type === 'table';
  $('tableBar').hidden = $('tablePane').hidden = !isT;
  $('graphBar').hidden = $('graphPane').hidden = isT;
  document.querySelectorAll('.panel.for-table').forEach((p) => { p.hidden = !isT; });
  document.querySelectorAll('.panel.for-graph').forEach((p) => { p.hidden = isT; });
  $('gtip').hidden = true;
  renderTabs();
  renderLog();
  if (isT) {
    gridRender();
    if (shownTable !== w.id) {
      const [top, left] = scrollMem.get(w.id) || [0, 0];
      gridWrap.scrollTop = top;
      gridWrap.scrollLeft = left;
      gridRenderBody();
    }
    shownTable = w.id;
    syncTablePanels();
  } else {
    shownTable = null;
    syncGraphPanels();
    graphRender();
  }
  renderSide();
}

gridWrap.addEventListener('scroll', () => {
  const tb = activeTable();
  if (tb && tb.id === shownTable) scrollMem.set(tb.id, [gridWrap.scrollTop, gridWrap.scrollLeft]);
});

/* ---------- barra superior y pestañas ---------- */

$('fileData').addEventListener('change', (e) => {
  const files = [...e.target.files];
  e.target.value = '';
  if (files.length) importFiles(files);
});
$('fileProject').addEventListener('change', (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f) openProject(f);
});
$('btnSaveProject').addEventListener('click', saveProject);
$('btnUndo').addEventListener('click', () => hist.go(-1));
$('btnRedo').addEventListener('click', () => hist.go(1));
$('btnHelp').addEventListener('click', () => $('help').showModal());

$('btnNewTable').addEventListener('click', () => {
  commitEdit(false);
  const tb = addTable();
  P.active = tb.id;
  hist.commit();
  renderAll();
  gridWrap.focus({ preventScroll: true });
});
$('btnNewGraph').addEventListener('click', () => {
  commitEdit(false);
  const g = addGraph();
  P.active = g.id;
  hist.commit();
  renderAll();
});

$('tabs').addEventListener('click', (e) => {
  const x = e.target.closest('[data-close]');
  if (x) { closeWin(+x.dataset.close); return; }
  const tab = e.target.closest('.tab');
  if (!tab || e.target.tagName === 'INPUT') return;
  activate(+tab.dataset.id);
  if (activeTable()) gridWrap.focus({ preventScroll: true });
});
$('tabs').addEventListener('auxclick', (e) => {
  const tab = e.target.closest('.tab');
  if (tab && e.button === 1) { e.preventDefault(); closeWin(+tab.dataset.id); }
});
$('tabs').addEventListener('dblclick', (e) => {
  const tab = e.target.closest('.tab');
  if (tab && !e.target.closest('[data-close]') && !tab.querySelector('input')) renameTab(tab);
});

$('btnAutoscale').addEventListener('click', autoscale);
$('btnPng').addEventListener('click', () => { const g = activeGraph(); if (g) exportPng(g); });
$('btnSvg').addEventListener('click', () => { const g = activeGraph(); if (g) exportSvg(g); });

$('btnLogCopy').addEventListener('click', () => {
  const s = $('logOut').textContent;
  if (s) navigator.clipboard.writeText(s).then(() => toast(t('copied')), () => toast(t('copy_fail')));
});
$('btnLogClear').addEventListener('click', () => {
  if (!P.log.length) return;
  P.log = [];
  hist.commit();
  renderLog();
});

/* ---------- idioma ---------- */

// Los textos fijos los cambia i18n.js; aquí se rehace lo que se genera en el código.
document.querySelectorAll('.lang-btn').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
document.addEventListener('langchange', () => {
  funcCache.clear();
  renderAll();
});

/* ---------- teclado ---------- */

document.addEventListener('keydown', (e) => {
  const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (ctrl && k === 's') {
    e.preventDefault();
    if (document.activeElement && document.activeElement.blur && document.activeElement !== document.body) document.activeElement.blur();
    saveProject();
    return;
  }
  const tag = e.target.tagName;
  if ((tag === 'INPUT' && !['checkbox', 'radio', 'range', 'color'].includes(e.target.type)) || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if (document.querySelector('dialog[open]')) return;
  if (ctrl && k === 'z') { e.preventDefault(); hist.go(e.shiftKey ? 1 : -1); return; }
  if (ctrl && k === 'y') { e.preventDefault(); hist.go(1); return; }
  if (ctrl || e.altKey) return;
  if (e.key === '?') { e.preventDefault(); $('help').showModal(); return; }
  if (activeGraph()) {
    if (k === 'a') autoscale();
    else if (e.key === 'Escape') { $('gtip').hidden = true; }
  } else if (activeTable() && e.target === document.body && e.key.length === 1) {
    // Escribir con la tabla a la vista (sin foco en ningún control) edita la celda actual.
    gridWrap.focus({ preventScroll: true });
    startEdit(false, e.key);
    e.preventDefault();
  }
});

/* ---------- panel activo ---------- */

// Se resalta el panel que está bajo el ratón; al salir de la barra queda resaltado el último.
// Con el teclado, el panel en el que entra el foco.
function setActivePanel(p) {
  document.querySelectorAll('.panel').forEach((el) => el.classList.toggle('active', el === p));
}
document.querySelectorAll('.panel').forEach((p) => {
  p.addEventListener('pointerenter', () => setActivePanel(p));
  p.addEventListener('focusin', () => setActivePanel(p));
});

/* ---------- arrastrar y soltar archivos ---------- */

const work = $('work');
let dragDepth = 0;
const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
work.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; dragDepth++; $('dropHint').hidden = false; });
work.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
work.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('dropHint').hidden = true; } });
work.addEventListener('drop', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  $('dropHint').hidden = true;
  commitEdit(false);
  importFiles([...e.dataTransfer.files]);
});
// Fuera de la zona de trabajo, soltar un archivo no debe abrirlo en el navegador.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

/* ---------- tamaño de la ventana ---------- */

new ResizeObserver(() => { if (activeGraph()) graphRender(); }).observe($('graphPane'));
new ResizeObserver(() => { if (activeTable()) { gridRenderBody(); if (editing) placeEditor(); } }).observe(gridWrap);

window.addEventListener('beforeunload', (e) => {
  if (hist.dirty() && projectHasContent(P)) { e.preventDefault(); e.returnValue = ''; }
});

/* ---------- arranque ---------- */

newProject();
hist.reset();
renderAll();
setActivePanel(document.querySelector('.panel:not([hidden])'));
restoreAutosave();

// Para pruebas automáticas.
window.plotit = {
  get P() { return P; }, UI, hist, renderAll, parseDataText, tableFromParsed, pasteText, applyFormula, loadExample,
  drawGraph, SvgCtx, runFit, fitState, lmFit, FIT_MODELS, compileExpr, activate, addGraph, addTable, makeDataCurve,
};
