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
  // Fundido al cambiar de vista, pero no al pasar de una ventana a otra en pantalla doble: las dos
  // ya se estaban viendo, y repetido deprisa parpadea.
  const focus = UI.split ? UI.split.focus : null;
  const paneSwitch = focus !== null && shownFocus !== null && focus !== shownFocus;
  if (shownView != null && shownView !== w.id && !paneSwitch && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    $(isT ? 'tablePane' : 'graphPane').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
  }
  shownView = w.id;
  shownFocus = focus;
}
let shownView = null, shownFocus = null;

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
  if (f) { if (/\.json$/i.test(f.name)) openProject(f); else importFiles([f]); }
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

for (const bar of [$('tabs'), $('tabs2')]) {
  bar.addEventListener('click', (e) => {
    const x = e.target.closest('[data-close]');
    if (x) { closeWin(+x.dataset.close); return; }
    const tab = e.target.closest('.tab');
    if (!tab || e.target.tagName === 'INPUT') return;
    activate(+tab.dataset.id);
    if (activeTable()) gridWrap.focus({ preventScroll: true });
  });
  bar.addEventListener('auxclick', (e) => {
    const tab = e.target.closest('.tab');
    if (tab && e.button === 1) { e.preventDefault(); closeWin(+tab.dataset.id); }
  });
  bar.addEventListener('wheel', (e) => {
    if (bar.scrollWidth <= bar.clientWidth) return;
    e.preventDefault();
    bar.scrollLeft += e.deltaY + e.deltaX;
  }, { passive: false });
  bar.addEventListener('dblclick', (e) => {
    const tab = e.target.closest('.tab');
    if (tab && !e.target.closest('[data-close]') && !tab.querySelector('input')) renameTab(tab);
  });
}

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
// "+info": enseña en un diálogo la ayuda escondida que indica data-info (también en los diálogos que
// se generan). El título es data-info-title o, si no, el del panel o diálogo donde está el botón.
document.addEventListener('click', (e) => {
  const b = e.target.closest('.info-btn');
  const src = b && document.getElementById(b.dataset.info);
  if (!src) return;
  e.preventDefault(); // en el título de un panel, que no lo abra ni lo cierre
  const sum = b.closest('summary'), panel = b.closest('details'), dlg = b.closest('dialog');
  let title = '';
  if (b.dataset.infoTitle) title = t(b.dataset.infoTitle);
  else if (panel) { const s = panel.querySelector(':scope > summary'); title = (s.querySelector('[data-i18n]') || s).textContent; }
  else if (dlg) title = dlg.querySelector('h2').textContent;
  $('infoTitle').textContent = title;
  $('infoBody').innerHTML = src.innerHTML;
  $('infoBody').scrollTop = 0;
  $('infoDlg').showModal();
  if (sum) $('infoOk').focus();
});
$('infoOk').addEventListener('click', () => $('infoDlg').close());
// Un clic fuera del recuadro también lo cierra.
$('infoDlg').addEventListener('click', (e) => {
  if (e.target !== $('infoDlg')) return;
  const r = $('infoDlg').getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) $('infoDlg').close();
});

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

/* ---------- app instalable y sin conexión ---------- */

// El service worker solo existe servido por http(s); abierto como archivo local, la app funciona igual.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
// Botón «Instalar» cuando el navegador lo ofrece (Chrome, Edge, Android). En iPhone/iPad: Compartir → Añadir a pantalla de inicio.
let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; $('btnInstall').hidden = false; });
window.addEventListener('appinstalled', () => { installEvt = null; $('btnInstall').hidden = true; });
$('btnInstall').addEventListener('click', async () => {
  if (!installEvt) return;
  installEvt.prompt();
  await installEvt.userChoice;
  installEvt = null;
  $('btnInstall').hidden = true;
});
// Instalada, abrir un archivo con Plot.It desde el sistema lo importa.
if ('launchQueue' in window) {
  window.launchQueue.setConsumer(async (p) => {
    if (!p.files || !p.files.length) return;
    const files = await Promise.all(p.files.map((h) => h.getFile()));
    const proj = files.find((f) => /\.json$/i.test(f.name));
    if (proj) openProject(proj); else importFiles(files);
  });
}

// Para pruebas automáticas.
window.plotit = {
  get P() { return P; }, UI, hist, renderAll, parseDataText, tableFromParsed, pasteText, applyFormula, fillFormula, loadExample, importSciprj, importFiles,
  drawGraph, SvgCtx, runFit, fitState, lmFit, FIT_MODELS, compileExpr, activate, addGraph, addTable, makeDataCurve,
};
