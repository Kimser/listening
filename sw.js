const CACHE_NAME = 'listen-pro-v1.2';
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
  const request = e.request;
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }
  e.respondWith(caches.match(request).then(r => r || fetch(request)));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
});
