'use strict';
// sciprj.js: abre proyectos de SciDAVis (.sciprj y .sciprj.gz, versiones 0.2 en adelante).
// El archivo es texto: una línea "SciDAVis x.y.z project file" y luego bloques. Cada tabla va
// entre <table> y </table>: una línea con la longitud del XML, el XML de la tabla (columnas con
// su papel, comentario, fórmula y filas) y la geometría de la ventana. Cada gráfica va entre
// <multiLayer> y </multiLayer>, con una capa por <graph>: sus líneas, separadas por tabuladores,
// dan las curvas ("curve", "ErrorBars", "FunctionCurve"), los títulos y las escalas.
// Se traen las tablas y las gráficas; matrices, notas y gráficas 3D se saltan.

const SCI_ROLE = { X: 'X', Y: 'Y', xErr: 'xErr', yErr: 'yErr' };
// Índice de símbolo de SciDAVis (SymbolBox) → símbolo de Plot.It.
const SCI_SYMBOL = { 1: 'circle', 2: 'square', 3: 'diamond', 4: 'triangle', 5: 'down', 6: 'triangle', 7: 'left', 8: 'right', 9: 'plus', 10: 'cross', 13: 'star', 14: 'star', 15: 'hexagon' };

async function readMaybeGzip(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    const ds = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(ds).text();
  }
  return new TextDecoder().decode(buf);
}

function sciVersion(line) {
  const m = /^(?:SciDAVis|QtiPlot)\s+(\d+)\.(\d+)\.(\d+)/.exec(line || '');
  return m ? (+m[1] << 16) + (+m[2] << 8) + +m[3] : -1;
}

// Una tabla del XML de SciDAVis → tabla de Plot.It (sin añadirla al proyecto).
function sciTable(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const el = doc.documentElement;
  if (!el || el.nodeName !== 'table' || doc.querySelector('parsererror')) return null;
  const rows = parseInt(el.getAttribute('rows'), 10) || 0;
  const kids = (node, name) => [...node.children].filter((k) => k.nodeName === name);
  const cols = kids(el, 'column').map((ce) => {
    const des = ce.getAttribute('plot_designation') || '';
    const numeric = /double|^1$/i.test(ce.getAttribute('type') || 'TypeDouble');
    const c = makeCol(ce.getAttribute('name') || '?', numeric ? SCI_ROLE[des] || 'none' : 'none', rows);
    // El comentario de la columna suele llevar la unidad: va a «Unidad o comentario».
    const com = kids(ce, 'comment')[0];
    if (com) c.unit = com.textContent.split('\\n')[0].trim().slice(0, 60);
    const fo = kids(ce, 'formula')[0];
    if (fo) c.formula = fo.textContent.trim();
    for (const r of kids(ce, 'row')) {
      const i = parseInt(r.getAttribute('index'), 10);
      if (!(i >= 0 && i < rows) || r.getAttribute('invalid') === 'yes') continue;
      const txt = r.textContent;
      if (numeric) { const v = parseFloat(txt); c.data[i] = isFinite(v) ? v : null; } else c.data[i] = txt === '' ? null : txt;
    }
    return c;
  });
  for (const w of kids(el, 'column_width')) {
    const c = cols[parseInt(w.getAttribute('column'), 10)];
    const px = parseInt(w.textContent, 10);
    if (c && px > 0) c.w = clamp(px, 40, 400);
  }
  if (!cols.length) return null;
  return { name: el.getAttribute('name') || 'Table', rows: Math.max(rows, 1), cols };
}

// "Tabla1_B" → { tb, col }: el nombre de la tabla puede llevar guiones bajos, así que se prueba
// cada tabla importada cuyo nombre sea un prefijo.
function sciColRef(tables, ref) {
  for (const tb of tables) {
    if (tb.sciName == null || !ref.startsWith(tb.sciName + '_')) continue;
    const col = tb.cols.find((c) => c.name === ref.slice(tb.sciName.length + 1));
    if (col) return { tb, col };
  }
  return null;
}

// Colores "#rrggbb" o, en SciDAVis 2, "#aarrggbb" (transparente: null).
function sciColor(s) {
  const m = /^#([0-9a-f]{2})?([0-9a-f]{6})$/i.exec(s || '');
  return m && m[1] !== '00' ? '#' + m[2].toLowerCase() : null;
}
// Las etiquetas de SciDAVis traen a veces HTML sencillo (<sub>, <sup>…): se pasan a la sintaxis de Plot.It.
const sciLabel = (s) => (s || '').replace(/<sub>(.*?)<\/sub>/gi, '_{$1}').replace(/<sup>(.*?)<\/sup>/gi, '^{$1}').replace(/<[^>]+>/g, '').trim();

