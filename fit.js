'use strict';
// Cálculo numérico: ajuste por mínimos cuadrados (Levenberg–Marquardt), modelos
// predefinidos con su estimación inicial, estadística de columnas, derivada e integral.

/* ---------- álgebra lineal pequeña (matrices k×k como arrays de filas) ---------- */

// Cholesky de una matriz simétrica definida positiva: L con A = L·Lᵀ, o null si no lo es.
function cholesky(A) {
  const k = A.length;
  const L = Array.from({ length: k }, () => new Float64Array(k));
  for (let i = 0; i < k; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let q = 0; q < j; q++) s -= L[i][q] * L[j][q];
      if (i === j) {
        if (!(s > 0)) return null;
        L[i][i] = Math.sqrt(s);
      } else L[i][j] = s / L[j][j];
    }
  }
  return L;
}
function cholSolve(L, b) {
  const k = L.length, y = new Float64Array(k), x = new Float64Array(k);
  for (let i = 0; i < k; i++) { let s = b[i]; for (let q = 0; q < i; q++) s -= L[i][q] * y[q]; y[i] = s / L[i][i]; }
  for (let i = k - 1; i >= 0; i--) { let s = y[i]; for (let q = i + 1; q < k; q++) s -= L[q][i] * x[q]; x[i] = s / L[i][i]; }
  return x;
}
function cholInverse(L) {
  const k = L.length, inv = [];
  for (let j = 0; j < k; j++) {
    const e = new Float64Array(k); e[j] = 1;
    inv.push(cholSolve(L, e));
  }
  return inv; // simétrica: columna j = fila j
}

/* ---------- Levenberg–Marquardt ---------- */

