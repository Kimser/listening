const CACHE_NAME = 'listen-pro-v1.1';
const ASSETS = [
  './', 
  './index.html', 
  './css/style.css', 
  './js/data.js', 
  './js/audio.js', 
  './js/app.js',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
});
