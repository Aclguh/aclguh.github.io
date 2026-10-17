'use strict';
/* =====================================================================
 * 将棋 AI 计算 Web Worker
 * 将 Minimax 搜索计算移出主线程，保持 UI 交互 60 FPS 流畅
 * ===================================================================== */

/* global importScripts, deserializeState, aiChooseMove */

try {
    importScripts('engine.js');
} catch (err) {
    // Worker 环境无法加载 engine.js 时交由主线程捕获
}

self.onmessage = function (e) {
    const data = e.data || {};
    const token = data.token;

    if (data.type === 'calculate') {
        try {
            if (typeof deserializeState !== 'function' || typeof aiChooseMove !== 'function') {
                throw new Error('Engine functions not loaded in worker');
            }
            const state = deserializeState(data.serializedState);
            const res = aiChooseMove(state, data.level, data.timeBudgetMs);
            self.postMessage({ token: token, success: true, res: res });
        } catch (err) {
            self.postMessage({ token: token, success: false, error: err.message });
        }
    }
};
