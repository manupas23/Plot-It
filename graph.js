'use strict';
// graph.js: dibujo de gráficas (la misma función pinta en pantalla, en PNG y en SVG),
// interacción (zoom, desplazamiento, lectura de puntos, rango de ajuste) y paneles de
// curvas, ajuste y ejes.
//
// Las gráficas se dibujan en "coordenadas de página" (W × H px, 800 × 600 por defecto),
// con fondo blanco y estilo de artículo; en pantalla se escala la página para que quepa.

const FONT = 'Arial, Helvetica, sans-serif';
const gview = $('gview'), gvctx = gview.getContext('2d');
const activeGraph = () => { const w = activeWin(); return w && w.type === 'graph' ? w : null; };

/* ---------- texto con subíndices, superíndices y símbolos ---------- */

// \alpha → α, etc. (el espacio de detrás se respeta). Los subíndices van con llaves (x_{0}) para no romper nombres como E_pair;
// los superíndices aceptan llaves o un número suelto (m^2, s^-1).
const TEX = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ',
  iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ',
  upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  AA: 'Å', deg: '°', circ: '°', cdot: '·', times: '×', pm: '±', mp: '∓', infty: '∞', approx: '≈', sim: '∼',
  leq: '≤', geq: '≥', neq: '≠', propto: '∝', hbar: 'ħ', partial: '∂', nabla: '∇', langle: '⟨', rangle: '⟩',
  to: '→', rightarrow: '→', leftarrow: '←', sqrt: '√', int: '∫', sum: 'Σ', minus: '−',
};
const texSym = (s) => s.replace(/\\([A-Za-z]+)/g, (m, k) => TEX[k] ?? m);

function richParse(s) {
  const segs = [];
  const push = (t, lvl) => {
    if (!t) return;
    const l = segs[segs.length - 1];
    if (l && l.lvl === lvl) l.t += t; else segs.push({ t, lvl });
  };
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if ((ch === '^' || ch === '_') && s[i + 1] === '{') {
      let depth = 1, j = i + 2;
      while (j < s.length && depth) { if (s[j] === '{') depth++; else if (s[j] === '}') depth--; j++; }
      push(texSym(s.slice(i + 2, depth ? j : j - 1)).replace(/[{}]/g, ''), ch === '^' ? 1 : -1);
      i = j;
      continue;
    }
    if (ch === '^') {
      const m = /^\^([-−+]?\d+(?:\.\d+)?)/.exec(s.slice(i));
      if (m) { push(m[1].replace('-', '−'), 1); i += m[0].length; continue; }
    }
    if (ch === '\\') {
      const m = /^\\([A-Za-z]+)/.exec(s.slice(i));
      if (m && m[1] in TEX) { push(TEX[m[1]], 0); i += m[0].length; continue; }
    }
    push(ch, 0);
    i++;
  }
  return segs;
}

// Familias de letra para las gráficas (sin comillas: así valen igual en canvas y en SVG).
const FAMILIES = {
  Arial: 'Arial, Helvetica, sans-serif', Helvetica: 'Helvetica, Arial, sans-serif', Calibri: 'Calibri, Carlito, sans-serif',
  Verdana: 'Verdana, sans-serif', Times: 'Times New Roman, Times, serif', Georgia: 'Georgia, serif', Mono: 'Consolas, Courier New, monospace',
  LaTeX: 'CMU Serif, Latin Modern Roman, Times New Roman, serif',
};
// La letra de LaTeX (CMU Serif: Computer Modern con griego) viene con la app, en fonts/cmu-serif.js, y
// se carga la primera vez que una gráfica la usa; mientras llega, se dibuja con la siguiente de la lista.
const LATEX_FONT = 'CMU Serif';
let latexFont = null; // promesa de la carga
function loadLatexFont() {
  if (!latexFont) {
    latexFont = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'fonts/cmu-serif.js';
      s.onload = async () => {
        try {
          for (const [w, b64] of Object.entries(window.CMU_SERIF)) {
            const bin = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
            document.fonts.add(await new FontFace(LATEX_FONT, bin.buffer, { weight: w }).load());
          }
        } catch (e) { /* sin la letra: se usa la siguiente de la lista */ }
        resolve();
        graphRender();
        renderSide();
      };
      s.onerror = () => resolve();
      document.head.append(s);
    });
  }
  return latexFont;
}
// Antes de exportar, la letra de la gráfica tiene que estar cargada.
const graphFontReady = (g) => (g.family === 'LaTeX' ? loadLatexFont() : Promise.resolve());
let fontCur = FONT; // familia de la gráfica que se está dibujando
function setFont(ctx, px, weight = 400) { ctx.font = `${weight} ${px}px ${fontCur}`; }

function richWidth(ctx, s, fs, weight = 400) {
  let w = 0;
  for (const g of richParse(String(s))) { setFont(ctx, g.lvl ? fs * 0.7 : fs, weight); w += ctx.measureText(g.t).width; }
  return w;
}

// Escribe texto enriquecido. vAlign: 'baseline', 'middle', 'top' o 'bottom'. Siempre se usa
// textAlign = left y la línea base alfabética (así el SVG no depende de cómo alinee cada visor).
function drawRich(ctx, s, x, y, fs, { align = 'left', vAlign = 'baseline', weight = 400 } = {}) {
  const segs = richParse(String(s));
  const ws = segs.map((g) => { setFont(ctx, g.lvl ? fs * 0.7 : fs, weight); return ctx.measureText(g.t).width; });
  const total = ws.reduce((a, b) => a + b, 0);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const by = vAlign === 'middle' ? y + fs * 0.35 : vAlign === 'top' ? y + fs * 0.78 : vAlign === 'bottom' ? y - fs * 0.24 : y;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  segs.forEach((g, k) => {
    setFont(ctx, g.lvl ? fs * 0.7 : fs, weight);
    ctx.fillText(g.t, cx, by + (g.lvl === 1 ? -fs * 0.36 : g.lvl === -1 ? fs * 0.2 : 0));
    cx += ws[k];
  });
  return total;
}

/* ---------- escalas y marcas de los ejes ---------- */

const tf = (v, log) => (log ? Math.log10(v) : v);
const itf = (u, log) => (log ? Math.pow(10, u) : u);

function niceStep(raw) {
  if (!(raw > 0) || !isFinite(raw)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
}

// Rango automático: de marca a marca (lineal) o de década a década (log).
function autoRange(a, b, log) {
  if (log) {
    let lo = Math.pow(10, Math.floor(Math.log10(a) + 1e-9)), hi = Math.pow(10, Math.ceil(Math.log10(b) - 1e-9));
    if (hi <= lo) { lo /= 10; hi *= 10; }
    return [lo, hi];
  }
  if (a === b) { const d = Math.abs(a) * 0.1 || 1; a -= d; b += d; }
  const st = niceStep((b - a) / 6);
  let lo = Math.floor(a / st + 1e-9) * st, hi = Math.ceil(b / st - 1e-9) * st;
  // Un punto justo en el borde quedaría medio cortado: se amplía una marca menor por ese lado.
  const m = Math.round((st / Math.pow(10, Math.floor(Math.log10(st) + 1e-9))) * 10) / 10;
  const mst = st / (m === 2 ? 4 : 5), tol = (hi - lo) * 0.01;
  if (a - lo < tol) lo -= mst;
  if (hi - b < tol) hi += mst;
  return [+lo.toPrecision(12), +hi.toPrecision(12)];
}

function rangeFor(ax, a, b, log, def) {
  let lo = ax.min, hi = ax.max;
  if (lo == null || hi == null) {
    const [alo, ahi] = a <= b ? autoRange(a, b, log) : def;
    if (lo == null) lo = alo;
    if (hi == null) hi = ahi;
  }
  if (log) {
    if (!(lo > 0)) lo = hi > 0 ? hi / 1000 : 0.1;
    if (!(hi > lo)) hi = lo * 100;
  } else if (!(hi > lo)) hi = lo + (Math.abs(lo) || 1);
  return [lo, hi];
}

const minusSign = (s) => s.replace(/^-/, '−');

// Marcas de un eje lineal. Opciones (o): step = paso fijo entre marcas principales; minor =
// marcas menores entre dos principales (0 = ninguna, null = automático); fmt = 'auto', 'dec'
// (decimal) o 'sci' (m×10^e); dec = número de decimales (null = automático).
function linTicks(lo, hi, n, o = {}) {
  let st = niceStep((hi - lo) / Math.max(1, n));
  if (o.step > 0 && (hi - lo) / o.step <= 500) st = o.step;
  const mag = Math.pow(10, Math.floor(Math.log10(st) + 1e-9));
  const m = Math.round((st / mag) * 10) / 10;
  const div = o.minor != null ? o.minor + 1 : m === 2 ? 4 : 5;
  const mst = st / div;
  const major = [], minor = [];
  for (let k = Math.ceil(lo / st - 1e-9); k * st <= hi + st * 1e-9; k++) major.push(+(k * st).toPrecision(12));
  if (div > 1 && (hi - lo) / mst <= 5000) for (let k = Math.ceil(lo / mst - 1e-9); k * mst <= hi + mst * 1e-9; k++) minor.push(k * mst);
  // Etiquetas: en automático, notación científica si los números son muy grandes o muy pequeños.
  const maxAbs = Math.max(...major.map(Math.abs));
  const sci = o.fmt === 'sci' || (o.fmt !== 'dec' && (maxAbs >= 1e5 || (maxAbs > 0 && maxAbs < 1e-3)));
  const fixed = o.dec != null;
  const labels = major.map((v) => {
    if (Math.abs(v) < st * 1e-6 && !(fixed && !sci)) return '0';
    if (!sci) {
      const d = fixed ? o.dec : Math.max(0, Math.ceil(-Math.log10(st) - 1e-9) + (m === 2.5 ? 1 : 0));
      return minusSign((Math.abs(v) < st * 1e-6 ? 0 : v).toFixed(clamp(d, 0, 12)));
    }
    const e = Math.floor(Math.log10(Math.abs(v)) + 1e-9);
    const mant = v / Math.pow(10, e);
    const d = fixed ? clamp(o.dec, 0, 12) : clamp(Math.ceil(-Math.log10(st / Math.pow(10, e)) - 1e-9), 0, 6);
    const ms = mant.toFixed(d);
    const es = e < 0 ? '−' + -e : String(e);
    if (!fixed && /^-?1(\.0*)?$/.test(ms)) return (mant < 0 ? '−' : '') + `10^{${es}}`;
    return `${minusSign(ms)}×10^{${es}}`;
  });
  return { major, minor, labels };
}

function logTicks(lo, hi, n, o = {}) {
  const ka = Math.ceil(Math.log10(lo) - 1e-9), kb = Math.floor(Math.log10(hi) + 1e-9);
  if (kb - ka + 1 < 2) {
    // Menos de dos décadas a la vista: marcas lineales sobre la escala logarítmica.
    const t = linTicks(lo, hi, n, { ...o, step: null });
    const keep = t.major.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0);
    return { major: keep.map((i) => t.major[i]), labels: keep.map((i) => t.labels[i]), minor: t.minor.filter((v) => v > 0) };
  }
  const every = Math.max(1, Math.ceil((kb - ka + 1) / Math.max(2, n)));
  const major = [], labels = [], minor = [];
  const lab = (k) => (o.fmt === 'dec' ? minusSign(String(+Math.pow(10, k).toPrecision(6))) : `10^{${k < 0 ? '−' + -k : k}}`);
  for (let k = ka; k <= kb; k++) {
    if ((k - ka) % every) { if (o.minor !== 0) minor.push(Math.pow(10, k)); continue; }
    major.push(Math.pow(10, k));
    labels.push(lab(k));
  }
  if (every === 1 && o.minor !== 0) {
    for (let k = ka - 1; k <= kb; k++) for (let m = 2; m <= 9; m++) { const v = m * Math.pow(10, k); if (v >= lo && v <= hi) minor.push(v); }
  }
  return { major, minor, labels };
}
const axisTicks = (lo, hi, log, n, o) => (log ? logTicks(lo, hi, n, o) : linTicks(lo, hi, n, o));

