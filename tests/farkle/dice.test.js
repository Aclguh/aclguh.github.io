const { describe, it, expect } = require('../test-utils.js');
const { DICE_LIST, getDieDef, calcProbs, rollDieWithWeights } = require('../../farkle/js/dice-data.js');
const { scoreValues, hasAnyScore } = require('../../farkle/js/scoring.js');

describe('Farkle Dice System', () => {
    it('has all 43 dice from kcd2-farkle-rule', () => {
        expect(DICE_LIST.length).toBe(43);
    });

    it('provides standard fair default die with equal probabilities', () => {
        const ordinary = getDieDef('ordinary');
        expect(ordinary).toBeDefined();
        expect(ordinary.weights).toEqual([1, 1, 1, 1, 1, 1]);
        const probs = calcProbs(ordinary.weights);
        expect(probs).toEqual([16.7, 16.7, 16.7, 16.7, 16.7, 16.7]);
    });

    it('has correct weighted probabilities for signature dice', () => {
        const weighted = getDieDef('weighted');
        expect(weighted.weights).toEqual([10, 1, 1, 1, 1, 1]);
        const wProbs = calcProbs(weighted.weights);
        expect(wProbs[0]).toBe(66.7);

        const monk = getDieDef('monk');
        expect(monk.weights).toEqual([8, 8, 1, 1, 1, 1]);
        const mProbs = calcProbs(monk.weights);
        expect(mProbs[0]).toBe(40.0);
        expect(mProbs[1]).toBe(40.0);

        const pie = getDieDef('pie');
        expect(pie.weights[4]).toBe(0);
        expect(pie.weights[5]).toBe(0);
    });

    it('supports Joker wildcard in Devils Head and Balatro dice', () => {
        // Large straight completed by Joker
        const rollWithJoker = [2, 3, 4, 5, 6, { value: 1, isJoker: true }];
        const resultStraight = scoreValues(rollWithJoker);
        expect(resultStraight.valid).toBe(true);
        expect(resultStraight.score).toBe(1500);

        // Triple 6 completed by Joker
        const rollTriple = [6, 6, { value: 1, isJoker: true }];
        const resultTriple = scoreValues(rollTriple);
        expect(resultTriple.valid).toBe(true);
        expect(resultTriple.score).toBe(600);

        // Single Joker used as 1 (100 pts)
        const singleJoker = [{ value: 1, isJoker: true }];
        expect(scoreValues(singleJoker).score).toBe(100);

        // Invalid non-scoring dice with Joker
        const invalid = [2, 4, { value: 1, isJoker: true }];
        expect(scoreValues(invalid).valid).toBe(false);

        // hasAnyScore is always true when Joker is present
        expect(hasAnyScore([2, 3, 4, { value: 1, isJoker: true }])).toBe(true);
    });

    it('rolls values between 1 and 6 according to weights', () => {
        const pie = getDieDef('pie');
        for (let i = 0; i < 50; i++) {
            const v = rollDieWithWeights(pie.weights);
            expect(v >= 1 && v <= 4).toBe(true);
            expect(v === 5 || v === 6).toBe(false);
        }
    });
});
