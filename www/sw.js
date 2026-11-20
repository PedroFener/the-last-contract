// THE LAST CONTRACT — service worker: guarda todos os arquivos para jogar offline
// (só é ativado quando o jogo é servido por http/https; abrindo o index.html direto não é necessário)
const CACHE = 'tlc-v2';
const FILES = [
  './', './index.html', './style.css', './game.js', './manifest.json',
  './js/utils.js', './js/audio.js', './js/input.js', './js/sprites.js', './js/maps.js',
  './js/levels.js', './js/world.js', './js/entities.js',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/icons/icon-maskable-512.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