/* ---------- curvas ---------- */

function curveLabel(g, c) {
  if (c.label) return c.label;
  if (c.kind === 'func') return `f(x) = ${c.expr}`;
  const tb = win(c.table), y = colById(tb, c.yc);
  if (!tb || !y) return '?';
  const multi = new Set(g.curves.filter((d) => d.kind === 'data').map((d) => d.table)).size > 1;
  return (multi ? tb.name + ': ' : '') + colLabel(y);
}

// Puntos de una curva de datos: filas con x e y numéricas (x = nº de fila si no hay columna X).
function dataPoints(c) {
  const tb = win(c.table);
  const yc = colById(tb, c.yc);
  if (!yc) return [];
  const xc = colById(tb, c.xc), ye = colById(tb, c.ye), xe = colById(tb, c.xe);
  const pts = [];
  for (let r = 0; r < tb.rows; r++) {
    const x = xc ? xc.data[r] : r + 1, y = yc.data[r];
    if (!isNum(x) || !isNum(y)) continue;
    const ey = ye && isNum(ye.data[r]) ? Math.abs(ye.data[r]) : 0;
    const ex = xe && isNum(xe.data[r]) ? Math.abs(xe.data[r]) : 0;
    pts.push({ x, y, ex, ey, r });
  }
  return pts;
}

// Funciones compiladas, por expresión y parámetros.
const funcCache = new Map();
function funcOf(c) {
  const params = c.params || {};
  const key = c.expr + '\u0001' + JSON.stringify(params);
  let r = funcCache.get(key);
  if (!r) {
    const names = Object.keys(params);
    try {
      const fn = compileExpr(c.expr, { name: (n) => (n === 'x' ? 'v[0]' : names.includes(n) ? `v[${names.indexOf(n) + 1}]` : null) });
      const buf = new Float64Array(names.length + 1);
      names.forEach((n, j) => { buf[j + 1] = params[n]; });
      r = { f: (x) => { buf[0] = x; return fn(buf); } };
    } catch (e) { r = { err: e }; }
    if (funcCache.size > 300) funcCache.clear();
    funcCache.set(key, r);
  }
  return r;
}

function funcPoints(c, lo, hi, log) {
  const F = funcOf(c);
  if (!F.f) return [];
  const a = c.xmin != null ? Math.max(lo, c.xmin) : lo, b = c.xmax != null ? Math.min(hi, c.xmax) : hi;
  if (!(b > a)) return [];
  const n = clamp(c.n || 400, 10, 20000);
  const ua = tf(a, log), ub = tf(b, log);
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const x = itf(ua + ((ub - ua) * k) / n, log);
    let y;
    try { y = F.f(x); } catch (e) { y = NaN; }
    pts.push(isFinite(y) ? { x, y } : null);
  }
  return pts;
}

function symbolPath(ctx, kind, x, y, r) {
  switch (kind) {
    case 'square': ctx.rect(x - r * 0.86, y - r * 0.86, r * 1.72, r * 1.72); break;
    case 'triangle': ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r, y + r * 0.6); ctx.lineTo(x - r, y + r * 0.6); ctx.closePath(); break;
    case 'down': ctx.moveTo(x, y + r * 1.15); ctx.lineTo(x + r, y - r * 0.6); ctx.lineTo(x - r, y - r * 0.6); ctx.closePath(); break;
    case 'diamond': ctx.moveTo(x, y - r * 1.2); ctx.lineTo(x + r * 0.9, y); ctx.lineTo(x, y + r * 1.2); ctx.lineTo(x - r * 0.9, y); ctx.closePath(); break;
    case 'cross': { const d = r * 0.85; ctx.moveTo(x - d, y - d); ctx.lineTo(x + d, y + d); ctx.moveTo(x + d, y - d); ctx.lineTo(x - d, y + d); break; }
    case 'plus': ctx.moveTo(x - r * 1.1, y); ctx.lineTo(x + r * 1.1, y); ctx.moveTo(x, y - r * 1.1); ctx.lineTo(x, y + r * 1.1); break;
    case 'star':
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.5 : r * 1.2;
        k ? ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)) : ctx.moveTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
      }
      ctx.closePath();
      break;
    case 'left': ctx.moveTo(x - r * 1.15, y); ctx.lineTo(x + r * 0.6, y - r); ctx.lineTo(x + r * 0.6, y + r); ctx.closePath(); break;
    case 'right': ctx.moveTo(x + r * 1.15, y); ctx.lineTo(x - r * 0.6, y - r); ctx.lineTo(x - r * 0.6, y + r); ctx.closePath(); break;
    case 'pentagon': case 'hexagon': {
      const k = kind === 'hexagon' ? 6 : 5, rr = r * (k === 6 ? 1.05 : 1.1);
      for (let j = 0; j < k; j++) {
        const a = -Math.PI / 2 + (j * 2 * Math.PI) / k;
        j ? ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)) : ctx.moveTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
      }
      ctx.closePath();
      break;
    }
    default: ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 2 * Math.PI);
  }
}
const STROKE_SYMBOLS = new Set(['cross', 'plus']);
const DASHES = { solid: [], dash: [7, 4], dot: [1.5, 3], dashdot: [7, 3, 1.5, 3] };
const dashFor = (c) => (DASHES[c.dash] || []).map((v) => v * Math.max(1, c.width));

// Símbolos: relleno (fillColor, o el color de la curva; blanco si fill = false), opacidad del
// relleno (alpha) y borde del color de la curva (edge = grosor; por defecto solo si hace falta).
function drawSymbols(ctx, c, pts) {
  const r = c.size / 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  for (const p of pts) symbolPath(ctx, c.symbol, p.px, p.py, r);
  if (STROKE_SYMBOLS.has(c.symbol)) {
    ctx.strokeStyle = c.color; ctx.lineWidth = c.edge || Math.max(1, c.size / 6); ctx.stroke();
    return;
  }
  const hollow = c.fill === false;
  const edge = c.edge != null ? c.edge : hollow || (c.fillColor && c.fillColor !== c.color) ? Math.max(1, c.size / 7) : 0;
  ctx.globalAlpha = hollow ? 1 : clamp(c.alpha ?? 1, 0, 1);
  ctx.fillStyle = hollow ? '#fff' : c.fillColor || c.color;
  ctx.fill();
  ctx.globalAlpha = 1;
  if (edge > 0) { ctx.strokeStyle = c.color; ctx.lineWidth = edge; ctx.stroke(); }
}

// Traza la línea que une los puntos: recta, en escalones (con el salto a mitad de camino) o
// suave (spline de Catmull–Rom, que pasa por todos los puntos).
function tracePath(ctx, pts, connect) {
  ctx.moveTo(pts[0].px, pts[0].py);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i];
    if (connect === 'steps') {
      const xm = (p.px + q.px) / 2;
      ctx.lineTo(xm, p.py); ctx.lineTo(xm, q.py); ctx.lineTo(q.px, q.py);
    } else if (connect === 'spline' && pts.length > 2) {
      const a = pts[Math.max(0, i - 2)], d = pts[Math.min(pts.length - 1, i + 1)];
      ctx.bezierCurveTo(p.px + (q.px - a.px) / 6, p.py + (q.py - a.py) / 6, q.px - (d.px - p.px) / 6, q.py - (d.py - p.py) / 6, q.px, q.py);
    } else ctx.lineTo(q.px, q.py);
  }
}

/* ---------- dibujo de la gráfica ---------- */

// Formato por defecto: lo que falte en una gráfica, un eje o una curva (proyectos anteriores o
// valores sin tocar) toma estos valores. Los null también caen en el valor por defecto.
const GRAPH_DEF = {
  family: 'Arial', frame: 'box', lw: null, tickLen: null, grid: false, gridMinor: false, gridColor: '#d9d9d9',
  tickScale: 0.9, titleScale: 1.1, legendFrame: true, legendScale: 0.8, bg: '#ffffff',
};
const AXIS_DEF = { dir: 'in', mirror: true, minor: null, step: null, fmt: 'auto', dec: null, labels: true };
const CURVE_DEF = { fillColor: null, edge: null, alpha: 1, connect: 'straight', cap: null, errWidth: null, errColor: null, barW: 0.8 };
function withDef(o, def) {
  const r = { ...def };
  for (const k in o) if (o[k] != null || !(k in def)) r[k] = o[k];
  return r;
}