// Minimiza χ² = Σ ((y_i − f(x_i; p)) / σ_i)² (σ_i = 1 si no hay pesos).
// f(x, p) recibe el vector completo de parámetros; los de `fixed` no se mueven.
// Las derivadas son numéricas (diferencias centradas) y el sistema se resuelve escalado por
// la diagonal de JᵀJ (Marquardt), así que da igual que los parámetros sean de 1e-9 o de 1e5.
function lmFit({ f, x, y, sig = null, p0, fixed = [], maxIter = 1000 }) {
  const n = x.length, m = p0.length;
  const free = [];
  for (let j = 0; j < m; j++) if (!fixed[j]) free.push(j);
  const k = free.length;
  if (!n) return { error: 'no_data' };
  if (!k) return { error: 'no_free' };
  if (n < k) return { error: 'few_points', need: k };
  const w = sig ? Float64Array.from(sig, (s) => 1 / s) : null;
  let p = p0.slice();
  let r = new Float64Array(n), rt = new Float64Array(n);
  const resid = (pp, out) => {
    let c = 0;
    for (let i = 0; i < n; i++) {
      const v = (y[i] - f(x[i], pp)) * (w ? w[i] : 1);
      out[i] = v;
      c += v * v;
    }
    return c;
  };
  let chi = resid(p, r);
  if (!isFinite(chi)) return { error: 'init_nan' };

  const J = Array.from({ length: k }, () => new Float64Array(n));
  const jacobian = (pp) => {
    const q = pp.slice();
    for (let a = 0; a < k; a++) {
      const j = free[a], pj = pp[j];
      const h = pj !== 0 ? 1e-6 * Math.abs(pj) : 1e-6;
      for (let i = 0; i < n; i++) {
        q[j] = pj + h; const fp = f(x[i], q);
        q[j] = pj - h; const fm = f(x[i], q);
        let d = (fp - fm) / (2 * h);
        if (!isFinite(d)) {
          // Cerca de un borde del dominio (raíz de un negativo, log de 0...): derivada lateral.
          const f0 = f(x[i], pp);
          d = isFinite(fp) ? (fp - f0) / h : isFinite(fm) ? (f0 - fm) / h : 0;
          if (!isFinite(d)) d = 0;
        }
        J[a][i] = d * (w ? w[i] : 1);
      }
      q[j] = pj;
    }
  };
  const normal = () => {
    const A = Array.from({ length: k }, () => new Float64Array(k)), g = new Float64Array(k);
    for (let a = 0; a < k; a++) {
      const Ja = J[a];
      let s = 0;
      for (let i = 0; i < n; i++) s += Ja[i] * r[i];
      g[a] = s;
      for (let b = 0; b <= a; b++) {
        const Jb = J[b];
        let t = 0;
        for (let i = 0; i < n; i++) t += Ja[i] * Jb[i];
        A[a][b] = A[b][a] = t;
      }
    }
    const d = Float64Array.from(A, (row, a) => Math.sqrt(row[a]) || 1);
    return { A, g, d };
  };

  let lambda = 1e-3, iter = 0, converged = false;
  for (; iter < maxIter && !converged; iter++) {
    jacobian(p);
    const { A, g, d } = normal();
    let improved = false;
    while (lambda < 1e16) {
      const M = A.map((row, a) => Float64Array.from(row, (v, b) => v / (d[a] * d[b]) + (a === b ? lambda : 0)));
      const L = cholesky(M);
      if (!L) { lambda *= 10; continue; }
      const z = cholSolve(L, Float64Array.from(g, (v, a) => v / d[a]));
      const pn = p.slice();
      for (let a = 0; a < k; a++) pn[free[a]] += z[a] / d[a];
      const chin = resid(pn, rt);
      if (isFinite(chin) && chin <= chi) {
        if (chi - chin <= 1e-12 * chi || chin < 1e-300) converged = true;
        p = pn; [r, rt] = [rt, r]; chi = chin;
        lambda = Math.max(lambda / 10, 1e-15);
        improved = true;
        break;
      }
      lambda *= 10;
    }
    // Ningún paso mejora χ²: estamos en el mínimo (a la precisión de la máquina).
    if (!improved) converged = true;
  }

  // Covarianza de los parámetros libres: (JᵀWJ)⁻¹, escalada por χ²/ν si no hay pesos.
  jacobian(p);
  const { A, d } = normal();
  const dof = n - k;
  const L = cholesky(A.map((row, a) => Float64Array.from(row, (v, b) => v / (d[a] * d[b]))));
  const factor = sig ? 1 : dof > 0 ? chi / dof : NaN;
  const err = new Array(m).fill(0);
  let cov = null;
  if (L) {
    const Mi = cholInverse(L);
    cov = Mi.map((row, a) => Array.from(row, (v, b) => (v / (d[a] * d[b])) * factor));
    free.forEach((j, a) => { err[j] = Math.sqrt(cov[a][a]); });
  } else free.forEach((j) => { err[j] = NaN; });

  let my = 0;
  for (let i = 0; i < n; i++) my += y[i];
  my /= n;
  let ssr = 0, sst = 0;
  for (let i = 0; i < n; i++) { ssr += (y[i] - f(x[i], p)) ** 2; sst += (y[i] - my) ** 2; }
  const r2 = sst > 0 ? 1 - ssr / sst : 1;
  return {
    p, err, cov, free, n, dof, iter, converged, weighted: !!sig,
    chi2: chi, redchi2: dof > 0 ? chi / dof : NaN,
    r2, adjr2: dof > 0 && n > 1 ? 1 - ((1 - r2) * (n - 1)) / dof : NaN,
    rmse: dof > 0 ? Math.sqrt(ssr / dof) : NaN, ssr,
  };
}

/* ---------- modelos predefinidos ---------- */

// Recta por mínimos cuadrados simples (para estimaciones iniciales).
function lineLS(x, y) {
  const n = x.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; sxx += x[i] * x[i]; sxy += x[i] * y[i]; }
  const den = n * sxx - sx * sx;
  const a = den ? (n * sxy - sx * sy) / den : 0;
  return { a, b: (sy - a * sx) / n };
}

// Línea de base y pico (o valle) más destacado, con su anchura a media altura.
function peakGuess(x, y) {
  const n = x.length;
  const edge = Math.max(1, Math.round(n * 0.1));
  const ends = [...y.slice(0, edge), ...y.slice(n - edge)].sort((a, b) => a - b);
  const y0 = ends[Math.floor(ends.length / 2)];
  let iMax = 0, iMin = 0;
  for (let i = 1; i < n; i++) { if (y[i] > y[iMax]) iMax = i; if (y[i] < y[iMin]) iMin = i; }
  const ip = y[iMax] - y0 >= y0 - y[iMin] ? iMax : iMin;
  const A = y[ip] - y0;
  let lo = ip, hi = ip;
  while (lo > 0 && Math.abs(y[lo - 1] - y0) >= Math.abs(A) / 2) lo--;
  while (hi < n - 1 && Math.abs(y[hi + 1] - y0) >= Math.abs(A) / 2) hi++;
  const fwhm = Math.max(x[hi] - x[lo], (x[n - 1] - x[0]) / Math.max(n - 1, 1), 1e-12 * (Math.abs(x[ip]) || 1));
  return { y0, A, xc: x[ip], fwhm };
}

