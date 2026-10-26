const { describe, it, expect } = require('../test-utils.js');
const {
    buildDeck,
    sortCards,
    identify,
    beats,
    findBeatingCombos,
    shuffle,
    JOKER_S,
    JOKER_B
} = require('../../doudizhu/js/cards.js');

describe('DouDiZhu Cards Engine', () => {
    it('builds a standard 54-card deck', () => {
        const deck = buildDeck();
        expect(deck.length).toBe(54);
        expect(deck.some((c) => c.rank === JOKER_S)).toBe(true);
        expect(deck.some((c) => c.rank === JOKER_B)).toBe(true);
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

            const pair = [
                { rank: 8, suit: '♠' },
                { rank: 8, suit: '♥' }
            ];
            const rPair = identify(pair);
            expect(rPair.type).toBe('pair');
            expect(rPair.rank).toBe(8);

            const triple = [
                { rank: 9, suit: '♠' },
                { rank: 9, suit: '♥' },
                { rank: 9, suit: '♦' }
            ];
            const rTriple = identify(triple);
            expect(rTriple.type).toBe('triple');
            expect(rTriple.rank).toBe(9);
        });

        it('identifies triple with wings', () => {
            const tSingle = [
                { rank: 9, suit: '♠' },
                { rank: 9, suit: '♥' },
                { rank: 9, suit: '♦' },
                { rank: 3, suit: '♣' }
            ];
            const rTSingle = identify(tSingle);
            expect(rTSingle.type).toBe('triple_single');
            expect(rTSingle.rank).toBe(9);

            const tPair = [
                { rank: 9, suit: '♠' },
                { rank: 9, suit: '♥' },
                { rank: 9, suit: '♦' },
                { rank: 4, suit: '♣' },
                { rank: 4, suit: '♦' }
            ];
            const rTPair = identify(tPair);
            expect(rTPair.type).toBe('triple_pair');
            expect(rTPair.rank).toBe(9);
        });

        it('identifies straights and pair straights', () => {
            const straight = [3, 4, 5, 6, 7].map((r) => ({ rank: r, suit: '♠' }));
            const rStraight = identify(straight);
            expect(rStraight.type).toBe('straight');
            expect(rStraight.rank).toBe(3);
            expect(rStraight.length).toBe(5);

            const pairStraight = [
                { rank: 3, suit: '♠' },
                { rank: 3, suit: '♥' },
                { rank: 4, suit: '♠' },
                { rank: 4, suit: '♥' },
                { rank: 5, suit: '♠' },
                { rank: 5, suit: '♥' }
            ];
            const rPairStraight = identify(pairStraight);
            expect(rPairStraight.type).toBe('pair_straight');
            expect(rPairStraight.rank).toBe(3);
            expect(rPairStraight.length).toBe(3);
        });

        it('identifies bomb and rocket', () => {
            const bomb = [
                { rank: 7, suit: '♠' },
                { rank: 7, suit: '♥' },
                { rank: 7, suit: '♣' },
                { rank: 7, suit: '♦' }
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

        it('identifies four with two singles or pairs', () => {
            const fourTwoSingles = [
                { rank: 8, suit: '♠' },
                { rank: 8, suit: '♥' },
                { rank: 8, suit: '♦' },
                { rank: 8, suit: '♣' },
                { rank: 3, suit: '♠' },
                { rank: 5, suit: '♥' }
            ];
            const r1 = identify(fourTwoSingles);
            expect(r1.type).toBe('four_two_single');
            expect(r1.rank).toBe(8);

            const fourTwoPairs = [
                { rank: 9, suit: '♠' },
                { rank: 9, suit: '♥' },
                { rank: 9, suit: '♦' },
                { rank: 9, suit: '♣' },
                { rank: 4, suit: '♠' },
                { rank: 4, suit: '♥' },
                { rank: 6, suit: '♠' },
                { rank: 6, suit: '♥' }
            ];
            const r2 = identify(fourTwoPairs);
            expect(r2.type).toBe('four_two_pair');
            expect(r2.rank).toBe(9);
        });

        it('identifies airplanes (continuous triples)', () => {
            const planeNoWings = [
                { rank: 5, suit: '♠' },
                { rank: 5, suit: '♥' },
                { rank: 5, suit: '♦' },
                { rank: 6, suit: '♠' },
                { rank: 6, suit: '♥' },
                { rank: 6, suit: '♦' }
            ];
            const r = identify(planeNoWings);
            expect(r.type).toBe('plane');
            expect(r.rank).toBe(5);
            expect(r.length).toBe(2);
        });

        it('returns null for invalid card combinations', () => {
            const invalid = [
                { rank: 3, suit: '♠' },
                { rank: 5, suit: '♥' }
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
            expect(beating.every((c) => c.type === 'single' && c.rank > 7)).toBe(true);
        });

        it('findBeatingCombos handles pair, triple with wings, and bombs', () => {
            const hand = [
                { id: 1, rank: 8, suit: '♠' },
                { id: 2, rank: 8, suit: '♥' },
                { id: 3, rank: 10, suit: '♠' },
                { id: 4, rank: 10, suit: '♥' },
                { id: 5, rank: 10, suit: '♦' },
                { id: 6, rank: 5, suit: '♣' },
                // 炸弹 7777
                { id: 7, rank: 7, suit: '♠' },
                { id: 8, rank: 7, suit: '♥' },
                { id: 9, rank: 7, suit: '♦' },
                { id: 10, rank: 7, suit: '♣' },
                // 王炸
                { id: 11, rank: JOKER_S, suit: '★' },
                { id: 12, rank: JOKER_B, suit: '★' }
            ];

            // 压对 6
            const targetPair = { type: 'pair', rank: 6, length: 1 };
            const beatPair = findBeatingCombos(hand, targetPair);
            expect(beatPair.some((c) => c.type === 'pair' && c.rank === 8)).toBe(true);
            expect(beatPair.some((c) => c.type === 'bomb')).toBe(true);
            expect(beatPair.some((c) => c.type === 'rocket')).toBe(true);

            // 压三带一 999+x
            const targetTriple = { type: 'triple_single', rank: 9, length: 1 };
            const beatTriple = findBeatingCombos(hand, targetTriple);
            expect(beatTriple.some((c) => c.type === 'triple_single' && c.rank === 10)).toBe(true);

            // 压炸弹 5555
            const targetBomb = { type: 'bomb', rank: 5, length: 1 };
            const beatBomb = findBeatingCombos(hand, targetBomb);
            expect(beatBomb.some((c) => c.type === 'bomb' && c.rank === 7)).toBe(true);
            expect(beatBomb.some((c) => c.type === 'rocket')).toBe(true);
        });

        it('findBeatingCombos handles straight and pair_straight', () => {
            const hand = [
                { id: 1, rank: 4, suit: '♠' },
                { id: 2, rank: 5, suit: '♠' },
                { id: 3, rank: 6, suit: '♠' },
                { id: 4, rank: 7, suit: '♠' },
                { id: 5, rank: 8, suit: '♠' },
                { id: 6, rank: 9, suit: '♠' },
                { id: 7, rank: 4, suit: '♥' },
                { id: 8, rank: 5, suit: '♥' },
                { id: 9, rank: 6, suit: '♥' }
            ];

            const targetStraight = { type: 'straight', rank: 3, length: 5 };
            const beatStraight = findBeatingCombos(hand, targetStraight);
            expect(beatStraight.some((c) => c.type === 'straight' && c.rank === 4)).toBe(true);

            const targetPairStraight = { type: 'pair_straight', rank: 3, length: 3 };
            const beatPairStraight = findBeatingCombos(hand, targetPairStraight);
            expect(beatPairStraight.some((c) => c.type === 'pair_straight' && c.rank === 4)).toBe(true);
        });

        it('findBeatingCombos handles airplanes and four-with-two', () => {
            const hand = [
                // 3个6，3个7
                { id: 1, rank: 6, suit: '♠' },
                { id: 2, rank: 6, suit: '♥' },
                { id: 3, rank: 6, suit: '♦' },
                { id: 4, rank: 7, suit: '♠' },
                { id: 5, rank: 7, suit: '♥' },
                { id: 6, rank: 7, suit: '♦' },
                // 散牌
                { id: 7, rank: 3, suit: '♠' },
                { id: 8, rank: 4, suit: '♥' },
                // 4个9
                { id: 9, rank: 9, suit: '♠' },
                { id: 10, rank: 9, suit: '♥' },
                { id: 11, rank: 9, suit: '♦' },
                { id: 12, rank: 9, suit: '♣' }
            ];

            // 压飞机（不带翅膀）
            const targetPlane = { type: 'plane', rank: 4, length: 2 };
            const beatPlane = findBeatingCombos(hand, targetPlane);
            expect(beatPlane.some((c) => c.type === 'plane' && c.rank === 6)).toBe(true);

            // 压飞机带单牌
            const targetPlaneSingle = { type: 'plane_single', rank: 4, length: 2 };
            const beatPlaneSingle = findBeatingCombos(hand, targetPlaneSingle);
            expect(beatPlaneSingle.some((c) => c.type === 'plane_single' && c.rank === 6)).toBe(true);

            // 压四带二单
            const targetFourTwo = { type: 'four_two_single', rank: 8, length: 1 };
            const beatFourTwo = findBeatingCombos(hand, targetFourTwo);
            expect(beatFourTwo.some((c) => c.type === 'four_two_single' && c.rank === 9)).toBe(true);
        });

        it('shuffle maintains deck integrity and card count', () => {
            const deck = buildDeck();
            const shuffled = shuffle(deck);
            expect(shuffled.length).toBe(deck.length);
            expect(new Set(shuffled.map((c) => c.id)).size).toBe(deck.length);
        });
    });
});
