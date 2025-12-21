// Service Worker v8 - Offline-First for Kiosk Mode
// Goal: Minimize Netlify bandwidth, serve images from local cache

const CACHE_VERSION = 'v11';
const STATIC_CACHE = `ohana-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `ohana-images-${CACHE_VERSION}`;

// Static assets - cached on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/app.js',
    '/js/firebase-config.js',
    '/js/translations.js',
    '/guestbook_mobile.html',
    '/admin.html',
    // Firebase CDN
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js',
    // Fonts
    'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Raleway:wght@300;400;500;600&family=Caveat:wght@400;600;700&display=swap'
];

// All images to cache - will be served from cache first (no network request)
const IMAGE_ASSETS = [
    // Background
    '/assets/img/background-tropical.png',
    '/assets/img/bg-texture.jpg',

    // Hero images (17)
    '/assets/img/hero/hero_3.jpg',
    '/assets/img/hero/hero_4.jpg',
    '/assets/img/hero/hero_5.jpg',
    '/assets/img/hero/hero_6.png',
    '/assets/img/hero/hero_7.png',
    '/assets/img/hero/hero_8.jpg',
    '/assets/img/hero/hero_hq_1.png.jpg',
    '/assets/img/hero/hero_hq_3.png.jpg',
    '/assets/img/hero/hero_hq_4.png.jpg',
    '/assets/img/hero/hero_hq_5.png.jpg',
    '/assets/img/hero/hero_hq_6.png.jpg',
    '/assets/img/hero/hero_hq_7.png.jpg',
    '/assets/img/hero/hero_hq_8.png.jpg',
    '/assets/img/hero/hero_hq_9.png.jpg',
    '/assets/img/hero/hero_hq_10.png.jpg',
    '/assets/img/hero/hero_hq_11.png.jpg',
    '/assets/img/hero/hero_hq_12.png.jpg',

    // Screensaver images (30+)
    '/assets/img/screensaver/slide_ben_overlay.jpg',
    '/assets/img/screensaver/slide_dog_message.png',
    '/assets/img/screensaver/slide_hq_1.png.jpg',
    '/assets/img/screensaver/slide_hq_3.png.jpg',
    '/assets/img/screensaver/slide_hq_4.png.jpg',
    '/assets/img/screensaver/slide_hq_5.png.jpg',
    '/assets/img/screensaver/slide_hq_6.png.jpg',
    '/assets/img/screensaver/slide_hq_7.png.jpg',
    '/assets/img/screensaver/slide_hq_8.png.jpg',
    '/assets/img/screensaver/slide_hq_9.png.jpg',
    '/assets/img/screensaver/slide_hq_10.png.jpg',
    '/assets/img/screensaver/slide_hq_11.png.jpg',
    '/assets/img/screensaver/slide_hq_12.png.jpg',
    '/assets/img/screensaver/slide_gen_1.png',
    '/assets/img/screensaver/slide_gen_2.png',
    '/assets/img/screensaver/slide_gen_4.png',
    '/assets/img/screensaver/slide_gen_5.png',
    '/assets/img/screensaver/slide_gen_6.png',
    '/assets/img/screensaver/slide_gen_7.png',
    '/assets/img/screensaver/slide_8.png',
    '/assets/img/screensaver/slide_12.png',
    '/assets/img/screensaver/slide_13.png',
    '/assets/img/screensaver/slide_17.png',
    '/assets/img/screensaver/slide_18.png',
    '/assets/img/screensaver/slide_19.png',
    '/assets/img/screensaver/slide_20.png',
    '/assets/img/screensaver/slide_21.png',
    '/assets/img/screensaver/slide_22.png',
    '/assets/img/screensaver/slide_23.png',
    '/assets/img/screensaver/slide_24.png',
    '/assets/img/screensaver/slide_26.png',
    '/assets/img/screensaver/slide_28.png',
    '/assets/img/screensaver/slide_29.png',
    '/assets/img/screensaver/slide_30.png',
    '/assets/img/screensaver/slide_31.png',
    '/assets/img/screensaver/slide_32.png',

    // Sejour section images
    '/assets/img/sejour/maison_main.jpg',
    '/assets/img/sejour/regles_main.png',
    '/assets/img/sejour/equipements_main.jpg',
    '/assets/img/sejour/parking_wifi_main.jpg',
    '/assets/img/sejour/consignes_main.jpg',
    '/assets/img/sejour/adresses_main.jpg',
    '/assets/img/sejour/assistance_main.jpg',

    // Adresses section images
    '/assets/img/adresses/regaler_main.png',
    '/assets/img/adresses/respirer_main.jpg',
    '/assets/img/adresses/explorer_main.jpg',
    '/assets/img/adresses/indispensable_main.jpg',
    '/assets/img/adresses/cat_restaurant.png',
    '/assets/img/adresses/cat_boulangerie.png',
    '/assets/img/adresses/cat_street_food.png',
    '/assets/img/adresses/cat_parc_urbain.png',
    '/assets/img/adresses/cat_promenade_nature.png',
    '/assets/img/adresses/cat_courses.png',
    '/assets/img/adresses/cat_sante.png',
    '/assets/img/adresses/cat_mobilite.png',
    '/assets/img/adresses/resto_arsene_clara.png',
    '/assets/img/adresses/resto_moulins_bleus.png',
    '/assets/img/adresses/resto_ptit_bistro.png',
    '/assets/img/adresses/boulangerie_berns.jpg',
    '/assets/img/adresses/boulangerie_fischer.jpg',
    '/assets/img/adresses/boulangerie_la_fabrik.jpg',
    '/assets/img/adresses/street_le_class.jpg',
    '/assets/img/adresses/street_pollux.jpg',
    '/assets/img/adresses/street_simply_good.png',
    '/assets/img/adresses/respirer_berges.jpg',
    '/assets/img/adresses/respirer_napoleon.jpg',
    '/assets/img/adresses/respirer_nauticham.jpg',
    '/assets/img/adresses/respirer_wilson.jpg',
    '/assets/img/adresses/respirer_aeroparc.png',
    '/assets/img/adresses/explorer_luxembourg.jpg',
    '/assets/img/adresses/explorer_malbrouck.jpg',
    '/assets/img/adresses/explorer_fort_guentrange.jpg',
    '/assets/img/adresses/explorer_tour_aux_puces.jpg',
    '/assets/img/adresses/indispensable_carrefour.jpg',
    '/assets/img/adresses/indispensable_geric.jpg',
    '/assets/img/adresses/indispensable_lidl.jpg',
    '/assets/img/adresses/indispensable_pharmacie.jpg',
    '/assets/img/adresses/indispensable_gare.png',

    // Story
    '/assets/img/story/qr_code_entrepreneur.png'
];

// Install: Cache all static and image assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing v7 - Offline First Mode');
    self.skipWaiting();

    event.waitUntil(
        Promise.all([
            // Cache static assets
            caches.open(STATIC_CACHE).then((cache) => {
                console.log('[SW] Caching static assets...');
                return cache.addAll(STATIC_ASSETS);
            }),
            // Cache images
            caches.open(IMAGE_CACHE).then((cache) => {
                console.log('[SW] Caching images...');
                return cache.addAll(IMAGE_ASSETS);
            })
        ])
    );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating v7');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete old version caches
                    if (!cacheName.includes(CACHE_VERSION)) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// Fetch: Serve from cache first, fall back to network
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // SKIP: Firebase/Firestore requests (need real-time data)
    if (url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('firebase') ||
        url.hostname.includes('gstatic.com')) {
        // Network only for Firebase real-time
        return;
    }

    // SKIP: External API calls (weather, QR codes)
    if (url.hostname.includes('api.open-meteo.com') ||
        url.hostname.includes('api.qrserver.com')) {
        return;
    }

    // IMAGES: Cache-First (never hit network if cached)
    if (event.request.destination === 'image' ||
        url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    // Serve from cache - NO network request
                    return cachedResponse;
                }
                // Not in cache, fetch and cache for next time
                return fetch(event.request).then((networkResponse) => {
                    return caches.open(IMAGE_CACHE).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // STATIC ASSETS (HTML, CSS, JS): Cache-First with network fallback
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then((networkResponse) => {
                // Cache new static assets
                if (event.request.method === 'GET') {
                    return caches.open(STATIC_CACHE).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                }
                return networkResponse;
            });
        }).catch(() => {
            // Offline fallback
            if (event.request.destination === 'document') {
                return caches.match('/index.html');
            }
        })
    );
});

// Listen for messages from the app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    // Code-only update (CSS/JS/HTML) - keeps images in cache
    if (event.data && event.data.type === 'CLEAR_STATIC_CACHE') {
        console.log('[SW] Clearing static cache (code only)...');
        event.waitUntil(
            caches.delete(STATIC_CACHE).then(() => {
                console.log('[SW] Static cache cleared. Re-caching code...');
                return caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS));
            })
        );
    }

    // Full cache clear (when images are updated)
    if (event.data && event.data.type === 'CLEAR_ALL_CACHES') {
        console.log('[SW] Clearing all caches for full refresh...');
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            }).then(() => {
                console.log('[SW] All caches cleared. Re-caching...');
                // Re-cache everything
                return Promise.all([
                    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)),
                    caches.open(IMAGE_CACHE).then((cache) => cache.addAll(IMAGE_ASSETS))
                ]);
            })
        );
    }
});
