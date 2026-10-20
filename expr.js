'use strict';
// Expresiones matemáticas (fórmulas de columna, funciones y modelos de ajuste).
// Analizador propio: el texto del usuario se convierte en un árbol y el árbol en JavaScript
// que solo contiene números, operadores y los nombres conocidos de abajo, así que no se
// ejecuta nada que no sea una cuenta. Se compila una vez y se evalúa rápido en cada fila.

// Γ(x) con la aproximación de Lanczos (g = 7, n = 9): unas 15 cifras.
const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
function gammaFn(x) {
  if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gammaFn(1 - x));
  x -= 1;
  let a = LANCZOS[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
  return Math.sqrt(2 * Math.PI) * Math.pow(t, x + 0.5) * Math.exp(-t) * a;
}
// erfc con desarrollo de Chebyshev (Numerical Recipes, error relativo < 1.2e-7).
function erfcFn(x) {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

// Funciones disponibles: [función, nº de argumentos (-1 = cualquiera, al menos uno)].
const EXPR_FUNCS = {
  sin: [Math.sin, 1], cos: [Math.cos, 1], tan: [Math.tan, 1],
  asin: [Math.asin, 1], acos: [Math.acos, 1], atan: [Math.atan, 1], atan2: [Math.atan2, 2],
  sinh: [Math.sinh, 1], cosh: [Math.cosh, 1], tanh: [Math.tanh, 1],
  asinh: [Math.asinh, 1], acosh: [Math.acosh, 1], atanh: [Math.atanh, 1],
  exp: [Math.exp, 1], ln: [Math.log, 1], log: [Math.log10, 1], log10: [Math.log10, 1], log2: [Math.log2, 1],
  sqrt: [Math.sqrt, 1], cbrt: [Math.cbrt, 1], abs: [Math.abs, 1], sign: [Math.sign, 1],
  floor: [Math.floor, 1], ceil: [Math.ceil, 1], round: [Math.round, 1],
  min: [Math.min, -1], max: [Math.max, -1], hypot: [Math.hypot, -1], pow: [Math.pow, 2],
  mod: [(a, b) => a - b * Math.floor(a / b), 2],
  erf: [(x) => 1 - erfcFn(x), 1], erfc: [erfcFn, 1], gamma: [gammaFn, 1],
  rand: [() => Math.random(), 0],
  if: [(c, a, b) => (c ? a : b), 3],
};
const EXPR_CONSTS = { pi: Math.PI, e: Math.E };
const EXPR_F = Object.fromEntries(Object.entries(EXPR_FUNCS).map(([k, v]) => [k, v[0]]));

function exprError(code, pos, arg) {
  const e = new Error(code + (arg ? ': ' + arg : ''));
  e.code = code; e.pos = pos; e.arg = arg;
  return e;
}

function tokenize(src) {
  const toks = [];
  const re = /\s*(?:(\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+(?:[eE][-+]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|"([^"]*)"|'([^']*)'|(\*\*|<=|>=|==|!=|&&|\|\||[-+*/^%(),<>!?:]))/y;
  let pos = 0;
  while (pos < src.length) {
    if (/^\s*$/.test(src.slice(pos))) break;
    re.lastIndex = pos;
    const m = re.exec(src);
    if (!m) {
      const p = pos + (src.slice(pos).length - src.slice(pos).trimStart().length);
      throw exprError('char', p, src[p]);
    }
    const at = m.index + m[0].length - m[0].trimStart().length;
    if (m[1] !== undefined) toks.push({ k: 'num', v: parseFloat(m[1]), pos: at });
    else if (m[2] !== undefined) toks.push({ k: 'id', v: m[2], pos: at });
    else if (m[3] !== undefined || m[4] !== undefined) toks.push({ k: 'str', v: m[3] ?? m[4], pos: at });
    else toks.push({ k: 'op', v: m[5] === '**' ? '^' : m[5], pos: at });
    pos = re.lastIndex;
  }
  toks.push({ k: 'end', pos: src.length });
  return toks;
}

// Precedencias de menor a mayor: ?:, ||, &&, comparaciones, + -, * / %, unarios, ^.
// El menos unario va por debajo de la potencia: -x^2 = -(x^2), y 2^-3 funciona.
function parseExpr(src) {
  const toks = tokenize(String(src));
  let i = 0;
  const peek = () => toks[i];
  const isOp = (v) => toks[i].k === 'op' && toks[i].v === v;
  const expect = (v) => {
    if (!isOp(v)) throw exprError(toks[i].k === 'end' ? 'end' : 'expected', toks[i].pos, v);
    i++;
  };
  function cond() {
    const c = or();
    if (!isOp('?')) return c;
    i++;
    const a = cond();
    expect(':');
    return { t: 'cond', c, a, b: cond() };
  }
  function binLevel(ops, next) {
    return function level() {
      let a = next();
      while (toks[i].k === 'op' && ops.includes(toks[i].v)) {
        const op = toks[i++].v;
        a = { t: 'bin', op, a, b: next() };
      }
      return a;
    };
  }
  function unary() {
    if (isOp('-') || isOp('+') || isOp('!')) {
      const op = toks[i++].v;
      return { t: 'un', op, a: unary() };
    }
    return power();
  }
  function power() {
    const a = primary();
    if (isOp('^')) { i++; return { t: 'bin', op: '^', a, b: unary() }; }
    return a;
  }
  function primary() {
    const tk = peek();
    if (tk.k === 'num') { i++; return { t: 'num', v: tk.v }; }
    if (tk.k === 'str') { i++; return { t: 'str', v: tk.v, pos: tk.pos }; }
    if (tk.k === 'id') {
      i++;
      if (isOp('(')) {
        i++;
        const args = [];
        if (!isOp(')')) {
          for (;;) {
            args.push(cond());
            if (isOp(',')) { i++; continue; }
            break;
          }
        }
        expect(')');
        return { t: 'call', name: tk.v, args, pos: tk.pos };
      }
      return { t: 'var', name: tk.v, pos: tk.pos };
    }
    if (isOp('(')) { i++; const e = cond(); expect(')'); return e; }
    throw exprError(tk.k === 'end' ? 'end' : 'unexpected', tk.pos, tk.v);
  }
  const or = binLevel(['||'], binLevel(['&&'], binLevel(['==', '!=', '<', '>', '<=', '>='], binLevel(['+', '-'], binLevel(['*', '/', '%'], unary)))));
  if (toks[0].k === 'end') throw exprError('empty', 0);
  const ast = cond();
  if (peek().k !== 'end') {
    const tk = peek();
    // Dos operandos seguidos ("2x", "a b") suelen ser un * olvidado.
    throw exprError(tk.k === 'op' ? 'unexpected' : 'missing_op', tk.pos, tk.v);
  }
  return ast;
}

// Nombres sueltos que aparecen en una expresión (sin funciones ni constantes), por orden.
function exprNames(src) {
  const names = [];
  const walk = (n) => {
    if (n.t === 'var' && !(n.name in EXPR_CONSTS) && !names.includes(n.name)) names.push(n.name);
    if (n.t === 'call' && n.name === 'col') return;
    if (n.t === 'call' && n.name === 'cell') { if (n.args[1]) walk(n.args[1]); return; }
    for (const k of ['a', 'b', 'c']) if (n[k]) walk(n[k]);
    if (n.args) n.args.forEach(walk);
  };
  walk(parseExpr(src));
  return names;
}

// Compila a una función (v, C) => número. `resolve.name(nombre)` da el código JS de una
// variable (o null si no existe); `resolve.col(nombre)` el de col("nombre").
function compileExpr(src, resolve) {
  const ast = parseExpr(src);
  const js = (n) => {
    switch (n.t) {
      case 'num': return '(' + String(n.v) + ')';
      case 'str': throw exprError('string', n.pos, n.v);
      case 'var': {
        const r = resolve.name && resolve.name(n.name);
        if (r != null) return '(' + r + ')';
        if (n.name in EXPR_CONSTS) return '(' + EXPR_CONSTS[n.name] + ')';
        throw exprError('unknown_var', n.pos, n.name);
      }
      case 'call': {
        if (n.name === 'col') {
          const a = n.args[0];
          const name = n.args.length === 1 && a && (a.t === 'str' ? a.v : a.t === 'var' ? a.name : null);
          const r = name != null && resolve.col ? resolve.col(name) : null;
          if (r == null) throw exprError(resolve.col ? 'unknown_col' : 'no_col', n.pos, name || '');
          return '(' + r + ')';
        }
        // cell("A", i-1): valor de otra fila.
        if (n.name === 'cell' && resolve.cell) {
          const a = n.args[0];
          const name = n.args.length === 2 && a && (a.t === 'str' ? a.v : a.t === 'var' ? a.name : null);
          const r = name != null ? resolve.cell(name, js(n.args[1])) : null;
          if (r == null) throw exprError(n.args.length === 2 ? 'unknown_col' : 'arity', n.pos, name || 'cell');
          return '(' + r + ')';
        }
        const f = EXPR_FUNCS[n.name];
        if (!f) throw exprError('unknown_func', n.pos, n.name);
        if (f[1] >= 0 ? n.args.length !== f[1] : n.args.length < 1) throw exprError('arity', n.pos, n.name);
        return 'F.' + n.name + '(' + n.args.map(js).join(',') + ')';
      }
      case 'un': return n.op === '!' ? '(+!' + js(n.a) + ')' : '(' + n.op + js(n.a) + ')';
      case 'cond': return '(' + js(n.c) + '?' + js(n.a) + ':' + js(n.b) + ')';
      case 'bin': {
        const a = js(n.a), b = js(n.b);
        if (n.op === '^') return 'Math.pow(' + a + ',' + b + ')';
        if (n.op === '%') return 'F.mod(' + a + ',' + b + ')';
        if (n.op === '==') return '(+(' + a + '===' + b + '))';
        if (n.op === '!=') return '(+(' + a + '!==' + b + '))';
        if (['<', '>', '<=', '>=', '&&', '||'].includes(n.op)) return '(+(' + a + n.op + b + '))';
        return '(' + a + n.op + b + ')';
      }
    }
    throw exprError('unexpected', 0);
  };
  const code = js(ast);
  // eslint-disable-next-line no-new-func
  const f = new Function('F', 'v', 'C', '"use strict";return ' + code + ';');
  return (v, C) => f(EXPR_F, v, C);
}

if (typeof module !== 'undefined') module.exports = { parseExpr, compileExpr, exprNames, EXPR_FUNCS, EXPR_CONSTS, gammaFn, erfcFn };
