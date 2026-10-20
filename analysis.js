'use strict';
// analysis.js: cálculos del menú Análisis (FFT, filtro FFT, suavizado, interpolación,
// correlación, histograma y picos). Son funciones puras sobre arrays; la interfaz está en menu.js.

/* ---------- FFT ---------- */

// FFT compleja en el sitio para n potencia de 2 (Cooley–Tukey iterativa, sin normalizar).
function fftPow2(re, im, inv = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  const s = inv ? 1 : -1;
  const cs = new Float64Array(n >> 1), sn = new Float64Array(n >> 1);
  for (let k = 0; k < n >> 1; k++) { cs[k] = Math.cos((2 * Math.PI * k) / n); sn[k] = s * Math.sin((2 * Math.PI * k) / n); }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1, step = n / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half, wr = cs[k * step], wi = sn[k * step];
        const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
      }
    }
  }
}

// FFT de cualquier longitud: directa si n es potencia de 2 y, si no, con el algoritmo de
// Bluestein (chirp-z), que da exactamente las frecuencias k/(n·Δx) sin rellenar con ceros.
// Devuelve arrays nuevos, sin normalizar (la inversa hay que dividirla entre n).
function fft(re, im, inv = false) {
  const n = re.length;
  if (!im) im = new Float64Array(n);
  if (!(n & (n - 1))) {
    const r = Float64Array.from(re), i = Float64Array.from(im);
    if (n > 1) fftPow2(r, i, inv);
    return { re: r, im: i };
  }
  let m = 1;
  while (m < 2 * n - 1) m <<= 1;
  const s = inv ? 1 : -1;
  const wr = new Float64Array(n), wi = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const a = (Math.PI * ((k * k) % (2 * n))) / n;
    wr[k] = Math.cos(a); wi[k] = s * Math.sin(a);
  }
  const ar = new Float64Array(m), ai = new Float64Array(m), br = new Float64Array(m), bi = new Float64Array(m);
  for (let k = 0; k < n; k++) {
    ar[k] = re[k] * wr[k] - im[k] * wi[k];
    ai[k] = re[k] * wi[k] + im[k] * wr[k];
  }
  br[0] = wr[0]; bi[0] = -wi[0];
  for (let k = 1; k < n; k++) { br[k] = br[m - k] = wr[k]; bi[k] = bi[m - k] = -wi[k]; }
  fftPow2(ar, ai); fftPow2(br, bi);
  for (let k = 0; k < m; k++) {
    const r = ar[k] * br[k] - ai[k] * bi[k];
    ai[k] = ar[k] * bi[k] + ai[k] * br[k];
    ar[k] = r;
  }
  fftPow2(ar, ai, true);
  const outR = new Float64Array(n), outI = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const r = ar[k] / m, i = ai[k] / m;
    outR[k] = r * wr[k] - i * wi[k];
    outI[k] = r * wi[k] + i * wr[k];
  }
  return { re: outR, im: outI };
}

const WINDOWS = {
  rect: () => 1,
  hann: (k, n) => 0.5 - 0.5 * Math.cos((2 * Math.PI * k) / (n - 1)),
  hamming: (k, n) => 0.54 - 0.46 * Math.cos((2 * Math.PI * k) / (n - 1)),
  blackman: (k, n) => 0.42 - 0.5 * Math.cos((2 * Math.PI * k) / (n - 1)) + 0.08 * Math.cos((4 * Math.PI * k) / (n - 1)),
};

/* ---------- datos de entrada ---------- */

// Pares (x, y) ordenados por x. Con x repetidas se queda la media de sus y.
function sortedPairs(x, y) {
  const idx = [];
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (isFinite(x[i]) && isFinite(y[i])) idx.push(i);
  idx.sort((a, b) => x[a] - x[b] || a - b);
  const X = [], Y = [];
  for (let q = 0; q < idx.length; ) {
    const xv = x[idx[q]];
    let s = 0, k = 0;
    for (; q < idx.length && x[idx[q]] === xv; q++, k++) s += y[idx[q]];
    X.push(xv); Y.push(s / k);
  }
  return { x: X, y: Y };
}

// Paso de x si es constante (tolerancia relativa 1e-5) y creciente; si no, null.
function uniformStep(x) {
  const n = x.length;
  if (n < 2) return null;
  const dt = (x[n - 1] - x[0]) / (n - 1);
  if (!(dt > 0)) return null;
  for (let i = 1; i < n; i++) if (Math.abs(x[i] - x[i - 1] - dt) > 1e-5 * dt) return null;
  return dt;
}