// Curva de histograma (tipo 9). Con la versión 1.24 o posterior, el agrupamiento va en los campos 20–23:
// automático (1/0), anchura, inicio y fin; las filas usadas, en los antepenúltimo y penúltimo.
function sciHistogram(g, f, yr, tables) {
  const r0 = Math.max(0, parseInt(f[f.length - 3], 10) || 0), r1 = parseInt(f[f.length - 2], 10);
  const v = yr.col.data.slice(r0, r1 >= 0 ? r1 + 1 : undefined).filter(isNum);
  if (v.length < 2) return null;
  const w = parseFloat(f[21]), lo = parseFloat(f[22]), hi = parseFloat(f[23]);
  const opt = f[20] === '0' && w > 0 && hi > lo ? { bins: clamp(Math.round((hi - lo) / w), 1, 1000), lo, hi } : {};
  const H = histogram(v, opt);
  const cols = [colFrom(yr.col.name, 'X', H.center, yr.col.unit), colFrom(t('an_c_count'), 'Y', H.count)];
  const tb = addTable({ name: t('an_name_hist', { name: yr.col.name }), cols, rows: H.bins, numbered: false });
  tb.sciName = null; // no la referencian las curvas de SciDAVis
  tables.push(tb);
  const c = makeDataCurve(g, tb, cols[1], 'bars');
  Object.assign(c, { xc: cols[0].id, ye: null, xe: null, barW: 1, alpha: 0.55 });
  const col = sciColor(f[13]) || sciColor(f[5]);
  if (col) c.color = col;
  return c;
}

// Una capa (<graph>…</graph>) → gráfica de Plot.It.
function sciGraph(lines, name, tables) {
  const g = addGraph(name);
  const byY = new Map(); // nombre de la columna Y de SciDAVis → curva
  const items = []; // curvas en el orden de SciDAVis (las barras de error también cuentan) para la leyenda
  for (let i = 0; i < lines.length; i++) {
    let s = lines[i];
    // La leyenda puede ocupar varias líneas si su texto las tiene.
    if (s.startsWith('<legend>')) while (!s.includes('</legend>') && i + 1 < lines.length) s += '\n' + lines[++i];
    const f = s.split('\t');
    if (f[0] === 'curve') {
      const xr = sciColRef(tables, f[1]), yr = sciColRef(tables, f[2]);
      if (!yr) continue;
      const type = parseInt(f[3], 10);
      if (type === 9) {
        // Histograma: SciDAVis lo calcula al vuelo; aquí se hace su tabla de cuentas y se dibuja con barras.
        const h = sciHistogram(g, f, yr, tables);
        if (h) { g.curves.push(h); items.push({ c: h, def: f[2] }); }
        continue;
      }
      // Line 0, Scatter 1, LineSymbols 2, barras 3 y 10, Spline 7, escalones 8 y 15.
      const style = type === 1 ? 'scatter' : type === 2 ? 'both' : type === 3 || type === 10 ? 'bars' : 'line';
      const c = makeDataCurve(g, yr.tb, yr.col, style);
      c.xc = xr && xr.tb === yr.tb ? xr.col.id : null;
      c.ye = c.xe = null;
      const col = sciColor(style === 'scatter' ? f[10] : f[5]);
      if (col) c.color = col;
      const sym = SCI_SYMBOL[parseInt(f[9], 10)];
      if (sym) c.symbol = sym;
      const size = parseInt(f[8], 10);
      if (size > 0) c.size = clamp(size, 3, 30);
      const lw = parseFloat(f[7]);
      if (lw > 0) c.width = clamp(lw, 0.5, 8);
      if (f[11] === '-1') c.fill = false;
      if (f[f.length - 1] === '0') c.hidden = true;
      g.curves.push(c);
      byY.set(f[2], c);
      items.push({ c, def: f[2] });
    } else if (f[0] === 'ErrorBars') {
      items.push(null);
      const p = f.filter((v) => v !== '');
      const c = byY.get(p[3]), er = sciColRef(tables, p[4] || '');
      if (!c || !er || er.tb.id !== c.table) continue;
      // Dirección: 0 horizontal (error de x), 1 vertical (error de y).
      if (p[1] === '0') c.xe = er.col.id; else c.ye = er.col.id;
    } else if (f[0] === 'FunctionCurve') {
      // Tipo 0: y = f(x). La fórmula viene en las líneas <formula> siguientes; las curvas de un
      // ajuste llevan antes los parámetros, una línea "nombre=valor" cada uno.
      const spec = (f[1] || '').split(',');
      if (spec[0] !== '0' || lines[i + 1] !== '<formula>') { items.push(null); continue; }
      const j = lines.indexOf('</formula>', i + 2);
      const params = {}, body = [];
      for (const L of lines.slice(i + 2, j < 0 ? i + 3 : j)) {
        const m = /^\s*([A-Za-z_]\w*)\s*=\s*([-+0-9.eE]+)\s*$/.exec(L);
        if (m && isFinite(+m[2])) params[m[1]] = +m[2]; else if (L.trim()) body.push(L.trim());
      }
      let expr = body.join(' ');
      if (spec[2] && spec[2] !== 'x') expr = expr.replace(new RegExp(`\\b${spec[2]}\\b`, 'g'), 'x');
      const x0 = parseFloat(spec[3]), x1 = parseFloat(spec[4]);
      const c = {
        id: nid(), kind: 'func', expr, params, xmin: isFinite(x0) ? x0 : null, xmax: isFinite(x1) ? x1 : null,
        n: 400, label: '', style: 'line', color: sciColor(f[7]) || nextColor(g), width: 2, dash: 'solid', hidden: false,
      };
      g.curves.push(c);
      items.push({ c, def: spec[1] || '' });
    } else if (f[0] === '<legend>') {
      // Una entrada por curva, "\c{n}texto": n es la curva n-ésima de la capa.
      for (const e of f) {
        const m = /^\\c\{(\d+)\}(.*)$/.exec(e.trim());
        const it = m && items[+m[1] - 1];
        const text = m && sciLabel(m[2].replace(/<\/legend>$/, ''));
        if (it && text && text !== it.def) it.c.label = text;
      }
    } else if (f[0] === 'PlotTitle') g.title = f[1] || '';
    else if (f[0] === 'AxesTitles') { g.xlab = f[1] || ''; g.ylab = f[2] || ''; }
    else if (f[0] === 'scale') {
      // scale  eje  mín  máx  paso  marcas  menores  tipo(0 lineal, 1 log)  invertido. Ejes: 0 y izq., 2 x abajo.
      const ax = f[1] === '2' ? g.x : f[1] === '0' ? g.y : null;
      if (!ax) continue;
      const a = parseFloat(f[2]), b = parseFloat(f[3]);
      if (isFinite(a) && isFinite(b) && a < b) { ax.min = a; ax.max = b; }
      ax.log = f[7] === '1';
    }
  }
  g.title = sciLabel(g.title); g.xlab = sciLabel(g.xlab); g.ylab = sciLabel(g.ylab);
  return g;
}

