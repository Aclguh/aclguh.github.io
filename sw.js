/**
 * Service Worker - 静态资源离线缓存与加速
 */

const CACHE_NAME = 'tomato-tools-v1';
const PRECACHE_URLS = [
    './',
    './index.html',
    './manifest.json',
    './shared/js/theme.js',
    './shared/js/storage.js',
    './shared/js/security.js',
    './shared/vendor/chart.umd.min.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(PRECACHE_URLS);
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(name => {
                    if (name !== CACHE_NAME) {
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    // 仅处理 GET 请求且协议为 http/https
    if (request.method !== 'GET' || !request.url.startsWith('http')) return;

    event.respondWith(
        caches.match(request).then(cachedResponse => {
            // 静态资源：命中缓存则优先返回，并在后台异步更新
            if (cachedResponse) {
                fetch(request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then(cache => cache.put(request, networkResponse));
                    }
                }).catch(() => {/* 离线状态忽略网络错误 */});
                return cachedResponse;
            }

            // 未命中缓存：网络优先
            return fetch(request).then(networkResponse => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
                return networkResponse;
            }).catch(() => {
                // 导航请求离线回退到 index.html
                if (request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