// Dibuja la gráfica g en un contexto 2D (canvas o SvgCtx) de W × H y devuelve su geometría.
function drawGraph(ctx, g0, W, H) {
  const g = withDef(g0, GRAPH_DEF), ax = withDef(g0.x, AXIS_DEF), ay = withDef(g0.y, AXIS_DEF);
  const fs = g.font, lx = ax.log, ly = ay.log;
  const ink = '#111';
  fontCur = FAMILIES[g.family] || FONT;
  if (g.family === 'LaTeX') loadLatexFont();
  ctx.save();
  if (g.bg !== 'none') { ctx.fillStyle = g.bg; ctx.fillRect(0, 0, W, H); }

  const vis = g.curves.filter((c) => !c.hidden);
  const series = vis.map((c) => ({ c, f: withDef(c, CURVE_DEF), pts: c.kind === 'data' ? dataPoints(c) : null }));
  // Barras: su anchura es la menor separación entre x consecutivas por la fracción barW.
  for (const s of series) {
    if (s.c.kind !== 'data' || s.c.style !== 'bars' || !s.pts.length) continue;
    const xs = s.pts.map((p) => p.x).sort((a, b) => a - b);
    let d = Infinity;
    for (let i = 1; i < xs.length; i++) if (xs[i] > xs[i - 1]) d = Math.min(d, xs[i] - xs[i - 1]);
    s.bw = (isFinite(d) ? d : Math.abs(xs[0]) || 1) * clamp(s.f.barW, 0.05, 1);
  }

  // Rango X: datos (con sus errores) y funciones con dominio propio.
  let xa = Infinity, xb = -Infinity;
  const addX = (v) => { if (isFinite(v) && (!lx || v > 0)) { if (v < xa) xa = v; if (v > xb) xb = v; } };
  for (const s of series) {
    if (s.pts) for (const p of s.pts) { addX(p.x - p.ex); addX(p.x + p.ex); if (p.ex && lx) addX(p.x); if (s.bw) { addX(p.x - s.bw / 2); addX(p.x + s.bw / 2); } }
    else { if (s.c.xmin != null) addX(s.c.xmin); if (s.c.xmax != null) addX(s.c.xmax); }
  }
  const [xlo, xhi] = rangeFor(g0.x, xa, xb, lx, lx ? [0.1, 100] : [-10, 10]);
  for (const s of series) if (!s.pts) s.pts = funcPoints(s.c, xlo, xhi, lx);

  // Rango Y: solo lo que cae dentro del rango X (las barras empiezan en cero).
  let ya = Infinity, yb = -Infinity;
  const addY = (v) => { if (isFinite(v) && (!ly || v > 0)) { if (v < ya) ya = v; if (v > yb) yb = v; } };
  for (const s of series) {
    if (s.bw && !ly) addY(0);
    for (const p of s.pts) {
      if (!p || p.x < xlo || p.x > xhi) continue;
      addY(p.y);
      if (p.ey) { addY(p.y - p.ey); addY(p.y + p.ey); }
    }
  }
  const [ylo, yhi] = rangeFor(g0.y, ya, yb, ly, ly ? [0.1, 100] : [-1, 1]);

  // Márgenes según el tamaño de las etiquetas y de las marcas que salen hacia fuera.
  const tfs = fs * g.tickScale, gap = fs * 0.45;
  const tick = g.tickLen != null ? g.tickLen : fs * 0.45, mtick = tick * 0.55;
  const outLen = (a) => (a.dir === 'out' || a.dir === 'both' ? tick : 0);
  const oX = outLen(ax), oY = outLen(ay);
  const top = g.title ? fs * (1.2 + g.titleScale) : fs * 0.9;
  const bottom = (ax.labels ? tfs + gap : 0) + oX + (g.xlab ? fs * 1.55 : 0) + fs * 0.55;
  const ph = Math.max(20, H - top - bottom);
  const yt = axisTicks(ylo, yhi, ly, Math.max(2, Math.round(ph / (fs * 3.2))), ay);
  const ylw = ay.labels ? Math.max(0, ...yt.labels.map((s) => richWidth(ctx, s, tfs))) : 0;
  const left = fs * 0.6 + (g.ylab ? fs * 1.5 : 0) + ylw + (ay.labels ? gap : 0) + oY;
  let right = fs * 1.2;
  let pw = Math.max(20, W - left - right);
  let nx = Math.max(2, Math.round(pw / (fs * 5.5)));
  let xt = axisTicks(xlo, xhi, lx, nx, ax);
  // Menos marcas si las etiquetas no caben (salvo con paso fijo).
  for (let guard = 0; guard < 8 && !(ax.step > 0); guard++) {
    const need = xt.labels.reduce((a, s) => a + richWidth(ctx, s, tfs) + fs, 0);
    if (need <= pw || nx <= 2) break;
    nx = Math.max(2, Math.floor(nx * 0.7));
    xt = axisTicks(xlo, xhi, lx, nx, ax);
  }
  const lastW = ax.labels && xt.labels.length ? richWidth(ctx, xt.labels[xt.labels.length - 1], tfs) : 0;
  right = Math.max(right, lastW / 2 + fs * 0.4);
  pw = Math.max(20, W - left - right);

  const ux0 = tf(xlo, lx), ux1 = tf(xhi, lx), uy0 = tf(ylo, ly), uy1 = tf(yhi, ly);
  const X = (v) => left + ((tf(v, lx) - ux0) / (ux1 - ux0)) * pw;
  const Y = (v) => top + ph - ((tf(v, ly) - uy0) / (uy1 - uy0)) * ph;
  const xinv = (px) => itf(ux0 + ((px - left) / pw) * (ux1 - ux0), lx);
  const yinv = (py) => itf(uy0 + ((top + ph - py) / ph) * (uy1 - uy0), ly);
  const inside = (v, lo, hi) => v >= lo - 1e-9 * Math.abs(hi - lo) && v <= hi + 1e-9 * Math.abs(hi - lo);

  // Rejilla: la menor, más tenue, debajo de la principal.
  const gridLines = (xs, ys) => {
    ctx.beginPath();
    for (const v of xs) if (inside(v, xlo, xhi)) { const x = X(v); ctx.moveTo(x, top); ctx.lineTo(x, top + ph); }
    for (const v of ys) if (inside(v, ylo, yhi)) { const y = Y(v); ctx.moveTo(left, y); ctx.lineTo(left + pw, y); }
    ctx.stroke();
  };
  ctx.setLineDash([]);
  ctx.strokeStyle = g.gridColor;
  if (g.gridMinor) { ctx.lineWidth = 0.7; ctx.globalAlpha = 0.5; gridLines(xt.minor, yt.minor); ctx.globalAlpha = 1; }
  if (g.grid) { ctx.lineWidth = 1; gridLines(xt.major, yt.major); }

  // Curvas, recortadas al área del gráfico.
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, pw, ph);
  ctx.clip();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const s of series) {
    const c = s.c, f = s.f;
    for (const p of s.pts) if (p) { p.px = X(p.x); p.py = Y(p.y); }
    const ok = (p) => p && isFinite(p.px) && isFinite(p.py);
    if (c.kind === 'func') {
      ctx.strokeStyle = c.color; ctx.lineWidth = c.width; ctx.setLineDash(dashFor(c));
      ctx.beginPath();
      let pen = false;
      for (const p of s.pts) {
        if (!ok(p)) { pen = false; continue; }
        pen ? ctx.lineTo(p.px, p.py) : ctx.moveTo(p.px, p.py);
        pen = true;
      }
      ctx.stroke();
      continue;
    }
    const pts = s.pts.filter(ok);
    if (s.bw) {
      const y0 = ly ? top + ph + 10 : Y(0);
      ctx.setLineDash([]);
      ctx.beginPath();
      for (const p of pts) {
        const xa1 = X(p.x - s.bw / 2), xb1 = X(p.x + s.bw / 2);
        ctx.rect(Math.min(xa1, xb1), Math.min(y0, p.py), Math.abs(xb1 - xa1), Math.abs(p.py - y0));
      }
      ctx.globalAlpha = clamp(f.alpha, 0, 1);
      ctx.fillStyle = f.fillColor || c.color;
      ctx.fill();
      ctx.globalAlpha = 1;
      const edge = f.edge != null ? f.edge : 1;
      if (edge > 0) { ctx.strokeStyle = c.color; ctx.lineWidth = edge; ctx.lineJoin = 'miter'; ctx.stroke(); ctx.lineJoin = 'round'; }
    }
    if (pts.some((p) => p.ey || p.ex)) {
      ctx.strokeStyle = f.errColor || c.color;
      ctx.lineWidth = f.errWidth != null ? f.errWidth : Math.max(0.8, Math.min(c.width, 1.5));
      ctx.setLineDash([]);
      const cap = f.cap != null ? f.cap : Math.max(2, c.size * 0.4);
      ctx.beginPath();
      for (const p of pts) {
        if (p.ey) {
          const y1 = Y(p.y - p.ey), y2 = Y(p.y + p.ey);
          if (isFinite(y2)) {
            const ya1 = isFinite(y1) ? y1 : top + ph + 10;
            ctx.moveTo(p.px, ya1); ctx.lineTo(p.px, y2);
            if (cap > 0) {
              ctx.moveTo(p.px - cap, y2); ctx.lineTo(p.px + cap, y2);
              if (isFinite(y1)) { ctx.moveTo(p.px - cap, y1); ctx.lineTo(p.px + cap, y1); }
            }
          }
        }
        if (p.ex) {
          const x1 = X(p.x - p.ex), x2 = X(p.x + p.ex);
          if (isFinite(x2)) {
            const xa1 = isFinite(x1) ? x1 : left - 10;
            ctx.moveTo(xa1, p.py); ctx.lineTo(x2, p.py);
            if (cap > 0) {
              ctx.moveTo(x2, p.py - cap); ctx.lineTo(x2, p.py + cap);
              if (isFinite(x1)) { ctx.moveTo(x1, p.py - cap); ctx.lineTo(x1, p.py + cap); }
            }
          }
        }
      }
      ctx.stroke();
    }
    if ((c.style === 'line' || c.style === 'both') && pts.length > 1) {
      ctx.strokeStyle = c.color; ctx.lineWidth = c.width; ctx.setLineDash(dashFor(c));
      ctx.beginPath();
      tracePath(ctx, pts, f.connect);
      ctx.stroke();
    }
    if (c.style === 'scatter' || c.style === 'both') drawSymbols(ctx, f, pts);
  }
  ctx.restore();

  // Marcas (hacia dentro, fuera, a ambos lados o ninguna) y marco cerrado o solo dos ejes.
  const lw = g.lw != null ? g.lw : Math.max(1, fs / 14);
  const box = g.frame === 'box';
  const span = (dir, len) => (dir === 'in' ? [0, len] : dir === 'out' ? [0, -len] : dir === 'both' ? [-len, len] : null);
  ctx.setLineDash([]);
  ctx.strokeStyle = ink;
  ctx.lineWidth = lw;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  for (const [vals, len] of [[xt.major, tick], [xt.minor, mtick]]) {
    const sp = span(ax.dir, len);
    if (!sp) break;
    for (const v of vals) {
      if (!inside(v, xlo, xhi)) continue;
      const x = X(v);
      ctx.moveTo(x, top + ph - sp[0]); ctx.lineTo(x, top + ph - sp[1]);
      if (box && ax.mirror) { ctx.moveTo(x, top + sp[0]); ctx.lineTo(x, top + sp[1]); }
    }
  }
  for (const [vals, len] of [[yt.major, tick], [yt.minor, mtick]]) {
    const sp = span(ay.dir, len);
    if (!sp) break;
    for (const v of vals) {
      if (!inside(v, ylo, yhi)) continue;
      const y = Y(v);
      ctx.moveTo(left + sp[0], y); ctx.lineTo(left + sp[1], y);
      if (box && ay.mirror) { ctx.moveTo(left + pw - sp[0], y); ctx.lineTo(left + pw - sp[1], y); }
    }
  }
  ctx.stroke();
  ctx.lineJoin = 'miter';
  if (box) ctx.strokeRect(left, top, pw, ph);
  else if (g.frame === 'axes') {
    ctx.beginPath();
    ctx.moveTo(left, top); ctx.lineTo(left, top + ph); ctx.lineTo(left + pw, top + ph);
    ctx.stroke();
  }

  // Etiquetas de las marcas, títulos de los ejes y título.
  ctx.fillStyle = ink;
  if (ax.labels) xt.major.forEach((v, i) => { if (inside(v, xlo, xhi)) drawRich(ctx, xt.labels[i], X(v), top + ph + gap + oX, tfs, { align: 'center', vAlign: 'top' }); });
  if (ay.labels) yt.major.forEach((v, i) => { if (inside(v, ylo, yhi)) drawRich(ctx, yt.labels[i], left - gap - oY, Y(v), tfs, { align: 'right', vAlign: 'middle' }); });
  if (g.xlab) drawRich(ctx, g.xlab, left + pw / 2, H - fs * 0.45, fs, { align: 'center', vAlign: 'bottom' });
  if (g.ylab) {
    ctx.save();
    ctx.translate(fs * 0.6 + fs * 0.62, top + ph / 2);
    ctx.rotate(-Math.PI / 2);
    drawRich(ctx, g.ylab, 0, 0, fs, { align: 'center', vAlign: 'middle' });
    ctx.restore();
  }
  if (g.title) drawRich(ctx, g.title, left + pw / 2, fs * 0.55, fs * g.titleScale, { align: 'center', vAlign: 'top', weight: 700 });

  drawLegend(ctx, g, series, { left, top, pw, ph }, fs);
  ctx.restore();
  fontCur = FONT;
  return { left, top, pw, ph, X, Y, xinv, yinv, xr: [xlo, xhi], yr: [ylo, yhi], lx, ly, series };
}

