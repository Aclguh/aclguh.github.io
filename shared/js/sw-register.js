/**
 * Service Worker 全站注册脚本
 */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((err) => {
            console.warn('[SW] Register failed:', err);
        });
    });
}
