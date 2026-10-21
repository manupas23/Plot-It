'use strict';
// examples.js: prácticas de laboratorio ya resueltas, para ver el camino completo de un vistazo:
// datos con su error, columnas calculadas con fórmulas (propagando la incertidumbre), la gráfica
// y el ajuste hecho. Los datos son simulados, con ruido gaussiano de semilla fija (salen
// siempre iguales). En el registro queda escrito qué se ha hecho en cada paso.

// Ruido gaussiano N(0, 1) reproducible (Lehmer + Box–Muller).
function exNoise(seed) {
  let s = seed;
  const u = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  return () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
}
const exRound = (v, d) => +v.toFixed(d);

function exCol(name, role, unit, data) {
  const c = makeCol(name, role);
  c.unit = unit;
  c.data = data;
  return c;
}

// Columna nueva al final, calculada con una fórmula (y su error, si las columnas usadas lo tienen).
function exFormula(tb, name, role, unit, src) {
  const c = makeCol(name, role, tb.rows);
  c.unit = unit;
  tb.cols.push(c);
  fillFormula(tb, c, src, 0, tb.rows - 1, true);
  return c;
}

function exGraph(name, tb, y, { xlab, ylab, model, deg }) {
  const g = addGraph(name);
  const c = makeDataCurve(g, tb, y, 'scatter');
  g.curves.push(c);
  g.xlab = xlab;
  g.ylab = ylab;
  UI.curve.set(g.id, c.id);
  UI.fit.set(g.id, { curve: c.id, model, deg });
  return g;
}

