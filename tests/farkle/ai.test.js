const { describe, it, expect } = require('../test-utils.js');
const FarkleAI = require('../../farkle/js/ai.js');

describe('Farkle AI Strategy Module', () => {
    describe('aiShouldContinue', () => {
        it('always continues on hot dice (remaining === 0)', () => {
            expect(FarkleAI.aiShouldContinue(0, 1000, 2000, 8000)).toBe(true);
        });

        it('continues when remaining dice >= 3 due to low bust probability', () => {
            expect(FarkleAI.aiShouldContinue(3, 500, 1000, 8000)).toBe(true);
            expect(FarkleAI.aiShouldContinue(4, 300, 1000, 8000)).toBe(true);
        });

        it('stops to bank points when remaining dice <= 2 and score reaches threshold (>= 350)', () => {
            expect(FarkleAI.aiShouldContinue(2, 400, 1000, 8000)).toBe(false);
            expect(FarkleAI.aiShouldContinue(1, 350, 1000, 8000)).toBe(false);
            expect(FarkleAI.aiShouldContinue(2, 200, 1000, 8000)).toBe(true);
        });

        it('stops immediately when current points reach winning target', () => {
            expect(FarkleAI.aiShouldContinue(3, 1000, 7500, 8000)).toBe(false);
        });
    });

    describe('aiTransmuteTarget', () => {
        it('identifies best pair to complete a 3-of-a-kind using a junk die', () => {
            // [1, 1, 2, 3, 4] -> 补全 1
            const target = FarkleAI.aiTransmuteTarget([1, 1, 2, 3, 4]);
            expect(target).not.toBeNull();
            expect(target.to).toBe(1);
            expect([2, 3, 4].includes(target.dieIdx)).toBe(true);
        });

        it('returns null if no pair can be completed or no junk dice available', () => {
            expect(FarkleAI.aiTransmuteTarget([1, 2, 3, 4, 6])).toBeNull();
        });
    });

    describe('aiShouldResurrect', () => {
        it('resurrects only when lost score is substantial (>= 250)', () => {
            expect(FarkleAI.aiShouldResurrect(300)).toBe(true);
            expect(FarkleAI.aiShouldResurrect(250)).toBe(true);
            expect(FarkleAI.aiShouldResurrect(100)).toBe(false);
            expect(FarkleAI.aiShouldResurrect(50)).toBe(false);
        });
    });
});
