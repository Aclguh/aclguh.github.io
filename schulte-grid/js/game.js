/**
 * 舒尔特方格 - 纯游戏逻辑与算法模块
 */

const SIZES = [3, 4, 5, 6, 7];
const CELL_FONT = { 3: '2.8rem', 4: '2.35rem', 5: '1.95rem', 6: '1.6rem', 7: '1.35rem' };
const MAX_HISTORY = 30;

function formatTime(sec) {
    return sec.toFixed(2);
}

function formatDateTime(ts) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Fisher-Yates 随机打乱生成 1 ~ max 的数字序列
 * @param {number} max
 * @returns {Array<number>}
 */
function shuffled(max) {
    const arr = Array.from({ length: max }, (_, i) => i + 1);
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * 纯函数：更新最佳成绩
 */
function updateBestRecord(currentBest, currentSize, time, currentErrors) {
    const nextBest = { ...currentBest };
    const prev = nextBest[currentSize];
    const isNew = !prev || time < prev.time;
    if (isNew) {
        nextBest[currentSize] = { time, errors: currentErrors, date: Date.now() };
    }
    return { isNew, best: nextBest };
}

/**
 * 纯函数：追加历史记录
 */
function appendHistory(historyList, entry, maxLen = MAX_HISTORY) {
    const nextList = [entry, ...(historyList || [])];
    if (nextList.length > maxLen) {
        nextList.length = maxLen;
    }
    return nextList;
}

const SchulteGame = {
    SIZES,
    CELL_FONT,
    MAX_HISTORY,
    formatTime,
    formatDateTime,
    shuffled,
    updateBestRecord,
    appendHistory
};

if (typeof window !== 'undefined') {
    window.SchulteGame = SchulteGame;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SchulteGame;
}
