'use strict';
// sw.js: Plot.It sin conexión. Al instalarse guarda la app entera en la caché; después, cada
// archivo se pide primero a la red (así siempre se usa la última versión) y, si no hay conexión,
// sale de la caché. Solo funciona servido por https o localhost, no abriendo index.html a mano.

const CACHE = 'plotit-v1';
const FILES = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'i18n.js', 'expr.js', 'fit.js', 'analysis.js', 'core.js', 'table.js', 'sciprj.js', 'graph.js',
  'menu.js', 'split.js', 'examples.js', 'app.js', 'fonts/cmu-serif.js',
  'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
});