function drawLegend(ctx, g, series, box, fs) {
  const pos = g.legend === 'auto' ? (series.length >= 2 ? 'tr' : 'off') : g.legend;
  if (pos === 'off' || !series.length) return;
  const lfs = fs * g.legendScale, row = lfs * 1.5, sample = lfs * 2.4, pad = lfs * 0.6, m = fs * 0.6;
  const labels = series.map((s) => curveLabel(g, s.c));
  const tw = Math.max(...labels.map((l) => richWidth(ctx, l, lfs)));
  const bw = pad * 2 + sample + lfs * 0.6 + tw, bh = pad * 2 + row * series.length - (row - lfs * 1.2);
  const bx = pos[1] === 'r' ? box.left + box.pw - m - bw : box.left + m;
  const by = pos[0] === 't' ? box.top + m : box.top + box.ph - m - bh;
  ctx.setLineDash([]);
  if (g.legendFrame) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#8a8a8a';
    ctx.lineWidth = Math.max(0.8, fs / 22);
    ctx.strokeRect(bx, by, bw, bh);
  }
  series.forEach((s, i) => {
    const c = s.c, f = s.f, cy = by + pad + lfs * 0.6 + row * i, x0 = bx + pad;
    if (s.bw) {
      const hh = lfs * 0.8;
      ctx.globalAlpha = clamp(f.alpha, 0, 1);
      ctx.fillStyle = f.fillColor || c.color;
      ctx.fillRect(x0 + sample * 0.15, cy - hh / 2, sample * 0.7, hh);
      ctx.globalAlpha = 1;
      if ((f.edge ?? 1) > 0) { ctx.strokeStyle = c.color; ctx.lineWidth = f.edge ?? 1; ctx.strokeRect(x0 + sample * 0.15, cy - hh / 2, sample * 0.7, hh); }
    } else {
      if (c.kind === 'func' || c.style === 'line' || c.style === 'both') {
        ctx.strokeStyle = c.color; ctx.lineWidth = c.width; ctx.setLineDash(dashFor(c)); ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(x0 + sample, cy); ctx.stroke();
      }
      if (c.kind === 'data' && c.style !== 'line') drawSymbols(ctx, { ...f, size: Math.min(c.size, lfs * 0.9) }, [{ px: x0 + sample / 2, py: cy }]);
    }
    ctx.fillStyle = '#111';
    drawRich(ctx, labels[i], x0 + sample + lfs * 0.6, cy, lfs, { vAlign: 'middle' });
  });
}

/* ---------- SVG: contexto 2D mínimo que escribe elementos SVG ---------- */

const r2 = (v) => +v.toFixed(2);
class SvgCtx {
  constructor(W, H) {
    this.W = W; this.H = H; this.out = []; this.defs = []; this.stack = []; this.nclip = 0;
    this.fillStyle = '#000'; this.strokeStyle = '#000'; this.lineWidth = 1; this.font = `400 10px ${FONT}`;
    this.globalAlpha = 1; this.lineJoin = 'miter'; this.lineCap = 'butt'; this.textAlign = 'left'; this.textBaseline = 'alphabetic';
    this.dash = []; this.clipId = null; this.m = [1, 0, 0, 1, 0, 0]; this.d = '';
    this.meas = document.createElement('canvas').getContext('2d');
    this.latex = new Set(); // pesos de la letra LaTeX usados: se incrustan en el SVG
  }
  save() {
    const { fillStyle, strokeStyle, lineWidth, font, globalAlpha, lineJoin, lineCap, dash, clipId } = this;
    this.stack.push({ fillStyle, strokeStyle, lineWidth, font, globalAlpha, lineJoin, lineCap, dash, clipId, m: this.m.slice() });
  }
  restore() { const s = this.stack.pop(); if (s) Object.assign(this, s); }
  setLineDash(a) { this.dash = a.slice(); }
  translate(x, y) { const m = this.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; }
  rotate(a) {
    const [p, q, r, s] = this.m, c = Math.cos(a), n = Math.sin(a);
    this.m[0] = p * c + r * n; this.m[1] = q * c + s * n; this.m[2] = r * c - p * n; this.m[3] = s * c - q * n;
  }
  scale(sx, sy) { const m = this.m; m[0] *= sx; m[1] *= sx; m[2] *= sy; m[3] *= sy; }
  pt(x, y) { const m = this.m; return `${r2(m[0] * x + m[2] * y + m[4])} ${r2(m[1] * x + m[3] * y + m[5])}`; }
  beginPath() { this.d = ''; }
  moveTo(x, y) { this.d += 'M' + this.pt(x, y); }
  lineTo(x, y) { this.d += 'L' + this.pt(x, y); }
  bezierCurveTo(a, b, c, d, x, y) { this.d += 'C' + this.pt(a, b) + ' ' + this.pt(c, d) + ' ' + this.pt(x, y); }
  closePath() { this.d += 'Z'; }
  rect(x, y, w, h) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); }
  arc(x, y, r) { // solo círculos completos
    const k = r2(r);
    this.d += 'M' + this.pt(x + r, y) + `A${k} ${k} 0 1 0 ` + this.pt(x - r, y) + `A${k} ${k} 0 1 0 ` + this.pt(x + r, y) + 'Z';
  }
  extra() { return (this.clipId ? ` clip-path="url(#${this.clipId})"` : '') + (this.globalAlpha < 1 ? ` opacity="${this.globalAlpha}"` : ''); }
  stroke() {
    if (!this.d) return;
    const dash = this.dash.length ? ` stroke-dasharray="${this.dash.map(r2).join(' ')}"` : '';
    this.out.push(`<path d="${this.d}" fill="none" stroke="${this.strokeStyle}" stroke-width="${r2(this.lineWidth)}" stroke-linejoin="${this.lineJoin}" stroke-linecap="${this.lineCap}"${dash}${this.extra()}/>`);
  }
  fill() { if (this.d) this.out.push(`<path d="${this.d}" fill="${this.fillStyle}"${this.extra()}/>`); }
  fillRect(x, y, w, h) { const d = this.d; this.beginPath(); this.rect(x, y, w, h); this.fill(); this.d = d; }
  strokeRect(x, y, w, h) { const d = this.d; this.beginPath(); this.rect(x, y, w, h); this.stroke(); this.d = d; }
  clip() { const id = 'clip' + ++this.nclip; this.defs.push(`<clipPath id="${id}"><path d="${this.d}"/></clipPath>`); this.clipId = id; }
  measureText(s) { this.meas.font = this.font; return this.meas.measureText(s); }
  fillText(s, x, y) {
    const size = +(/([\d.]+)px/.exec(this.font) || [0, 10])[1];
    const weight = (/^(\d{3}|bold)/.exec(this.font) || [0, '400'])[1];
    const family = this.font.replace(/^\S+\s+[\d.]+px\s+/, '');
    if (family.startsWith(LATEX_FONT)) this.latex.add(weight);
    const m = this.m;
    const plain = m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1;
    const pos = plain ? ` x="${r2(x + m[4])}" y="${r2(y + m[5])}"` : ` x="${r2(x)}" y="${r2(y)}" transform="matrix(${m.map((v) => +v.toFixed(6)).join(' ')})"`;
    this.out.push(`<text${pos} font-size="${r2(size)}"${family !== FONT ? ` font-family="${esc(family)}"` : ''}${weight !== '400' ? ` font-weight="${weight}"` : ''} fill="${this.fillStyle}"${this.extra()}>${esc(s.replace(/ /g, ' '))}</text>`);
  }
  toString() {
    // La letra LaTeX no está instalada en casi ningún equipo: va dentro del SVG.
    const fonts = window.CMU_SERIF ? [...this.latex].filter((w) => CMU_SERIF[w]).map((w) =>
      `@font-face{font-family:'${LATEX_FONT}';font-weight:${w};src:url(data:font/woff2;base64,${CMU_SERIF[w]}) format('woff2')}`).join('') : '';
    const style = fonts ? `<style>${fonts}</style>` : '';
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${this.W}" height="${this.H}" viewBox="0 0 ${this.W} ${this.H}" font-family="${FONT}" xml:space="preserve">\n<defs>${style}${this.defs.join('')}</defs>\n${this.out.join('\n')}\n</svg>\n`;
  }
}

// La página de la gráfica en un canvas, a la escala elegida para el PNG.
function pngCanvas(g) {
  const sc = +$('gPngScale').value || 2;
  const cv = document.createElement('canvas');
  cv.width = Math.round(g.W * sc);
  cv.height = Math.round(g.H * sc);
  const ctx = cv.getContext('2d');
  ctx.scale(sc, sc);
  drawGraph(ctx, g, g.W, g.H);
  return cv;
}
function svgString(g) {
  const ctx = new SvgCtx(g.W, g.H);
  drawGraph(ctx, g, g.W, g.H);
  return ctx.toString();
}
async function exportPng(g) {
  await graphFontReady(g);
  pngCanvas(g).toBlob((b) => download(fileSafe(g.name) + '.png', b), 'image/png');
}
async function exportSvg(g) {
  await graphFontReady(g);
  download(fileSafe(g.name) + '.svg', svgString(g), 'image/svg+xml');
}

/* ---------- vista en pantalla ---------- */