// Interpolación lineal de (x, y), con x creciente, en los puntos xs (null fuera del rango).
function interpLinear(x, y, xs) {
  const n = x.length;
  let j = 0;
  return xs.map((v) => {
    if (!(v >= x[0] && v <= x[n - 1])) return null;
    if (v < x[j]) j = 0;
    while (j < n - 2 && x[j + 1] < v) j++;
    if (n === 1) return y[0];
    const h = x[j + 1] - x[j];
    return h ? y[j] + ((y[j + 1] - y[j]) * (v - x[j])) / h : y[j];
  });
}

// Spline cúbica natural (segunda derivada nula en los extremos) evaluada en xs.
function interpSpline(x, y, xs) {
  const n = x.length;
  if (n < 3) return interpLinear(x, y, xs);
  const h = new Float64Array(n - 1);
  for (let i = 0; i < n - 1; i++) h[i] = x[i + 1] - x[i];
  // Sistema tridiagonal para las segundas derivadas M[1..n-2] (algoritmo de Thomas).
  const M = new Float64Array(n), c = new Float64Array(n), d = new Float64Array(n);
  for (let i = 1; i < n - 1; i++) {
    const a = h[i - 1], b = 2 * (h[i - 1] + h[i]), cc = h[i];
    const r = 6 * ((y[i + 1] - y[i]) / h[i] - (y[i] - y[i - 1]) / h[i - 1]);
    const den = b - a * c[i - 1];
    c[i] = cc / den;
    d[i] = (r - a * d[i - 1]) / den;
  }
  for (let i = n - 2; i >= 1; i--) M[i] = d[i] - c[i] * M[i + 1];
  let j = 0;
  return xs.map((v) => {
    if (!(v >= x[0] && v <= x[n - 1])) return null;
    if (v < x[j]) j = 0;
    while (j < n - 2 && x[j + 1] < v) j++;
    const A = (x[j + 1] - v) / h[j], B = (v - x[j]) / h[j];
    return A * y[j] + B * y[j + 1] + ((A ** 3 - A) * M[j] + (B ** 3 - B) * M[j + 1]) * (h[j] * h[j]) / 6;
  });
}

// Malla regular de n puntos entre a y b.
const linspace = (a, b, n) => Array.from({ length: n }, (_, k) => (n > 1 ? a + ((b - a) * k) / (n - 1) : a));

/* ---------- espectro ---------- */

// Espectro de una cara de y(x). Si los pasos de x no son iguales, primero se remuestrea con
// interpolación lineal en n puntos equiespaciados. Amplitud normalizada para que un seno de
// amplitud A dé un pico de altura A; PSD (densidad espectral de potencia) en unidades de y²·x.
function spectrum(x0, y0, { window = 'hann', demean = true } = {}) {
  let { x, y } = sortedPairs(x0, y0);
  const n = x.length;
  let dt = uniformStep(x), resampled = false;
  if (!dt) {
    dt = (x[n - 1] - x[0]) / (n - 1);
    y = interpLinear(x, y, linspace(x[0], x[n - 1], n));
    resampled = true;
  }
  const mean = y.reduce((a, b) => a + b, 0) / n;
  const W = WINDOWS[window] || WINDOWS.rect;
  const re = new Float64Array(n);
  let sw = 0, sw2 = 0;
  for (let k = 0; k < n; k++) {
    const w = n > 1 ? W(k, n) : 1;
    re[k] = (demean ? y[k] - mean : y[k]) * w;
    sw += w; sw2 += w * w;
  }
  const X = fft(re);
  const K = Math.floor(n / 2) + 1;
  const f = [], amp = [], phase = [], psd = [];
  for (let k = 0; k < K; k++) {
    const one = k === 0 || (n % 2 === 0 && k === n / 2);
    const m2 = X.re[k] ** 2 + X.im[k] ** 2;
    f.push(k / (n * dt));
    amp.push((Math.sqrt(m2) / sw) * (one ? 1 : 2));
    phase.push((Math.atan2(X.im[k], X.re[k]) * 180) / Math.PI);
    psd.push(((m2 * dt) / sw2) * (one ? 1 : 2));
  }
  // Pico principal (sin la componente continua), afinado con una parábola por sus vecinos.
  let kp = 1;
  for (let k = 2; k < K; k++) if (amp[k] > amp[kp]) kp = k;
  let fpeak = null, apeak = null;
  if (K > 1) {
    let delta = 0;
    if (kp > 0 && kp < K - 1) {
      const a = amp[kp - 1], b = amp[kp], c = amp[kp + 1], den = a - 2 * b + c;
      if (den < 0) delta = clampA((0.5 * (a - c)) / den, -0.5, 0.5);
    }
    fpeak = (kp + delta) / (n * dt);
    apeak = amp[kp];
  }
  return { f, amp, phase, psd, n, dt, df: 1 / (n * dt), resampled, fpeak, apeak };
}
const clampA = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- filtro FFT ---------- */