const EXAMPLES = {
  // T² = (4π²/g)·L: a partir del tiempo de 10 oscilaciones, dos fórmulas con propagación y un ajuste lineal.
  pendulum() {
    const z = exNoise(34), g0 = 9.81;
    const L = [], t10 = [];
    for (let i = 0; i < 9; i++) {
      const l = 0.2 + 0.1 * i;
      L.push(exRound(l + 0.001 * z(), 3));
      t10.push(exRound(20 * Math.PI * Math.sqrt(l / g0) + 0.12 * z(), 2));
    }
    const tb = addTable({
      name: t('ex_pendulum'), rows: L.length, numbered: false, cols: [
        exCol('L', 'X', 'm', L), exCol('err_L', 'xErr', 'm', L.map(() => 0.002)),
        exCol('t10', 'Y', 's', t10), exCol('err_t10', 'yErr', 's', t10.map(() => 0.2)),
      ],
    });
    exFormula(tb, 'T', 'Y', 's', 't10/10');
    const T2 = exFormula(tb, 'T2', 'Y', 's²', 'T^2');
    return { tb, graphs: [exGraph('T² – L', tb, T2, { xlab: 'L (m)', ylab: 'T² (s²)', model: 'linear' })] };
  },

  // y = ½·g·t²: ajuste a un polinomio de grado 2, g = 2·a2.
  freefall() {
    const z = exNoise(23), g0 = 9.81;
    const tt = [], y = [];
    for (let i = 0; i < 16; i++) {
      const s = 0.03 * i;
      tt.push(exRound(s, 2));
      y.push(exRound(0.5 * g0 * s * s + 0.003 * z(), 4));
    }
    const tb = addTable({
      name: t('ex_freefall'), rows: tt.length, numbered: false, cols: [
        exCol('t', 'X', 's', tt), exCol('y', 'Y', 'm', y), exCol('err_y', 'yErr', 'm', y.map(() => 0.005)),
      ],
    });
    return { tb, graphs: [exGraph('y – t', tb, tb.cols[1], { xlab: 't (s)', ylab: 'y (m)', model: 'poly', deg: 2 })] };
  },

  // V = V0·exp(−t/RC): el error del voltímetro con una fórmula, ajuste exponencial y, aparte,
  // la linealización ln V frente a t (pendiente −1/RC) con su error propagado.
  rc() {
    const z = exNoise(5), tau = 1.0;
    const tt = [], V = [];
    for (let i = 0; i <= 20; i++) {
      const s = 0.2 * i;
      tt.push(exRound(s, 1));
      V.push(exRound(5 * Math.exp(-s / tau) * (1 + 0.006 * z()) + 0.004 * z(), 3));
    }
    const tb = addTable({
      name: t('ex_rc'), rows: tt.length, numbered: false, cols: [exCol('t', 'X', 's', tt), exCol('V', 'Y', 'V', V)],
    });
    // Error típico de un voltímetro: un 1 % de la lectura más 5 mV.
    exFormula(tb, 'err_V', 'yErr', 'V', '0.01*V + 0.005');
    const lnV = exFormula(tb, 'lnV', 'Y', '', 'ln(V)');
    return {
      tb, graphs: [
        exGraph('V – t', tb, tb.cols[1], { xlab: 't (s)', ylab: 'V (V)', model: 'exp_decay' }),
        exGraph('ln V – t', tb, lnV, { xlab: 't (s)', ylab: 'ln V', model: 'linear' }),
      ],
    };
  },

  // Oscilación amortiguada: ajuste no lineal con cinco parámetros.
  damped() {
    const n = 60;
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
    const tt = [], x = [];
    for (let i = 0; i < n; i++) {
      const s = i * 0.1;
      tt.push(+s.toFixed(2));
      x.push(+(0.4 + 5 * Math.exp(-s / 2.5) * Math.sin((2 * Math.PI * s) / 1.6 + 0.3) + 0.35 * rnd()).toFixed(3));
    }
    const tb = addTable({
      name: t('ex_damped'), rows: n, numbered: false, cols: [
        exCol('t', 'X', 's', tt), exCol('x', 'Y', 'cm', x), exCol('err', 'yErr', 'cm', x.map(() => 0.2)),
      ],
    });
    return { tb, graphs: [exGraph('x – t', tb, tb.cols[1], { xlab: 't (s)', ylab: 'x (cm)', model: 'damped' })] };
  },

  // Línea Hα de un espectro: cuentas con error de Poisson √N y ajuste gaussiano (FWHM = 2,355·w).
  spectrum() {
    const z = exNoise(31);
    const lam = [], N = [];
    for (let i = 0; i <= 36; i++) {
      const l = 652 + 0.25 * i;
      const mu = 40 + 900 * Math.exp(-((l - 656.28) ** 2) / (2 * 0.55 ** 2));
      lam.push(exRound(l, 2));
      N.push(Math.max(0, Math.round(mu + Math.sqrt(mu) * z())));
    }
    const tb = addTable({
      name: t('ex_spectrum'), rows: lam.length, numbered: false, cols: [exCol('lambda', 'X', 'nm', lam), exCol('N', 'Y', t('ex_counts'), N)],
    });
    exFormula(tb, 'err_N', 'yErr', t('ex_counts'), 'sqrt(N)');
    return { tb, graphs: [exGraph('N – λ', tb, tb.cols[1], { xlab: 'λ (nm)', ylab: t('ex_counts'), model: 'gauss' })] };
  },
};

function loadExample(key = 'damped') {
  if (!EXAMPLES[key]) return;
  commitEdit(false);
  const before = P.wins.length;
  const { tb, graphs } = EXAMPLES[key]();
  dropUnusedFirstTable(tb, P.wins.length - before);
  logResult(t('ex_log_' + key));
  // Se ajusta cada gráfica (la primera queda a la vista) y el resultado va al registro.
  for (const g of graphs.slice().reverse()) {
    P.active = g.id;
    renderAll();
    runFit();
  }
  hist.commit();
  renderAll();
  // A la vista, el resultado del ajuste y la explicación.
  document.querySelectorAll('.panel[data-p="fit"], .panel[data-p="log"]').forEach((p) => { p.open = true; });
  toast(t('ex_toast', { name: t('ex_' + key) }), 6000);
}

document.querySelectorAll('[data-ex]').forEach((b) => b.addEventListener('click', () => loadExample(b.dataset.ex)));