// Periodo a partir de los cruces por la media, y amplitud y fase por mínimos cuadrados
// lineales con ese periodo: y − y0 ≈ a·sin(ωx) + b·cos(ωx).
function sineGuess(x, y) {
  const n = x.length;
  const y0 = y.reduce((s, v) => s + v, 0) / n;
  const cross = [];
  for (let i = 1; i < n; i++) {
    if ((y[i - 1] - y0) * (y[i] - y0) < 0) {
      const f = (y0 - y[i - 1]) / (y[i] - y[i - 1]);
      cross.push(x[i - 1] + f * (x[i] - x[i - 1]));
    }
  }
  const span = x[n - 1] - x[0] || 1;
  const T = cross.length >= 2 ? (2 * (cross[cross.length - 1] - cross[0])) / (cross.length - 1) : span;
  const om = (2 * Math.PI) / T;
  let ss = 0, cc = 0, sc = 0, sy = 0, cy = 0;
  for (let i = 0; i < n; i++) {
    const s = Math.sin(om * x[i]), c = Math.cos(om * x[i]), d = y[i] - y0;
    ss += s * s; cc += c * c; sc += s * c; sy += s * d; cy += c * d;
  }
  const den = ss * cc - sc * sc;
  const a = den ? (sy * cc - cy * sc) / den : 1, b = den ? (cy * ss - sy * sc) / den : 0;
  return { y0, A: Math.hypot(a, b) || 1, T, phi: Math.atan2(b, a) };
}

// Los datos llegan ordenados por x. Cada modelo da su expresión, sus parámetros (en el orden
// en que aparecen) y una estimación inicial razonable.
const FIT_MODELS = {
  linear: { expr: 'a*x + b', guess: (x, y) => { const l = lineLS(x, y); return { a: l.a, b: l.b }; } },
  poly: {
    expr: (deg) => ['a0', ...Array.from({ length: deg }, (_, k) => (k ? `a${k + 1}*x^${k + 1}` : 'a1*x'))].join(' + '),
    guess: (x, y, deg) => {
      const g = { a0: y.reduce((s, v) => s + v, 0) / y.length };
      for (let k = 1; k <= deg; k++) g['a' + k] = 0;
      return g;
    },
  },
  exp_decay: {
    expr: 'y0 + A*exp(-x/t)',
    guess: (x, y) => {
      const n = x.length, y0 = y[n - 1], A0 = y[0] - y0 || 1;
      let t = (x[n - 1] - x[0]) / 3 || 1;
      for (let i = 1; i < n; i++) if (Math.abs(y[i] - y0) <= Math.abs(A0) / Math.E) { t = x[i] - x[0] || t; break; }
      return { y0, A: A0 * Math.exp(x[0] / t), t };
    },
  },
  exp_growth: {
    expr: 'y0 + A*exp(x/t)',
    guess: (x, y) => {
      const n = x.length, y0 = y[0] - (y[n - 1] - y[0]) * 0.01;
      const A1 = y[n - 1] - y0 || 1;
      let t = (x[n - 1] - x[0]) / 3 || 1;
      for (let i = n - 2; i >= 0; i--) if (Math.abs(y[i] - y0) <= Math.abs(A1) / Math.E) { t = x[n - 1] - x[i] || t; break; }
      return { y0, A: A1 * Math.exp(-x[n - 1] / t), t };
    },
  },
  gauss: {
    expr: 'y0 + A*exp(-(x - xc)^2/(2*w^2))',
    guess: (x, y) => { const g = peakGuess(x, y); return { y0: g.y0, A: g.A, xc: g.xc, w: g.fwhm / 2.3548 }; },
  },
  lorentz: {
    expr: 'y0 + A/(1 + ((x - xc)/w)^2)',
    guess: (x, y) => { const g = peakGuess(x, y); return { y0: g.y0, A: g.A, xc: g.xc, w: g.fwhm / 2 }; },
  },
  boltzmann: {
    expr: 'A2 + (A1 - A2)/(1 + exp((x - x0)/dx))',
    guess: (x, y) => {
      const n = x.length, A1 = y[0], A2 = y[n - 1], mid = (A1 + A2) / 2;
      let x0 = (x[0] + x[n - 1]) / 2;
      for (let i = 1; i < n; i++) if ((y[i - 1] - mid) * (y[i] - mid) <= 0) { x0 = (x[i - 1] + x[i]) / 2; break; }
      return { A1, A2, x0, dx: (x[n - 1] - x[0]) / 10 || 1 };
    },
  },
  power: {
    expr: 'A*x^b',
    guess: (x, y) => {
      const lx = [], ly = [];
      const sgn = Math.sign(y.reduce((s, v) => s + v, 0)) || 1;
      for (let i = 0; i < x.length; i++) if (x[i] > 0 && y[i] * sgn > 0) { lx.push(Math.log(x[i])); ly.push(Math.log(y[i] * sgn)); }
      if (lx.length < 2) return { A: 1, b: 1 };
      const l = lineLS(lx, ly);
      return { A: sgn * Math.exp(l.b), b: l.a };
    },
  },
  sine: {
    expr: 'y0 + A*sin(2*pi*x/T + phi)',
    guess: (x, y) => sineGuess(x, y),
  },
  damped: {
    expr: 'y0 + A*exp(-x/tau)*sin(2*pi*x/T + phi)',
    guess: (x, y) => {
      const g = sineGuess(x, y);
      const tau = x[x.length - 1] - x[0] || 1;
      return { y0: g.y0, A: g.A * Math.exp(x[0] / tau) * 1.5, tau, T: g.T, phi: g.phi };
    },
  },
};