// Filtra y (pasos de x iguales a dt) quitando frecuencias: 'low' deja f ≤ f1, 'high' f ≥ f1,
// 'band' f1 ≤ f ≤ f2 y 'stop' quita f1 < f < f2. Antes de la FFT se resta la recta que une los
// extremos (así no aparece un salto al tratar los datos como periódicos) y se vuelve a sumar si
// el filtro deja pasar la frecuencia cero.
function fftFilter(y, dt, type, f1, f2) {
  const n = y.length;
  const y0 = y[0], slope = n > 1 ? (y[n - 1] - y[0]) / (n - 1) : 0;
  const re = Float64Array.from(y, (v, k) => v - (y0 + slope * k));
  const keep = (f) => (type === 'low' ? f <= f1 : type === 'high' ? f >= f1 : type === 'band' ? f >= f1 && f <= f2 : !(f > f1 && f < f2));
  const X = fft(re);
  for (let k = 0; k < n; k++) {
    if (!keep(Math.min(k, n - k) / (n * dt))) { X.re[k] = 0; X.im[k] = 0; }
  }
  const back = fft(X.re, X.im, true);
  const addTrend = keep(0);
  return Array.from(back.re, (v, k) => v / n + (addTrend ? y0 + slope * k : 0));
}

/* ---------- suavizado ---------- */

// Media móvil centrada de w puntos; en los extremos la ventana se acorta.
function movingAverage(y, w) {
  const n = y.length, h = (w - 1) >> 1, out = new Array(n);
  const cs = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) cs[i + 1] = cs[i] + y[i];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - h), b = Math.min(n - 1, i + h);
    out[i] = (cs[b + 1] - cs[a]) / (b - a + 1);
  }
  return out;
}

// Savitzky–Golay: en cada punto, ajuste por mínimos cuadrados de un polinomio de grado p a los w
// puntos de la ventana (con las x reales, así vale también con pasos desiguales). En los extremos
// la ventana no se acorta sino que se desplaza hacia dentro.
function savgol(x, y, w, p) {
  const n = y.length, h = (w - 1) >> 1, out = new Array(n);
  const m = p + 1;
  for (let i = 0; i < n; i++) {
    const a = clampA(i - h, 0, n - w);
    let sc = 0;
    for (let j = a; j < a + w; j++) sc = Math.max(sc, Math.abs(x[j] - x[i]));
    sc = sc || 1;
    // Ecuaciones normales (m × m) en u = (x − x_i)/escala; el valor en x_i es el término c0.
    const A = Array.from({ length: m }, () => new Float64Array(m + 1));
    for (let j = a; j < a + w; j++) {
      const u = (x[j] - x[i]) / sc;
      const pw = new Float64Array(2 * m);
      pw[0] = 1;
      for (let k = 1; k < 2 * m; k++) pw[k] = pw[k - 1] * u;
      for (let r = 0; r < m; r++) {
        for (let c = 0; c < m; c++) A[r][c] += pw[r + c];
        A[r][m] += pw[r] * y[j];
      }
    }
    out[i] = solveAug(A)[0];
  }
  return out;
}

// Resuelve un sistema [A | b] por eliminación gaussiana con pivote parcial.
function solveAug(A) {
  const m = A.length;
  for (let c = 0; c < m; c++) {
    let piv = c;
    for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    const d = A[c][c] || 1e-300;
    for (let r = c + 1; r < m; r++) {
      const f = A[r][c] / d;
      if (f) for (let k = c; k <= m; k++) A[r][k] -= f * A[c][k];
    }
  }
  const s = new Array(m).fill(0);
  for (let r = m - 1; r >= 0; r--) {
    let v = A[r][m];
    for (let k = r + 1; k < m; k++) v -= A[r][k] * s[k];
    s[r] = v / (A[r][r] || 1e-300);
  }
  return s;
}

/* ---------- correlación ---------- */

// Correlación normalizada r(k) = Σ a'_i b'_{i+k} / √(Σa'² Σb'²), con a' y b' sin su media,
// para k = 0..n−1 (y los negativos si se piden), calculada con FFT y relleno de ceros.
function correlate(a, b, negative = false) {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let m = 1;
  while (m < 2 * n) m <<= 1;
  const ar = new Float64Array(m), br = new Float64Array(m);
  let sa = 0, sb = 0;
  for (let i = 0; i < n; i++) {
    ar[i] = a[i] - ma; br[i] = b[i] - mb;
    sa += ar[i] ** 2; sb += br[i] ** 2;
  }
  const A = fft(ar), B = fft(br);
  const cr = new Float64Array(m), ci = new Float64Array(m);
  for (let k = 0; k < m; k++) {
    cr[k] = A.re[k] * B.re[k] + A.im[k] * B.im[k];
    ci[k] = A.re[k] * B.im[k] - A.im[k] * B.re[k];
  }
  const C = fft(cr, ci, true);
  const norm = Math.sqrt(sa * sb) * m;
  const lag = [], r = [];
  if (negative) for (let k = -(n - 1); k < 0; k++) { lag.push(k); r.push(C.re[m + k] / norm); }
  for (let k = 0; k < n; k++) { lag.push(k); r.push(C.re[k] / norm); }
  return { lag, r };
}