let gGeom = null; // { s, ox, oy, G }: escala y posición de la página, geometría del gráfico
let gQueued = false;
function graphRender() {
  if (gQueued) return;
  gQueued = true;
  requestAnimationFrame(graphRenderNow);
}
// Dibuja la página de g centrada en el canvas cv, que ocupa todo pane. Devuelve la escala, la
// posición de la página y la geometría del gráfico, y deja el contexto en coordenadas de página.
function paintGraph(cv, ctx, pane, g) {
  const CW = pane.clientWidth, CH = pane.clientHeight;
  if (!CW || !CH) return null;
  const dpr = window.devicePixelRatio || 1;
  const bw = Math.round(CW * dpr), bh = Math.round(CH * dpr);
  if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, CW, CH);
  const m = 18;
  const s = Math.max(0.05, Math.min((CW - 2 * m) / g.W, (CH - 2 * m) / g.H));
  const ox = Math.round((CW - g.W * s) / 2), oy = Math.round((CH - g.H * s) / 2);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#fff';
  ctx.fillRect(ox, oy, g.W * s, g.H * s);
  ctx.restore();
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
  return { s, ox, oy, G: drawGraph(ctx, g, g.W, g.H), g };
}
function graphRenderNow() {
  gQueued = false;
  const g = activeGraph();
  if (!g) return;
  const geo = paintGraph(gview, gvctx, $('graphPane'), g);
  if (!geo) return;
  const ctx = gvctx, { s, G } = geo;
  // Rango de ajuste: banda azul (solo en pantalla).
  const F = UI.fit.get(g.id);
  const band = gDrag && gDrag.mode === 'range' ? [gDrag.a, gDrag.b] : F ? [F.xmin, F.xmax] : [null, null];
  if (band[0] != null || band[1] != null) {
    let a = band[0] != null ? G.X(band[0]) : G.left, b = band[1] != null ? G.X(band[1]) : G.left + G.pw;
    if (a > b) [a, b] = [b, a];
    a = clamp(a, G.left, G.left + G.pw); b = clamp(b, G.left, G.left + G.pw);
    ctx.fillStyle = 'rgba(57,135,229,0.10)';
    ctx.fillRect(a, G.top, b - a, G.ph);
    ctx.strokeStyle = '#3987e5'; ctx.lineWidth = 1.2 / s; ctx.setLineDash([5 / s, 4 / s]);
    ctx.beginPath();
    for (const x of [a, b]) if (x > G.left + 0.5 && x < G.left + G.pw - 0.5) { ctx.moveTo(x, G.top); ctx.lineTo(x, G.top + G.ph); }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  gGeom = geo;
}

const toPage = (e) => ({ x: (e.offsetX - gGeom.ox) / gGeom.s, y: (e.offsetY - gGeom.oy) / gGeom.s });
const inPlot = (p, G) => p.x >= G.left && p.x <= G.left + G.pw && p.y >= G.top && p.y <= G.top + G.ph;

let gDrag = null, wheelTimer = 0;
gview.addEventListener('pointerdown', (e) => {
  if (!gGeom || e.button !== 0) return;
  const p = toPage(e), G = gGeom.G;
  if (!inPlot(p, G)) return;
  stopScaleAnim();
  gview.setPointerCapture(e.pointerId);
  $('gtip').hidden = true;
  if (e.shiftKey) {
    const x = G.xinv(p.x);
    gDrag = { mode: 'range', a: x, b: x, x0: e.offsetX };
  } else gDrag = { mode: 'pan', x0: e.offsetX, y0: e.offsetY, xr: G.xr.slice(), yr: G.yr.slice(), moved: false };
});
gview.addEventListener('pointermove', (e) => {
  if (!gGeom) return;
  const g = activeGraph(), G = gGeom.G;
  if (gDrag && gDrag.mode === 'pan') {
    const dx = (e.offsetX - gDrag.x0) / gGeom.s, dy = (e.offsetY - gDrag.y0) / gGeom.s;
    if (Math.abs(dx) + Math.abs(dy) < 2 && !gDrag.moved) return;
    gDrag.moved = true;
    const shift = (r, d, len, log) => {
      const u0 = tf(r[0], log), u1 = tf(r[1], log), du = (d / len) * (u1 - u0);
      return [itf(u0 - du, log), itf(u1 - du, log)];
    };
    [g.x.min, g.x.max] = shift(gDrag.xr, dx, G.pw, g.x.log);
    [g.y.min, g.y.max] = shift(gDrag.yr, -dy, G.ph, g.y.log);
    graphRender();
    syncAxesPanel();
    return;
  }
  if (gDrag && gDrag.mode === 'range') {
    const p = toPage(e);
    gDrag.b = G.xinv(clamp(p.x, G.left, G.left + G.pw));
    graphRender();
    return;
  }
  hover(e);
});
gview.addEventListener('pointerup', () => {
  if (!gDrag) return;
  const d = gDrag;
  gDrag = null;
  const g = activeGraph();
  if (d.mode === 'pan' && d.moved) hist.commit();
  if (d.mode === 'range') {
    const F = fitState(g);
    const G = gGeom.G;
    if (Math.abs(G.X(d.b) - G.X(d.a)) < 3) { F.xmin = F.xmax = null; }
    else { F.xmin = +Math.min(d.a, d.b).toPrecision(6); F.xmax = +Math.max(d.a, d.b).toPrecision(6); }
    syncFitPanel();
    const p = document.querySelector('.panel[data-p="fit"]');
    if (p) p.open = true;
  }
  graphRender();
});
gview.addEventListener('pointerleave', () => { $('gtip').hidden = true; $('cursorReadout').textContent = ''; });
// Doble clic dentro del gráfico: autoescala; en los ejes o los márgenes: formato de la gráfica.
gview.addEventListener('dblclick', (e) => { if (gGeom && !inPlot(toPage(e), gGeom.G)) openGraphFormat(); else autoscale(); });
gview.addEventListener('wheel', (e) => {
  if (!gGeom) return;
  const p = toPage(e), G = gGeom.G;
  if (!inPlot(p, G)) return;
  e.preventDefault();
  stopScaleAnim();
  const g = activeGraph();
  const delta = (e.deltaY || e.deltaX) * (e.deltaMode === 1 ? 33 : 1);
  const f = Math.exp(clamp(delta, -300, 300) * 0.0015);
  const zoom = (r, c, log) => {
    const u0 = tf(r[0], log), u1 = tf(r[1], log), uc = tf(c, log);
    return [itf(uc - (uc - u0) * f, log), itf(uc + (u1 - uc) * f, log)];
  };
  if (!e.altKey) [g.x.min, g.x.max] = zoom(G.xr, G.xinv(p.x), g.x.log);
  if (!e.shiftKey) [g.y.min, g.y.max] = zoom(G.yr, G.yinv(p.y), g.y.log);
  graphRender();
  syncAxesPanel();
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(() => hist.commit(), 400);
}, { passive: false });

// Punto de datos a menos de 10 px de p (en coordenadas de la página), o null.
function nearestPoint(p) {
  let best = null, bd = 10 / gGeom.s;
  for (const s of gGeom.G.series) {
    if (s.c.kind !== 'data') continue;
    for (const q of s.pts) {
      const d = Math.abs(q.px - p.x) + Math.abs(q.py - p.y);
      if (d < bd) { bd = d; best = { s, q }; }
    }
  }
  return best;
}
function hover(e) {
  const tip = $('gtip'), G = gGeom.G, g = activeGraph();
  const p = toPage(e);
  if (!inPlot(p, G)) { tip.hidden = true; $('cursorReadout').textContent = ''; return; }
  $('cursorReadout').textContent = `x = ${fmtNum(G.xinv(p.x), 5)}   y = ${fmtNum(G.yinv(p.y), 5)}`;
  const best = nearestPoint(p);
  if (!best) { tip.hidden = true; return; }
  const { s, q } = best, c = s.c, tb = win(c.table);
  const xc = colById(tb, c.xc), yc = colById(tb, c.yc), ye = colById(tb, c.ye);
  tip.innerHTML = `<b>${esc(curveLabel(g, c))}</b> · ${esc(t('tip_row', { r: q.r + 1 }))}<br>${esc(xc ? xc.name : t('row_number'))} = ${fmtCell(q.x)}<br>${esc(yc.name)} = ${fmtCell(q.y)}${ye && q.ey ? ` ± ${fmtCell(q.ey)}` : ''}`;
  tip.hidden = false;
  const sx = gGeom.ox + q.px * gGeom.s, sy = gGeom.oy + q.py * gGeom.s;
  const W = gview.clientWidth, tw = tip.offsetWidth, th = tip.offsetHeight;
  tip.style.left = clamp(sx + 14 + tw > W ? sx - tw - 14 : sx + 14, 4, W - tw - 4) + 'px';
  tip.style.top = clamp(sy - th - 10, 4, gview.clientHeight - th - 4) + 'px';
}

// Autoescala: los ejes se desplazan con una transición suave (unos 400 ms) desde el rango que se ve
// hasta el automático. Se interpola en la escala del eje (logarítmica si lo es). La rueda o un
// arrastre la interrumpen y siguen desde donde esté; con "reducir movimiento" en el sistema es
// instantánea.
let scaleAnim = 0;
const offCtx = document.createElement('canvas').getContext('2d');
function stopScaleAnim() {
  cancelAnimationFrame(scaleAnim);
  scaleAnim = 0;
}
// Rangos que daría la autoescala, dibujando la gráfica en un canvas que no se ve.
function autoRanges(g) {
  const keep = [g.x.min, g.x.max, g.y.min, g.y.max];
  g.x.min = g.x.max = g.y.min = g.y.max = null;
  const G = drawGraph(offCtx, g, g.W, g.H);
  [g.x.min, g.x.max, g.y.min, g.y.max] = keep;
  return [G.xr, G.yr];
}
function autoscale() {
  const g = activeGraph();
  if (!g) return;
  stopScaleAnim();
  const done = () => {
    g.x.min = g.x.max = g.y.min = g.y.max = null;
    hist.commit();
    graphRender();
    syncAxesPanel();
  };
  const G = gGeom && gGeom.g === g ? gGeom.G : null;
  const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!G || still || !!G.lx !== !!g.x.log || !!G.ly !== !!g.y.log) { done(); return; }
  const [xt, yt] = autoRanges(g);
  const lx = G.lx, ly = G.ly;
  const ends = [[G.xr, xt, lx], [G.yr, yt, ly]].map(([a, b, log]) => [tf(a[0], log), tf(a[1], log), tf(b[0], log), tf(b[1], log)]);
  if (!ends.flat().every(Number.isFinite)) { done(); return; }
  const near = ([a0, a1, b0, b1]) => Math.abs(a0 - b0) + Math.abs(a1 - b1) <= 1e-9 * (Math.abs(b1 - b0) || 1);
  if (ends.every(near)) { done(); return; }
  const t0 = performance.now(), dur = 400;
  const ease = (s) => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(2 - 2 * s, 3) / 2);
  const frame = (now) => {
    scaleAnim = 0;
    // Si se ha cambiado de pestaña o se ha deshecho algo entretanto, la autoescala se aplica sin más.
    if (activeGraph() !== g) { if (P.wins.includes(g)) { g.x.min = g.x.max = g.y.min = g.y.max = null; hist.commit(); } return; }
    const s = Math.min(1, (now - t0) / dur);
    if (s >= 1) { done(); return; }
    const e = ease(s);
    const at = ([a0, a1, b0, b1], log) => [itf(a0 + (b0 - a0) * e, log), itf(a1 + (b1 - a1) * e, log)];
    [g.x.min, g.x.max] = at(ends[0], lx);
    [g.y.min, g.y.max] = at(ends[1], ly);
    graphRenderNow();
    scaleAnim = requestAnimationFrame(frame);
  };
  scaleAnim = requestAnimationFrame(frame);
}

/* ---------- panel de curvas ---------- */

const STYLE_TAG = { scatter: '•', line: '—', both: '•—', bars: '▮' };
function syncCurvesPanel() {
  const g = activeGraph();
  if (!g) return;
  let sel = UI.curve.get(g.id);
  if (!g.curves.some((c) => c.id === sel)) { sel = g.curves.length ? g.curves[0].id : null; UI.curve.set(g.id, sel); }
  $('curveList').innerHTML = g.curves.length ? g.curves.map((c) => `<div class="curve${c.id === sel ? ' sel' : ''}" data-id="${c.id}">
      <input type="checkbox" data-k="vis"${c.hidden ? '' : ' checked'} title="${esc(t('curve_vis_t'))}">
      <input type="color" data-k="color" value="${c.color}" title="${esc(t('curve_color_t'))}">
      <span class="cl" title="${esc(curveLabel(g, c))}">${esc(curveLabel(g, c))}</span>
      <span class="ck">${c.kind === 'func' ? (c.fitOf != null || c.model ? t('tag_fit') : 'f(x)') : STYLE_TAG[c.style]}</span>
      <button data-k="del" title="${esc(t('curve_del_t'))}">×</button></div>`).join('')
    : `<div class="none">${esc(t('no_curves'))}</div>`;
  const c = g.curves.find((d) => d.id === sel);
  $('curveProps').innerHTML = c ? curvePropsHtml(g, c) : '';
  syncAddRow();
}