/* ---------- estadística, derivada e integral ---------- */

function colStats(vals) {
  const v = vals.filter((a) => typeof a === 'number' && isFinite(a));
  const n = v.length;
  if (!n) return { n: 0 };
  let sum = 0, min = Infinity, max = -Infinity;
  for (const a of v) { sum += a; if (a < min) min = a; if (a > max) max = a; }
  const mean = sum / n;
  let ss = 0;
  for (const a of v) ss += (a - mean) ** 2;
  const sd = n > 1 ? Math.sqrt(ss / (n - 1)) : NaN;
  const s = v.slice().sort((a, b) => a - b);
  const median = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  return { n, mean, sd, se: sd / Math.sqrt(n), min, max, sum, median };
}

// Filas en las que x e y son números, en el orden de la tabla.
function validPairs(x, y) {
  const idx = [];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (typeof x[i] === 'number' && isFinite(x[i]) && typeof y[i] === 'number' && isFinite(y[i])) idx.push(i);
  }
  return idx;
}

// dy/dx con diferencias centradas para paso variable (en los extremos, laterales).
function derivative(x, y) {
  const out = new Array(y.length).fill(null);
  const idx = validPairs(x, y);
  const m = idx.length;
  if (m < 2) return out;
  for (let q = 0; q < m; q++) {
    const i = idx[q];
    if (q === 0 || q === m - 1) {
      const a = idx[q === 0 ? 0 : m - 2], b = idx[q === 0 ? 1 : m - 1];
      out[i] = x[b] !== x[a] ? (y[b] - y[a]) / (x[b] - x[a]) : null;
      continue;
    }
    const a = idx[q - 1], b = idx[q + 1];
    const h1 = x[i] - x[a], h2 = x[b] - x[i];
    if (!h1 || !h2 || !(h1 + h2)) { out[i] = null; continue; }
    out[i] = (h1 * h1 * (y[b] - y[i]) + h2 * h2 * (y[i] - y[a])) / (h1 * h2 * (h1 + h2));
  }
  return out;
}

// Integral acumulada por trapecios desde la primera fila válida.
function cumTrapz(x, y) {
  const out = new Array(y.length).fill(null);
  const idx = validPairs(x, y);
  let acc = 0;
  idx.forEach((i, q) => {
    if (q) { const a = idx[q - 1]; acc += ((y[i] + y[a]) / 2) * (x[i] - x[a]); }
    out[i] = acc;
  });
  return { values: out, total: acc };
}

if (typeof module !== 'undefined') module.exports = { lmFit, FIT_MODELS, colStats, derivative, cumTrapz, cholesky, cholSolve, lineLS };
