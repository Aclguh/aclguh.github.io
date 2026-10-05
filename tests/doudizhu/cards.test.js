const { describe, it, expect } = require('../test-utils.js');
const {
    buildDeck, sortCards,
    identify, beats, findBeatingCombos,
    JOKER_S, JOKER_B
} = require('../../doudizhu/js/cards.js');

describe('DouDiZhu Cards Engine', () => {
    it('builds a standard 54-card deck', () => {
        const deck = buildDeck();
        expect(deck.length).toBe(54);
        expect(deck.some(c => c.rank === JOKER_S)).toBe(true);
        expect(deck.some(c => c.rank === JOKER_B)).toBe(true);
    });

    it('sorts cards descending by rank', () => {
        const cards = [
            { id: 1, rank: 3, suit: '♠' },
            { id: 2, rank: 15, suit: '♥' },
            { id: 3, rank: 10, suit: '♦' }
        ];
        const sorted = sortCards(cards);
        expect(sorted[0].rank).toBe(15);
        expect(sorted[1].rank).toBe(10);
        expect(sorted[2].rank).toBe(3);
    });

    describe('identify', () => {
        it('identifies single, pair, triple', () => {
            const single = [{ rank: 5, suit: '♠' }];
            const rSingle = identify(single);
            expect(rSingle.type).toBe('single');
            expect(rSingle.rank).toBe(5);
            expect(rSingle.length).toBe(1);

            const pair = [{ rank: 8, suit: '♠' }, { rank: 8, suit: '♥' }];
            const rPair = identify(pair);
            expect(rPair.type).toBe('pair');
            expect(rPair.rank).toBe(8);

            const triple = [{ rank: 9, suit: '♠' }, { rank: 9, suit: '♥' }, { rank: 9, suit: '♦' }];
            const rTriple = identify(triple);
            expect(rTriple.type).toBe('triple');
            expect(rTriple.rank).toBe(9);
        });

        it('identifies triple with wings', () => {
            const tSingle = [
                { rank: 9, suit: '♠' }, { rank: 9, suit: '♥' }, { rank: 9, suit: '♦' },
                { rank: 3, suit: '♣' }
            ];
            const rTSingle = identify(tSingle);
            expect(rTSingle.type).toBe('triple_single');
            expect(rTSingle.rank).toBe(9);

            const tPair = [
                { rank: 9, suit: '♠' }, { rank: 9, suit: '♥' }, { rank: 9, suit: '♦' },
                { rank: 4, suit: '♣' }, { rank: 4, suit: '♦' }
            ];
            const rTPair = identify(tPair);
            expect(rTPair.type).toBe('triple_pair');
            expect(rTPair.rank).toBe(9);
        });

        it('identifies straights and pair straights', () => {
            const straight = [3, 4, 5, 6, 7].map(r => ({ rank: r, suit: '♠' }));
            const rStraight = identify(straight);
            expect(rStraight.type).toBe('straight');
            expect(rStraight.rank).toBe(3);
            expect(rStraight.length).toBe(5);

            const pairStraight = [
                { rank: 3, suit: '♠' }, { rank: 3, suit: '♥' },
                { rank: 4, suit: '♠' }, { rank: 4, suit: '♥' },
                { rank: 5, suit: '♠' }, { rank: 5, suit: '♥' }
            ];
            const rPairStraight = identify(pairStraight);
            expect(rPairStraight.type).toBe('pair_straight');
            expect(rPairStraight.rank).toBe(3);
            expect(rPairStraight.length).toBe(3);
        });

        it('identifies bomb and rocket', () => {
            const bomb = [
                { rank: 7, suit: '♠' }, { rank: 7, suit: '♥' },
                { rank: 7, suit: '♣' }, { rank: 7, suit: '♦' }
            ];
            const rBomb = identify(bomb);
            expect(rBomb.type).toBe('bomb');
            expect(rBomb.rank).toBe(7);

            const rocket = [
                { rank: JOKER_S, suit: 'X' },
                { rank: JOKER_B, suit: 'D' }
            ];
            const rRocket = identify(rocket);
            expect(rRocket.type).toBe('rocket');
        });

        it('returns null for invalid card combinations', () => {
            const invalid = [
                { rank: 3, suit: '♠' }, { rank: 5, suit: '♥' }
            ];
            expect(identify(invalid)).toBeNull();
        });
    });

    describe('beats and findBeatingCombos', () => {
        it('compares same type cards correctly', () => {
            const lowSingle = { type: 'single', rank: 5, length: 1 };
            const highSingle = { type: 'single', rank: 10, length: 1 };
            expect(beats(highSingle, lowSingle)).toBe(true);
            expect(beats(lowSingle, highSingle)).toBe(false);

            const lowPair = { type: 'pair', rank: 6, length: 1 };
            const highPair = { type: 'pair', rank: 8, length: 1 };
            expect(beats(highPair, lowPair)).toBe(true);
            expect(beats(lowPair, highPair)).toBe(false);
        });

        it('bomb beats non-bomb normal hands', () => {
            const straight = { type: 'straight', rank: 3, length: 5 };
            const bomb = { type: 'bomb', rank: 4, length: 1 };
            expect(beats(bomb, straight)).toBe(true);
            expect(beats(straight, bomb)).toBe(false);
        });

        it('rocket beats everything including higher bombs', () => {
            const highBomb = { type: 'bomb', rank: 15, length: 1 };
            const rocket = { type: 'rocket', rank: 100, length: 2 };
            expect(beats(rocket, highBomb)).toBe(true);
            expect(beats(highBomb, rocket)).toBe(false);
        });

        it('findBeatingCombos finds valid beating plays', () => {
            const hand = [
                { id: 1, rank: 6, suit: '♠' },
                { id: 2, rank: 9, suit: '♥' },
                { id: 3, rank: 14, suit: '♦' }
            ];
            const target = { type: 'single', rank: 7, length: 1 };
            const beating = findBeatingCombos(hand, target);
            expect(beating.length).toBeGreaterThan(0);
            expect(beating.every(c => c.type === 'single' && c.rank > 7)).toBe(true);
        });
    });
});