function opt(v, label, cur) { return `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(label)}</option>`; }
function curvePropsHtml(g, c) {
  const field = (k, label, inner, wide) => `<label${wide ? ' class="wide"' : ''}><span>${esc(label)}</span>${inner}</label>`;
  const num = (k, v, attrs = '') => `<input type="number" data-f="${k}" value="${v ?? ''}" ${attrs}>`;
  let h = '<div class="grid2 sub">';
  h += field('label', t('c_label'), `<input type="text" data-f="label" value="${esc(c.label || '')}" placeholder="${esc(curveLabel(g, { ...c, label: '' }))}">`, true);
  if (c.kind === 'data') {
    const tb = win(c.table);
    const cols = tb ? tb.cols : [];
    const colOpts = (cur, none) => (none ? opt('', none, cur ?? '') : '') + cols.map((k) => opt(k.id, k.name, cur)).join('');
    h += field('table', t('c_table'), `<select data-f="table">${tablesList().map((w) => opt(w.id, w.name, c.table)).join('')}</select>`);
    h += field('yc', 'Y', `<select data-f="yc">${colOpts(c.yc)}</select>`);
    h += field('xc', 'X', `<select data-f="xc">${colOpts(c.xc, t('row_number'))}</select>`);
    h += field('ye', t('c_yerr'), `<select data-f="ye">${colOpts(c.ye, t('none'))}</select>`);
    h += field('xe', t('c_xerr'), `<select data-f="xe">${colOpts(c.xe, t('none'))}</select>`);
    h += field('style', t('c_style'), `<select data-f="style">${['scatter', 'line', 'both', 'bars'].map((s) => opt(s, t('st_' + s), c.style)).join('')}</select>`);
    h += field('symbol', t('c_symbol'), `<select data-f="symbol">${SYMBOLS.map((s) => opt(s, t('sym_' + s), c.symbol)).join('')}</select>`);
    h += field('size', t('c_size'), num('size', c.size, 'min="1" max="60" step="1"'));
    h += `<label class="chk inline"><input type="checkbox" data-f="fill"${c.fill !== false ? ' checked' : ''}> <span>${esc(t('c_fill'))}</span></label>`;
  } else {
    h += field('expr', 'f(x) =', `<input type="text" class="mono" data-f="expr" value="${esc(c.expr)}" spellcheck="false">`, true);
    const ps = Object.entries(c.params || {});
    if (ps.length) h += `<p class="hint wide" style="grid-column:1/-1;margin:0">${esc(ps.map(([k, v]) => `${k} = ${fmtNum(v, 8)}`).join('   '))}</p>`;
    h += field('xmin', t('c_xmin'), num('xmin', c.xmin, `step="any" placeholder="${esc(t('auto'))}"`));
    h += field('xmax', t('c_xmax'), num('xmax', c.xmax, `step="any" placeholder="${esc(t('auto'))}"`));
    h += field('n', t('c_points'), num('n', c.n, 'min="10" max="20000" step="10"'));
    const F = funcOf(c);
    if (F.err) h += `<p class="err" style="grid-column:1/-1">${esc(exprErrText(F.err))}</p>`;
  }
  h += field('width', t('c_width'), num('width', c.width, 'min="0.25" max="20" step="0.25"'));
  h += field('dash', t('c_dash'), `<select data-f="dash">${Object.keys(DASHES).map((d) => opt(d, t('dash_' + d), c.dash)).join('')}</select>`);
  return h + '</div>';
}

$('curveList').addEventListener('click', (e) => {
  const g = activeGraph(), row = e.target.closest('.curve');
  if (!g || !row) return;
  const id = +row.dataset.id, c = g.curves.find((d) => d.id === id);
  if (e.target.dataset.k === 'del') {
    g.curves = g.curves.filter((d) => d !== c);
    pruneCurves();
    hist.commit();
    syncGraphPanels();
    graphRender();
    return;
  }
  if (e.target.dataset.k === 'vis' || e.target.dataset.k === 'color') return;
  UI.curve.set(g.id, id);
  if (c.kind === 'data') { const F = fitState(g); if (F.curve !== id) { F.curve = id; guessParams(g, F); } }
  if (c.fit) UI.fitSel.set(g.id, id);
  syncGraphPanels();
});
$('curveList').addEventListener('change', (e) => {
  const g = activeGraph(), row = e.target.closest('.curve');
  if (!g || !row) return;
  const c = g.curves.find((d) => d.id === +row.dataset.id);
  if (e.target.dataset.k === 'vis') c.hidden = !e.target.checked;
  if (e.target.dataset.k === 'color') c.color = e.target.value;
  hist.commit();
  graphRender();
});
$('curveList').addEventListener('input', (e) => {
  if (e.target.dataset.k !== 'color') return;
  const g = activeGraph(), c = g.curves.find((d) => d.id === +e.target.closest('.curve').dataset.id);
  c.color = e.target.value;
  graphRender();
});

$('curveProps').addEventListener('change', (e) => {
  const g = activeGraph(), k = e.target.dataset.f;
  const c = g && g.curves.find((d) => d.id === UI.curve.get(g.id));
  if (!c || !k) return;
  const v = e.target.value;
  const numOrNull = (s) => { const x = parseFloat(s); return isFinite(x) ? x : null; };
  switch (k) {
    case 'label': c.label = v.trim(); break;
    case 'table': {
      const tb = win(+v);
      c.table = tb.id;
      const y = tb.cols.find((x) => x.role === 'Y') || tb.cols[0];
      const x = y && xFor(tb, y);
      c.yc = y ? y.id : null; c.xc = x ? x.id : null; c.ye = c.xe = null;
      break;
    }
    case 'yc': c.yc = +v; break;
    case 'xc': case 'ye': case 'xe': c[k] = v === '' ? null : +v; break;
    case 'fill': c.fill = e.target.checked; break;
    case 'size': case 'width': { const x = numOrNull(v); if (x > 0) c[k] = x; break; }
    case 'n': { const x = numOrNull(v); if (x) c.n = clamp(Math.round(x), 10, 20000); break; }
    case 'xmin': case 'xmax': c[k] = numOrNull(v); break;
    case 'expr': c.expr = v.trim() || c.expr; break;
    default: c[k] = v;
  }
  hist.commit();
  syncGraphPanels();
  graphRender();
});

function syncAddRow() {
  const tabs = tablesList();
  const ts = $('addTable'), prev = +ts.value;
  ts.innerHTML = tabs.map((w) => opt(w.id, w.name, prev)).join('');
  if (!tabs.some((w) => w.id === prev) && tabs.length) ts.value = tabs[tabs.length - 1].id;
  fillAddCols();
}
function fillAddCols() {
  const tb = win(+$('addTable').value);
  const cols = tb ? tb.cols : [];
  const y = cols.find((c) => c.role === 'Y') || cols[0];
  const x = y && tb ? xFor(tb, y) : null;
  $('addX').innerHTML = opt('', t('row_number'), x ? x.id : '') + cols.map((c) => opt(c.id, 'X: ' + c.name, x ? x.id : '')).join('');
  $('addY').innerHTML = cols.map((c) => opt(c.id, 'Y: ' + c.name, y ? y.id : '')).join('');
}
$('addTable').addEventListener('change', fillAddCols);
$('btnAddData').addEventListener('click', () => {
  const g = activeGraph(), tb = win(+$('addTable').value);
  const y = tb && colById(tb, +$('addY').value);
  if (!g || !y) return;
  const c = makeDataCurve(g, tb, y, 'scatter');
  c.xc = $('addX').value === '' ? null : +$('addX').value;
  g.curves.push(c);
  UI.curve.set(g.id, c.id);
  hist.commit();
  syncGraphPanels();
  graphRender();
});
function addFunction() {
  const g = activeGraph(), src = $('addFunc').value.trim();
  if (!g || !src) return;
  try { compileExpr(src, { name: (n) => (n === 'x' ? 'v[0]' : null) }); } catch (e) { toast(exprErrText(e), 5000); return; }
  const c = { id: nid(), kind: 'func', expr: src, params: {}, xmin: null, xmax: null, n: 400, label: '', style: 'line', color: nextColor(g), width: 2, dash: 'solid', hidden: false };
  g.curves.push(c);
  UI.curve.set(g.id, c.id);
  $('addFunc').value = '';
  hist.commit();
  syncGraphPanels();
  graphRender();
}
$('btnAddFunc').addEventListener('click', addFunction);
$('addFunc').addEventListener('keydown', (e) => { if (e.key === 'Enter') addFunction(); });

/* ---------- panel de ajuste ---------- */

const modelName = (F) => t('m_' + F.model) + (F.model === 'poly' ? ` (${F.deg})` : '');
function modelExpr(F) {
  const M = FIT_MODELS[F.model];
  return M ? (typeof M.expr === 'function' ? M.expr(F.deg) : M.expr) : F.expr || 'a*x + b';
}
function fitNames(expr) { return exprNames(expr).filter((n) => n !== 'x'); }

function fitState(g) {
  let F = UI.fit.get(g.id);
  if (!F) { F = {}; UI.fit.set(g.id, F); }
  F.model ??= 'linear'; F.deg ??= 2; F.init ??= {}; F.fixed ??= {}; F.weight ??= true;
  F.xmin ??= null; F.xmax ??= null;
  const data = g.curves.filter((c) => c.kind === 'data');
  if (!data.some((c) => c.id === F.curve)) {
    const sel = data.find((c) => c.id === UI.curve.get(g.id));
    F.curve = (sel || data[0] || {}).id ?? null;
    F.guessed = false;
  }
  if (F.expr == null) F.expr = modelExpr(F);
  if (!F.guessed && F.curve != null) guessParams(g, F);
  return F;
}

// Datos que entran en el ajuste: ordenados por x y dentro del rango elegido.
function fitData(g, F) {
  const c = g.curves.find((d) => d.id === F.curve && d.kind === 'data');
  if (!c) return null;
  let pts = dataPoints(c).filter((p) => (F.xmin == null || p.x >= F.xmin) && (F.xmax == null || p.x <= F.xmax));
  pts.sort((a, b) => a.x - b.x);
  const hasErr = c.ye != null && pts.length > 0;
  const sigOk = hasErr && pts.every((p) => p.ey > 0);
  return { c, x: pts.map((p) => p.x), y: pts.map((p) => p.y), sig: sigOk ? pts.map((p) => p.ey) : null, hasErr, sigOk };
}

function guessParams(g, F) {
  F.guessed = true;
  let names;
  try { names = fitNames(F.expr); } catch (e) { return; }
  const M = FIT_MODELS[F.model];
  const D = fitData(g, F);
  let gu = {};
  if (M && D && D.x.length >= 2) {
    try { gu = M.guess(D.x, D.y, F.deg) || {}; } catch (e) { gu = {}; }
  }
  for (const n of names) F.init[n] = isFinite(gu[n]) ? +(+gu[n]).toPrecision(6) : F.init[n] ?? 1;
}

function syncFitPanel() {
  const g = activeGraph();
  if (!g) return;
  const F = fitState(g);
  const data = g.curves.filter((c) => c.kind === 'data');
  $('fitCurve').innerHTML = data.length ? data.map((c) => opt(c.id, curveLabel(g, c), F.curve)).join('') : opt('', t('fit_no_data'), '');
  $('fitModel').value = F.model;
  $('fitDegWrap').hidden = F.model !== 'poly';
  $('fitDeg').value = F.deg;
  if (document.activeElement !== $('fitExpr')) $('fitExpr').value = F.expr;
  renderParams(g, F);
  if (document.activeElement !== $('fitXmin')) $('fitXmin').value = F.xmin ?? '';
  if (document.activeElement !== $('fitXmax')) $('fitXmax').value = F.xmax ?? '';
  const D = fitData(g, F);
  $('fitWeight').checked = F.weight;
  $('fitWeight').disabled = !(D && D.hasErr);
  $('fitWeight').closest('label').title = D && D.hasErr ? (D.sigOk ? '' : t('fit_err_zero')) : t('fit_weight_none');
  $('btnFit').disabled = $('btnGuess').disabled = !data.length;
  renderFitResults(g, F);
}