/* ---------- histograma ---------- */

// Histograma de v en `bins` intervalos iguales entre lo y hi (el valor hi entra en el último).
// Sin número de intervalos se usa la regla de Freedman–Diaconis, h = 2·IQR·N^(−1/3), o la de
// Sturges si el rango intercuartílico es cero.
function histogram(v, { bins = null, lo = null, hi = null } = {}) {
  const s = v.filter((a) => isFinite(a)).sort((a, b) => a - b);
  const N = s.length;
  if (lo == null) lo = s[0];
  if (hi == null) hi = s[N - 1];
  if (!bins) {
    const q = (p) => { const t = p * (N - 1), i = Math.floor(t); return s[i] + (s[Math.min(i + 1, N - 1)] - s[i]) * (t - i); };
    const iqr = q(0.75) - q(0.25);
    const hw = 2 * iqr * Math.pow(N, -1 / 3);
    bins = hw > 0 ? Math.ceil((hi - lo) / hw) : Math.ceil(Math.log2(N)) + 1;
    bins = clampA(bins, 1, 1000);
  }
  if (hi === lo) { lo -= 0.5; hi += 0.5; }
  const w = (hi - lo) / bins;
  const count = new Array(bins).fill(0);
  let inside = 0;
  for (const a of s) {
    if (a < lo || a > hi) continue;
    count[Math.min(bins - 1, Math.floor((a - lo) / w))]++;
    inside++;
  }
  const center = count.map((_, k) => lo + (k + 0.5) * w);
  const density = count.map((c) => (inside ? c / (inside * w) : 0));
  return { center, count, density, bins, w, lo, hi, n: N, inside };
}

/* ---------- picos ---------- */

// Máximos locales de y(x) (x creciente) con prominencia ≥ minProm y separados al menos minDist
// en x (si dos están más cerca, queda el más prominente). La prominencia es la altura del pico sobre el
// más alto de los dos mínimos que lo separan de un punto más alto a cada lado (o del extremo), y
// la anchura se mide a media prominencia, interpolando entre puntos.
function findPeaks(x, y, { minProm = 0, minDist = 0, minima = false } = {}) {
  const n = y.length;
  const v = minima ? y.map((a) => -a) : y;
  const peaks = [];
  for (let i = 1; i < n - 1; i++) {
    if (!(v[i] > v[i - 1])) continue;
    let j = i;
    while (j < n - 1 && v[j + 1] === v[i]) j++;
    if (j < n - 1 && v[j + 1] < v[i]) peaks.push((i + j) >> 1);
    i = j;
  }
  const out = [];
  for (const i of peaks) {
    let lmin = v[i], rmin = v[i], a = i, b = i;
    for (a = i - 1; a >= 0 && v[a] <= v[i]; a--) lmin = Math.min(lmin, v[a]);
    for (b = i + 1; b < n && v[b] <= v[i]; b++) rmin = Math.min(rmin, v[b]);
    const prom = v[i] - Math.max(lmin, rmin);
    if (!(prom >= minProm) || prom <= 0) continue;
    const level = v[i] - prom / 2;
    let l = i, r = i;
    while (l > 0 && v[l] > level) l--;
    while (r < n - 1 && v[r] > level) r++;
    const xl = v[l] < level ? x[l] + ((x[l + 1] - x[l]) * (level - v[l])) / (v[l + 1] - v[l]) : x[l];
    const xr = v[r] < level ? x[r - 1] + ((x[r] - x[r - 1]) * (v[r - 1] - level)) / (v[r - 1] - v[r]) : x[r];
    out.push({ i, x: x[i], y: y[i], prom, width: xr - xl });
  }
  if (minDist > 0) {
    const kept = [];
    for (const p of out.slice().sort((a, b) => b.prom - a.prom)) {
      if (kept.every((q) => Math.abs(q.x - p.x) >= minDist)) kept.push(p);
    }
    return kept.sort((a, b) => a.x - b.x);
  }
  return out;
}

if (typeof module !== 'undefined') {
  module.exports = { fft, fftPow2, WINDOWS, sortedPairs, uniformStep, interpLinear, interpSpline, linspace, spectrum, fftFilter, movingAverage, savgol, correlate, histogram, findPeaks };
}