// Devuelve { tables, graphs, skipped, log } con lo añadido a P, o { error } si no se puede leer.
async function importSciprj(file) {
  let text;
  try { text = await readMaybeGzip(file); } catch (e) { return { error: 'sci_bad' }; }
  const lines = text.split(/\r?\n/);
  const ver = sciVersion(lines[0]);
  if (ver < 0) return { error: 'sci_bad' };
  if (ver < 0x000200) return { error: 'sci_old' };
  const tables = [], graphs = [];
  let skipped = 0, log = '';
  for (let i = 1; i < lines.length; i++) {
    const s = lines[i];
    if (s === '<table>') {
      const len = parseInt(lines[i + 1], 10);
      let xml = lines[i + 2] || '', j = i + 3;
      while (xml.length < len && j < lines.length) xml += '\n' + lines[j++];
      while (j < lines.length && lines[j] !== '</table>') j++;
      i = j;
      const spec = sciTable(xml);
      if (!spec) { skipped++; continue; }
      const tb = addTable({ name: spec.name, cols: spec.cols, rows: spec.rows, numbered: false });
      tb.sciName = spec.name;
      tables.push(tb);
    } else if (s === '<multiLayer>') {
      const caption = (lines[i + 1] || '').split('\t')[0] || 'Graph';
      const layers = [];
      let j = i + 2;
      for (; j < lines.length && lines[j] !== '</multiLayer>'; j++) {
        if (lines[j].startsWith('<graph>')) {
          const k0 = j + 1;
          while (j < lines.length && lines[j] !== '</graph>') j++;
          layers.push(lines.slice(k0, j));
        }
      }
      i = j;
      layers.forEach((L, k) => graphs.push(sciGraph(L, layers.length > 1 ? `${caption} · ${k + 1}` : caption, tables)));
    } else if (s === '<log>') {
      // El registro de resultados de SciDAVis (los ajustes hechos): va al registro de Plot.It.
      const k0 = i + 1;
      while (i < lines.length && lines[i] !== '</log>') i++;
      log = lines.slice(k0, i).join('\n').trim();
    } else if (/^<(matrix|note|SurfacePlot|TableStatistics)>$/.test(s)) {
      const end = '</' + s.slice(1);
      while (i < lines.length && lines[i] !== end) i++;
      skipped++;
    }
  }
  for (const tb of tables) delete tb.sciName;
  return { tables, graphs, skipped, log };
}
