const { describe, it, expect } = require('../test-utils.js');
const { scoreValues, hasAnyScore, takeGroups, scoreDetail } = require('../../farkle/js/scoring.js');

describe('Farkle Scoring Engine', () => {
    describe('scoreValues', () => {
        it('calculates single 1 and 5', () => {
            expect(scoreValues([1])).toEqual({ score: 100, valid: true });
            expect(scoreValues([5])).toEqual({ score: 50, valid: true });
            expect(scoreValues([1, 5])).toEqual({ score: 150, valid: true });
            expect(scoreValues([1, 1])).toEqual({ score: 200, valid: true });
        });

        it('identifies invalid dice rolls (no score or incomplete selection)', () => {
            expect(scoreValues([])).toEqual({ score: 0, valid: false });
            expect(scoreValues([2, 3])).toEqual({ score: 0, valid: false });
            expect(scoreValues([1, 2])).toEqual({ score: 0, valid: false });
        });

        it('calculates 3-of-a-kind and higher multiples', () => {
            expect(scoreValues([1, 1, 1])).toEqual({ score: 1000, valid: true });
            expect(scoreValues([1, 1, 1, 1])).toEqual({ score: 2000, valid: true });
            expect(scoreValues([2, 2, 2])).toEqual({ score: 200, valid: true });
            expect(scoreValues([3, 3, 3])).toEqual({ score: 300, valid: true });
            expect(scoreValues([6, 6, 6, 6, 6, 6])).toEqual({ score: 600 * 8, valid: true });
        });

        it('handles Emperor badge for 1s', () => {
            expect(scoreValues([1, 1, 1], { emperor: true })).toEqual({ score: 3000, valid: true });
            expect(scoreValues([1, 1, 1, 1], { emperor: true })).toEqual({ score: 6000, valid: true });
        });

        it('calculates small and large straights', () => {
            expect(scoreValues([1, 2, 3, 4, 5])).toEqual({ score: 500, valid: true });
            expect(scoreValues([2, 3, 4, 5, 6])).toEqual({ score: 750, valid: true });
            expect(scoreValues([1, 2, 3, 4, 5, 6])).toEqual({ score: 1500, valid: true });
        });

        it('handles badge combos (eye, gallows, cut)', () => {
            expect(scoreValues([1, 3, 5], { eye: 250 })).toEqual({ score: 250, valid: true });
            expect(scoreValues([4, 5, 6], { gallows: 150 })).toEqual({ score: 150, valid: true });
            expect(scoreValues([3, 5], { cut: 75 })).toEqual({ score: 75, valid: true });
        });
    });

    describe('hasAnyScore', () => {
        it('returns true when scoring dice exist', () => {
            expect(hasAnyScore([1, 2, 3, 4])).toBe(true);
            expect(hasAnyScore([5, 2, 3, 4])).toBe(true);
            expect(hasAnyScore([2, 2, 2, 4])).toBe(true);
            expect(hasAnyScore([1, 2, 3, 4, 5, 6])).toBe(true);
        });

        it('returns false when no scoring dice exist', () => {
            expect(hasAnyScore([2, 3, 4, 6])).toBe(false);
            expect(hasAnyScore([])).toBe(false);
        });

        it('recognizes badge combos', () => {
            expect(hasAnyScore([3, 5], { cut: 75 })).toBe(true);
            expect(hasAnyScore([3, 5])).toBe(true);
            expect(hasAnyScore([4, 6], { gallows: 150 })).toBe(false);
            expect(hasAnyScore([4, 5, 6], { gallows: 150 })).toBe(true);
        });
    });

    describe('takeGroups and scoreDetail', () => {
        it('groups straight correctly', () => {
            const groups = takeGroups([1, 2, 3, 4, 5, 6]);
            expect(groups.length).toBe(1);
            expect(groups[0].quick).toBe(true);
            expect(scoreDetail([1, 2, 3, 4, 5, 6])).toBe('顺子1-6 1500');
        });

        it('formats scoreDetail for triples and singles', () => {
            const detail = scoreDetail([1, 1, 1, 5]);
            expect(detail).toContain('三同1 1000');
            expect(detail).toContain('单5 50');
        });
    });
});
