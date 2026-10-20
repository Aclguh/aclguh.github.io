/**
 * Service Worker - 静态资源离线缓存与加速
 * 版本：v5
 */

const CACHE_VERSION = 'v5';
const CACHE_NAME = `tomato-tools-${CACHE_VERSION}`;

// 核心预缓存清单（全站主页、共享基础设施及各子工具所有静态资源）
const PRECACHE_URLS = [
    './',
    './index.html',
    './manifest.json',
    './css/home.css',

    // 共享基础层与公共依赖
    './shared/css/tokens.css',
    './shared/css/ui-kit.css',
    './shared/js/theme.js',
    './shared/js/storage.js',
    './shared/js/security.js',
    './shared/js/ui-kit.js',
    './shared/data/weapons.js',
    './shared/vendor/chart.umd.min.js',
    './shared/vendor/xlsx.full.min.js',

    // 看番记录
    './anime-record/index.html',
    './anime-record/css/style.css',
    './anime-record/js/models.js',
    './anime-record/js/storage.js',
    './anime-record/js/ui.js',
    './anime-record/js/form.js',
    './anime-record/js/import-export.js',
    './anime-record/js/sync.js',
    './anime-record/js/settings.js',
    './anime-record/js/drag-sort.js',
    './anime-record/js/app.js',

    // 课程表
    './class-schedule/index.html',
    './class-schedule/css/style.css',
    './class-schedule/js/storage.js',
    './class-schedule/js/parser.js',
    './class-schedule/js/ui.js',
    './class-schedule/js/app.js',

    // 体重记录
    './weightRecord/index.html',
    './weightRecord/css/style.css',
    './weightRecord/js/calc.js',
    './weightRecord/js/storage.js',
    './weightRecord/js/chart-config.js',
    './weightRecord/js/table-view.js',
    './weightRecord/js/app.js',

    // 天国骰子
    './farkle/index.html',
    './farkle/css/style.css',
    './farkle/js/badge-data.js',
    './farkle/js/dice-data.js',
    './farkle/js/scoring.js',
    './farkle/js/state.js',
    './farkle/js/ai.js',
    './farkle/js/ui-board.js',
    './farkle/js/modal-manager.js',
    './farkle/js/app.js',

    // 舒尔特方格
    './schulte-grid/index.html',
    './schulte-grid/css/style.css',
    './schulte-grid/js/game.js',
    './schulte-grid/js/app.js',

    // 将棋
    './shogi/index.html',
    './shogi/css/style.css',
    './shogi/js/engine.js',
    './shogi/js/ai-worker.js',
    './shogi/js/tutorial.js',
    './shogi/js/app.js',

    // 斗地主
    './doudizhu/index.html',
    './doudizhu/css/style.css',
    './doudizhu/js/cards.js',
    './doudizhu/js/ai.js',
    './doudizhu/js/app.js',

    // 图片混淆
    './imageObfuscation/index.html',
    './imageObfuscation/css/style.css',
    './imageObfuscation/js/gilbert.js',
    './imageObfuscation/js/worker.js',
    './imageObfuscation/js/app.js',

    // 终末地武器库与推荐
    './ark_end/all_weapons/index.html',
    './ark_end/all_weapons/css/style.css',
    './ark_end/all_weapons/js/app.js',
    './ark_end/weapons_recommend/index.html',
    './ark_end/weapons_recommend/css/style.css',
    './ark_end/weapons_recommend/js/app.js'
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