function renderParams(g, F) {
  const err = $('fitExprErr');
  let names;
  try { names = fitNames(F.expr); err.hidden = true; $('fitExpr').classList.remove('bad'); }
  catch (e) { err.textContent = exprErrText(e); err.hidden = false; $('fitExpr').classList.add('bad'); names = []; }
  if (names.includes('i')) names = names.filter((n) => n !== 'i');
  $('fitParams').innerHTML = names.length
    ? `<thead><tr><th>${esc(t('fit_param'))}</th><th>${esc(t('fit_init'))}</th><th>${esc(t('fit_fixed'))}</th></tr></thead><tbody>` +
      names.map((n) => `<tr><td>${esc(n)}</td><td><input type="number" step="any" data-p="${esc(n)}" value="${+(+(F.init[n] ?? 1)).toPrecision(8)}"></td><td><input type="checkbox" data-fix="${esc(n)}"${F.fixed[n] ? ' checked' : ''} title="${esc(t('fit_fixed_t'))}"></td></tr>`).join('') + '</tbody>'
    : '';
}

// Valor y error redondeados a dos cifras significativas del error; si son muy grandes o muy
// pequeños, con la potencia de diez aparte (ex).
function pmParts(v, e) {
  if (!Number.isFinite(e) || e <= 0) return { v: fmtNum(v, 8), e: e === 0 ? null : '?', ex: null };
  const ev = Math.floor(Math.log10(e));
  const av = Math.abs(v);
  if (av >= 1e-3 && av < 1e6 && e >= 1e-6) {
    const dec = clamp(1 - ev, 0, 12);
    return { v: minusSign(v.toFixed(dec)), e: e.toFixed(dec), ex: null };
  }
  const ex = av > 0 ? Math.floor(Math.log10(av)) : ev;
  const sc = Math.pow(10, ex), dec = clamp(1 - (ev - ex), 0, 12);
  return { v: minusSign((v / sc).toFixed(dec)), e: (e / sc).toFixed(dec), ex };
}
function fmtPM(v, e) {
  const q = pmParts(v, e);
  if (q.e == null) return q.v;
  return q.ex == null ? `${q.v} ± ${q.e}` : `(${q.v} ± ${q.e})e${q.ex}`;
}
const fin = (v, f) => (Number.isFinite(v) ? f(v) : '–');
// R² por debajo de este valor se marca en rojo.
const R2_LOW = 0.9;
const lowR2 = (r2) => Number.isFinite(r2) && r2 < R2_LOW;

/* ---------- resultados guardados ---------- */

// Cada ajuste guarda su resultado en su curva (fc.fit), así que se puede volver a consultar sin
// repetirlo, se guarda con el proyecto y desaparece si se borra la curva.
const fitCurves = (g) => g.curves.filter((c) => c.kind === 'func' && c.fit);
function fitSelected(g) {
  const fs = fitCurves(g);
  return fs.find((c) => c.id === UI.fitSel.get(g.id)) || fs.reduce((a, c) => (!a || c.fit.time > a.fit.time ? c : a), null);
}
// Nombre del ajuste: el modelo y, si se limitó el intervalo de x, ese intervalo.
function fitName(fc) {
  const R = fc.fit, lim = R.range && (R.range[0] != null || R.range[1] != null);
  return R.model + (lim ? ` [${fmtNum(R.x0, 4)}, ${fmtNum(R.x1, 4)}]` : '');
}
function fitSrc(g, fc) {
  const d = g.curves.find((c) => c.id === fc.fitOf);
  return d ? curveLabel(g, d) : fc.fit.src;
}

function fitText(g, fc) {
  const R = fc.fit, w = Math.max(...R.names.map((n) => n.length));
  const lines = [
    `${g.name} · ${fitSrc(g, fc)} · ${R.model}`,
    `y = ${R.expr}`,
    `${t('fit_npts', { n: R.n })}, x ∈ [${fmtNum(R.x0)}, ${fmtNum(R.x1)}] · ${R.weighted ? t('fit_weighted') : t('fit_unweighted')}`,
    '',
    ...R.names.map((n, j) => `  ${n.padEnd(w)} = ${R.fixed[j] ? fmtNum(R.p[j], 8) + `  (${t('fit_fixed').toLowerCase()})` : fmtPM(R.p[j], R.err[j])}`),
    '',
    `χ²/ν = ${fmtNum(R.redchi2, 5)}   (χ² = ${fmtNum(R.chi2, 5)}, ν = ${R.dof})`,
    `R² = ${fin(R.r2, (v) => v.toFixed(6))}   R²adj = ${fin(R.adjr2, (v) => v.toFixed(6))}   RMSE = ${fmtNum(R.rmse, 5)}`,
  ];
  if (!R.weighted) lines.push(t('fit_err_note'));
  lines.push(R.converged ? t('fit_converged', { n: R.iter }) : t('fit_not_converged', { n: R.iter }));
  return lines.join('\n');
}

function fitCardHtml(g, fc) {
  const R = fc.fit;
  const pow = (ex) => (ex == null ? '' : `<span class="pow">×10<sup>${minusSign(String(ex))}</sup></span>`);
  const rows = R.names.map((n, j) => {
    const v = R.p[j], e = R.err[j];
    const full = esc(String(+v.toPrecision(10)));
    if (R.fixed[j]) {
      return `<tr><td class="pn">${esc(n)}</td><td class="pv" data-n="${esc(n)}" data-v="${full}" title="${esc(t('fit_copy_val'))}">${esc(fmtNum(v, 8))}</td>` +
        `<td class="pe"><span class="badge">${esc(t('fit_fixed').toLowerCase())}</span></td><td class="pr"></td></tr>`;
    }
    const q = pmParts(v, e);
    const rel = Number.isFinite(e) && e > 0 && v !== 0 ? Math.abs(e / v) * 100 : null;
    const relTxt = rel == null ? '' : `${rel < 10 ? rel.toFixed(1) : Math.round(rel)} %`;
    return `<tr><td class="pn">${esc(n)}</td><td class="pv" data-n="${esc(n)}" data-v="${full}" title="${esc(t('fit_copy_val'))}">${esc(q.v)}${pow(q.ex)}</td>` +
      `<td class="pe">${q.e == null ? '' : `± ${esc(q.e)}${pow(q.ex)}`}</td><td class="pr${rel > 50 ? ' bad' : ''}">${relTxt}</td></tr>`;
  }).join('');
  const stat = (k, v, tip, bad) => `<div${bad ? ' class="bad"' : ''} title="${esc(tip)}"><span>${k}</span><b>${esc(v)}</b></div>`;
  const notes = [];
  if (!R.weighted) notes.push(esc(t('fit_err_note')));
  notes.push(esc(R.converged ? t('fit_converged', { n: R.iter }) : t('fit_not_converged', { n: R.iter })));
  const edited = fc.expr !== R.expr;
  return `<div class="fitcard">
    <div class="fc-head"><span class="sw" style="background:${esc(fc.color)}"></span><b>${esc(fitName(fc))}</b><span class="fc-src">· ${esc(fitSrc(g, fc))}</span></div>
    <div class="fc-expr">y = ${esc(R.expr)}</div>
    <table class="fc-params"><thead><tr><th>${esc(t('fit_param'))}</th><th>${esc(t('fit_value'))}</th><th>${esc(t('fit_error'))}</th><th title="${esc(t('fit_rel_t'))}">${esc(t('fit_rel'))}</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="fc-stats">${stat('χ²/ν', fmtNum(R.redchi2, 4), t('fit_redchi_t'))}${stat('R²', fin(R.r2, (v) => v.toFixed(4)), lowR2(R.r2) ? t('fit_r2_low') : t('fit_r2_t'), lowR2(R.r2))}${stat('RMSE', fmtNum(R.rmse, 4), t('fit_rmse_t'))}</div>
    <p class="fc-meta">${esc(t('fit_npts', { n: R.n }))} · x ∈ [${esc(fmtNum(R.x0))}, ${esc(fmtNum(R.x1))}] · ${esc(R.weighted ? t('fit_weighted') : t('fit_unweighted'))}<br>χ² = ${esc(fmtNum(R.chi2, 5))} · ν = ${R.dof} · R²adj = ${esc(fin(R.adjr2, (v) => v.toFixed(4)))}</p>
    <p class="fc-note${R.converged ? '' : ' warn'}">${notes.join(' ')}</p>
    ${edited ? `<p class="fc-note warn">${esc(t('fit_edited'))}</p>` : ''}
  </div>`;
}

function renderFitResults(g, F) {
  const fs = fitCurves(g), cur = fitSelected(g);
  let h = F.error ? `<p class="err">${esc(F.error)}</p>` : '';
  if (fs.length > 1) {
    h += `<p class="fitlist-h">${esc(t('fit_results', { n: fs.length }))}</p><div class="fitlist">` +
      fs.map((c) => `<button type="button" class="fitrow${c === cur ? ' sel' : ''}" data-fit="${c.id}" aria-pressed="${c === cur}">` +
        `<span class="sw" style="background:${esc(c.color)}"></span><span class="fl">${esc(fitName(c))} · ${esc(fitSrc(g, c))}</span>` +
        `<span class="fr${lowR2(c.fit.r2) ? ' bad' : ''}">R² ${esc(fin(c.fit.r2, (v) => v.toFixed(3)))}</span></button>`).join('') + '</div>';
  }
  if (cur) h += fitCardHtml(g, cur);
  $('fitResults').innerHTML = h;
  const card = $('fitResults').querySelector('.fitcard');
  if (card && renderFitResults.shown !== cur.id && renderFitResults.shown != null && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    card.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 180, easing: 'ease-out' });
  }
  renderFitResults.shown = cur ? cur.id : null;
  $('fitActions').hidden = !cur;
  $('btnFitTable').disabled = !cur || !g.curves.some((c) => c.id === cur.fitOf);
}

