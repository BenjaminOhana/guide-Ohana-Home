const CACHE_NAME = 'ohana-home-v2';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/app.js',
    '/js/firebase-config.js',
    '/guestbook_mobile.html',
    // Fonts
    'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Raleway:wght@300;400;500;600&family=Caveat:wght@400;600;700&display=swap',
    // Critical Images (Preloaded in index.html)
    '/assets/img/hero/hero_3.jpg',
    '/assets/img/sejour/maison_main.jpg',
    '/assets/img/sejour/regles_main.png',
    '/assets/img/sejour/equipements_main.jpg',
    '/assets/img/sejour/parking_wifi_main.jpg',
    '/assets/img/sejour/consignes_main.jpg',
    '/assets/img/sejour/adresses_main.jpg',
    '/assets/img/sejour/assistance_main.jpg',
    '/assets/img/adresses/regaler_main.png',
    '/assets/img/adresses/respirer_main.jpg'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching critical assets...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Cache First strategy for images
    if (event.request.destination === 'image') {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // Network First, fallback to cache for others
    event.respondWith(
        fetch(event.request)
            .catch(() => caches.match(event.request))
    );
});
