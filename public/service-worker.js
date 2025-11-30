const CACHE_NAME = 'city-bloom-v2';
const ASSETS = [
    '/',
    '/styles.css',
    '/nav.js',
    '/main.js',
    '/offline.html'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        ))
    );
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const isNavigation = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

    event.respondWith(
        caches.match(req).then(cached => {
            const fetchPromise = fetch(req).then(networkRes => {
                if (networkRes && networkRes.ok) {
                    caches.open(CACHE_NAME).then(cache => cache.put(req, networkRes.clone()));
                }
                return networkRes;
            }).catch(async () => {
                if (isNavigation) {
                    const cache = await caches.open(CACHE_NAME)
                    const offline = await cache.match('/offline.html')
                    if (offline) return offline
                }
                return cached
            });
            return cached || fetchPromise;
        })
    );
});