function runFit() {
  const g = activeGraph();
  if (!g) return;
  const F = fitState(g);
  let names;
  try { names = fitNames(F.expr); } catch (e) { toast(exprErrText(e), 5000); return; }
  if (!names.length) { toast(t('fit_no_params'), 5000); return; }
  let fn;
  try { fn = compileExpr(F.expr, { name: (n) => (n === 'x' ? 'v[0]' : names.includes(n) ? `v[${names.indexOf(n) + 1}]` : null) }); }
  catch (e) { toast(exprErrText(e), 5000); return; }
  const D = fitData(g, F);
  if (!D || !D.x.length) { toast(t('fit_no_points'), 5000); return; }
  F.error = null;
  const buf = new Float64Array(names.length + 1);
  const f = (x, p) => { buf[0] = x; for (let j = 0; j < p.length; j++) buf[j + 1] = p[j]; return fn(buf); };
  const p0 = names.map((n) => (isFinite(F.init[n]) ? +F.init[n] : 1));
  const useW = F.weight && D.hasErr;
  if (useW && !D.sigOk) { toast(t('fit_err_zero'), 6000); return; }
  const res = lmFit({ f, x: D.x, y: D.y, sig: useW ? D.sig : null, p0, fixed: names.map((n) => !!F.fixed[n]) });
  if (res.error) {
    F.error = t('fit_fail_' + res.error, { n: res.need });
    renderFitResults(g, F);
    return;
  }
  names.forEach((n, j) => { F.init[n] = res.p[j]; });
  // Curva del ajuste: se sustituye la anterior del mismo modelo sobre los mismos datos y el mismo
  // intervalo; con otro intervalo es otro ajuste y se guarda aparte.
  const range = [F.xmin ?? null, F.xmax ?? null];
  const sameRange = (c) => { const r = (c.fit && c.fit.range) || [null, null]; return r[0] === range[0] && r[1] === range[1]; };
  let fc = g.curves.find((c) => c.kind === 'func' && c.fitOf === D.c.id && c.expr === F.expr && sameRange(c));
  if (!fc) {
    fc = { id: nid(), kind: 'func', fitOf: D.c.id, model: F.model, expr: F.expr, params: {}, n: 400, label: '', style: 'line', color: nextColor(g), width: 2, dash: 'solid', hidden: false };
    g.curves.push(fc);
  }
  fc.params = Object.fromEntries(names.map((n, j) => [n, res.p[j]]));
  fc.xmin = D.x[0];
  fc.xmax = D.x[D.x.length - 1];
  fc.model = F.model;
  const x0 = D.x[0], x1 = D.x[D.x.length - 1];
  fc.label = `${t('fit_label')}: ${modelName(F)}` + (range[0] != null || range[1] != null ? ` [${fmtNum(x0, 4)}, ${fmtNum(x1, 4)}]` : '');
  fc.fit = {
    src: curveLabel(g, D.c), model: modelName(F), expr: F.expr, names, p: Array.from(res.p), err: Array.from(res.err),
    fixed: names.map((n) => !!F.fixed[n]), n: res.n, x0, x1, range, weighted: res.weighted,
    chi2: res.chi2, redchi2: res.redchi2, dof: res.dof, r2: res.r2, adjr2: res.adjr2, rmse: res.rmse,
    converged: res.converged, iter: res.iter, time: Date.now(),
  };
  UI.fitSel.set(g.id, fc.id);
  logResult(fitText(g, fc));
  hist.commit();
  syncGraphPanels();
  graphRender();
}

// Ajuste rápido desde el menú contextual de la gráfica: el modelo elegido, con valores iniciales
// estimados, sobre la curva seleccionada (o los datos de un ajuste seleccionado). El resto de
// opciones (grado, intervalo, pesos) son las del panel. "Personalizado" abre el panel.
function quickFit(model) {
  const g = activeGraph();
  if (!g) return;
  const F = fitState(g);
  const cur = g.curves.find((c) => c.id === UI.curve.get(g.id));
  const dataId = cur && (cur.kind === 'data' ? cur.id : cur.fitOf);
  if (dataId != null && g.curves.some((c) => c.id === dataId && c.kind === 'data')) F.curve = dataId;
  F.model = model;
  if (model === 'custom') {
    syncFitPanel();
    const p = document.querySelector('.panel[data-p="fit"]');
    if (p) p.open = true;
    // Si el panel estaba plegado, su contenido no admite el foco hasta que acaba de abrirse.
    const focusExpr = () => { $('fitExpr').focus(); $('fitExpr').select(); };
    focusExpr();
    if (document.activeElement !== $('fitExpr')) setTimeout(focusExpr, 300);
    return;
  }
  F.expr = modelExpr(F);
  guessParams(g, F);
  syncFitPanel();
  const t0 = Date.now();
  runFit();
  if (F.error) { toast(F.error, 6000); return; }
  const fc = fitSelected(g);
  if (fc && fc.fit && fc.fit.time >= t0) toast(`${fc.fit.model}: R² = ${fmtNum(fc.fit.r2, 5)}`, 4000);
}

// Tabla con x, y, el valor del ajuste y el residuo de cada punto ajustado.
function fitToTable() {
  const g = activeGraph();
  const fc = g && fitSelected(g);
  if (!fc) return;
  const [xmin, xmax] = fc.fit.range || [null, null];
  const D = fitData(g, { curve: fc.fitOf, xmin, xmax });
  if (!D) return;
  const f = funcOf(fc).f;
  const tb = win(D.c.table), xc = colById(tb, D.c.xc), yc = colById(tb, D.c.yc);
  const cx = makeCol(xc ? xc.name : 'i', 'X'), cy = makeCol(yc.name, 'Y'), cf = makeCol('fit', 'Y'), cr = makeCol('residual', 'Y');
  cx.unit = xc ? xc.unit : ''; cy.unit = cf.unit = cr.unit = yc.unit;
  D.x.forEach((x, i) => {
    const v = f(x);
    cx.data.push(x); cy.data.push(D.y[i]);
    cf.data.push(isFinite(v) ? v : null); cr.data.push(isFinite(v) ? D.y[i] - v : null);
  });
  const nt = addTable({ name: 'Fit', cols: [cx, cy, cf, cr], rows: D.x.length });
  P.active = nt.id;
  hist.commit();
  renderAll();
}

$('fitCurve').addEventListener('change', (e) => {
  const g = activeGraph(), F = fitState(g);
  F.curve = +e.target.value;
  guessParams(g, F);
  syncFitPanel();
});
$('fitModel').addEventListener('change', (e) => {
  const g = activeGraph(), F = fitState(g);
  F.model = e.target.value;
  if (F.model !== 'custom') F.expr = modelExpr(F);
  guessParams(g, F);
  syncFitPanel();
  if (F.model === 'custom') { $('fitExpr').focus(); $('fitExpr').select(); }
});
$('fitDeg').addEventListener('change', (e) => {
  const g = activeGraph(), F = fitState(g);
  F.deg = clamp(Math.round(+e.target.value) || 2, 1, 9);
  F.expr = modelExpr(F);
  guessParams(g, F);
  syncFitPanel();
});
$('fitExpr').addEventListener('input', (e) => {
  const g = activeGraph(), F = fitState(g);
  F.expr = e.target.value;
  if (F.model !== 'custom' && F.expr !== modelExpr(F)) { F.model = 'custom'; $('fitModel').value = 'custom'; $('fitDegWrap').hidden = true; }
  try { for (const n of fitNames(F.expr)) if (!(n in F.init)) F.init[n] = 1; } catch (err) { /* se muestra abajo */ }
  renderParams(g, F);
});
$('fitParams').addEventListener('change', (e) => {
  const g = activeGraph(), F = fitState(g);
  if (e.target.dataset.p) { const v = parseFloat(e.target.value); if (isFinite(v)) F.init[e.target.dataset.p] = v; }
  if (e.target.dataset.fix) F.fixed[e.target.dataset.fix] = e.target.checked;
});
for (const id of ['fitXmin', 'fitXmax']) {
  $(id).addEventListener('change', (e) => {
    const g = activeGraph(), F = fitState(g);
    const v = parseFloat(e.target.value);
    F[id === 'fitXmin' ? 'xmin' : 'xmax'] = isFinite(v) ? v : null;
    graphRender();
  });
}
$('fitWeight').addEventListener('change', (e) => { fitState(activeGraph()).weight = e.target.checked; });
$('btnGuess').addEventListener('click', () => { const g = activeGraph(); guessParams(g, fitState(g)); syncFitPanel(); });
$('btnFit').addEventListener('click', runFit);
$('btnFitCopy').addEventListener('click', () => {
  const g = activeGraph(), fc = g && fitSelected(g);
  if (fc) navigator.clipboard.writeText(fitText(g, fc)).then(() => toast(t('copied')), () => toast(t('copy_fail')));
});
$('btnFitTable').addEventListener('click', fitToTable);
$('btnFitDel').addEventListener('click', () => {
  const g = activeGraph(), fc = g && fitSelected(g);
  if (!fc) return;
  g.curves = g.curves.filter((c) => c !== fc);
  UI.fitSel.delete(g.id);
  pruneCurves();
  hist.commit();
  syncGraphPanels();
  graphRender();
});
// Elegir qué ajuste se ve; clic en un valor: se copia con todas sus cifras.
$('fitResults').addEventListener('click', (e) => {
  const g = activeGraph();
  if (!g) return;
  const row = e.target.closest('.fitrow');
  if (row) { UI.fitSel.set(g.id, +row.dataset.fit); renderFitResults(g, fitState(g)); return; }
  const pv = e.target.closest('.pv');
  if (pv) navigator.clipboard.writeText(pv.dataset.v).then(() => toast(`${pv.dataset.n} = ${pv.dataset.v} · ${t('copied').toLowerCase()}`), () => toast(t('copy_fail')));
});

/* ---------- panel de ejes ---------- */

function syncAxesPanel() {
  const g = activeGraph();
  if (!g) return;
  const set = (id, v) => { if (document.activeElement !== $(id)) $(id).value = v ?? ''; };
  const rnd = (v) => (v == null ? '' : +(+v).toPrecision(6));
  set('gTitle', g.title); set('gXlab', g.xlab); set('gYlab', g.ylab);
  set('gXmin', rnd(g.x.min)); set('gXmax', rnd(g.x.max)); set('gYmin', rnd(g.y.min)); set('gYmax', rnd(g.y.max));
  $('gXlog').checked = g.x.log; $('gYlog').checked = g.y.log; $('gGrid').checked = g.grid;
  $('gLegend').value = g.legend;
  set('gW', g.W); set('gH', g.H); set('gFont', g.font);
}
function axesInput(id, fn) {
  $(id).addEventListener('change', (e) => {
    const g = activeGraph();
    if (!g) return;
    fn(g, e.target);
    hist.commit();
    syncAxesPanel();
    syncCurvesPanel();
    graphRender();
  });
}
const numOr = (s, d) => { const v = parseFloat(s); return isFinite(v) ? v : d; };
axesInput('gTitle', (g, el) => { g.title = el.value; });
axesInput('gXlab', (g, el) => { g.xlab = el.value; });
axesInput('gYlab', (g, el) => { g.ylab = el.value; });
axesInput('gXmin', (g, el) => { g.x.min = numOr(el.value, null); });
axesInput('gXmax', (g, el) => { g.x.max = numOr(el.value, null); });
axesInput('gYmin', (g, el) => { g.y.min = numOr(el.value, null); });
axesInput('gYmax', (g, el) => { g.y.max = numOr(el.value, null); });
axesInput('gXlog', (g, el) => { g.x.log = el.checked; g.x.min = g.x.max = null; });
axesInput('gYlog', (g, el) => { g.y.log = el.checked; g.y.min = g.y.max = null; });
axesInput('gGrid', (g, el) => { g.grid = el.checked; });
axesInput('gLegend', (g, el) => { g.legend = el.value; });
axesInput('gW', (g, el) => { g.W = clamp(Math.round(numOr(el.value, g.W)), 200, 4000); });
axesInput('gH', (g, el) => { g.H = clamp(Math.round(numOr(el.value, g.H)), 150, 4000); });
axesInput('gFont', (g, el) => { g.font = clamp(numOr(el.value, g.font), 6, 60); });

function syncGraphPanels() {
  syncCurvesPanel();
  syncFitPanel();
  syncAxesPanel();
}
