/**
 * Service Worker - 静态资源离线缓存与加速
 * 版本：v6（分层预缓存 + 子应用按需路由动态缓存）
 */

const CACHE_VERSION = 'v6';
const CACHE_NAME = `tomato-tools-${CACHE_VERSION}`;

// 核心预缓存清单：全站主页、共享基础设施及各子应用导航入口 HTML
// 大型第三方库（XLSX 800KB、Chart.js 200KB）与各工具专有脚本采用路由按需缓存，避免首访全量下载
const PRECACHE_URLS = [
    './',
    './index.html',
    './manifest.json',
    './css/home.css',

    // 共享核心基础层
    './shared/css/tokens.css',
    './shared/css/ui-kit.css',
    './shared/js/theme.js',
    './shared/js/storage.js',
    './shared/js/security.js',
    './shared/js/ui-kit.js',
    './shared/js/sw-register.js',

    // 各子应用离线导航入口 HTML
    './anime-record/index.html',
    './class-schedule/index.html',
    './weightRecord/index.html',
    './farkle/index.html',
    './schulte-grid/index.html',
    './shogi/index.html',
    './doudizhu/index.html',
    './imageObfuscation/index.html',
    './ark_end/all_weapons/index.html',
    './ark_end/weapons_recommend/index.html'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(PRECACHE_URLS);
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((name) => {
                        if (name !== CACHE_NAME) {
                            return caches.delete(name);
                        }
                    })
                );
            })
            .then(() => self.clients.claim())
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    // 仅处理 GET 请求且协议为 http/https
    if (request.method !== 'GET' || !request.url.startsWith('http')) return;

    // 排除外部动态 API（如 GitHub API 等），不走静态缓存逻辑
    if (request.url.includes('api.github.com')) {
        event.respondWith(fetch(request));
        return;
    }

    event.respondWith(
        caches.match(request, { ignoreSearch: true }).then((cachedResponse) => {
            // 静态资源：命中缓存则优先返回，并在后台异步更新缓存 (Stale-While-Revalidate)
            if (cachedResponse) {
                fetch(request)
                    .then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
                        }
                    })
                    .catch(() => {
                        /* 离线状态忽略网络错误 */
                    });
                return cachedResponse;
            }

            // 未命中缓存：网络优先，成功后动态存入缓存
            return fetch(request)
                .then((networkResponse) => {
                    if (
                        !networkResponse ||
                        networkResponse.status !== 200 ||
                        (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')
                    ) {
                        return networkResponse;
                    }
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
                    return networkResponse;
                })
                .catch(() => {
                    // 导航请求离线回退：优先匹配已缓存的页面，否则回退至主页
                    if (request.mode === 'navigate') {
                        return caches
                            .match(request, { ignoreSearch: true })
                            .then((page) => page || caches.match('./index.html'));
                    }
                });
        })
    );
});
