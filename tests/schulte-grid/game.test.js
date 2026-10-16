const { describe, it, expect } = require('../test-utils.js');
const SchulteGame = require('../../schulte-grid/js/game.js');
const { shuffled, updateBestRecord, appendHistory, SIZES } = SchulteGame;

describe('Schulte Grid Game Core', () => {
    it('generates complete and unique numbers from 1 to N^2', () => {
        for (const s of SIZES) {
            const total = s * s;
            const arr = shuffled(total);

            expect(arr.length).toBe(total);
            const set = new Set(arr);
            expect(set.size).toBe(total);

            for (let i = 1; i <= total; i++) {
                expect(set.has(i)).toBe(true);
            }
        }
    });

    it('shuffles elements randomly instead of preserving original sorted order', () => {
        const total = 25; // 5x5
        const arr = shuffled(total);
        let inOrder = true;
        for (let i = 0; i < total; i++) {
            if (arr[i] !== i + 1) {
                inOrder = false;
                break;
            }
        }
        expect(inOrder).toBe(false);
    });

    it('updates best record properly for first, better, and worse attempts', () => {
        let best = {};

        // 首次完成
        const r1 = updateBestRecord(best, 5, 18.5, 0);
        expect(r1.isNew).toBe(true);
        expect(r1.best[5].time).toBe(18.5);
        best = r1.best;

        // 较差成绩
        const r2 = updateBestRecord(best, 5, 21.0, 1);
        expect(r2.isNew).toBe(false);
        expect(r2.best[5].time).toBe(18.5);

        // 突破新高
        const r3 = updateBestRecord(best, 5, 15.2, 0);
        expect(r3.isNew).toBe(true);
        expect(r3.best[5].time).toBe(15.2);
    });

    it('appends history entries and respects max limit', () => {
        let history = [];
        const maxLen = 3;

        history = appendHistory(history, { time: 10 }, maxLen);
        history = appendHistory(history, { time: 9 }, maxLen);
        history = appendHistory(history, { time: 8 }, maxLen);
        expect(history.length).toBe(3);
        expect(history[0].time).toBe(8);

        // 超过限制，保留最新3条，淘汰最旧一条
        history = appendHistory(history, { time: 7 }, maxLen);
        expect(history.length).toBe(3);
        expect(history[0].time).toBe(7);
        expect(history[2].time).toBe(9);
    });
});
