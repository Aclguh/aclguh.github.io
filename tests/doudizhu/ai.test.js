const { describe, it, expect } = require('../test-utils.js');
const Cards = require('../../doudizhu/js/cards.js');

// 注入 doudizhu 全局变量以支持 ai.js 纯函数运行
Object.assign(global, Cards);

const DouDiZhuAI = require('../../doudizhu/js/ai.js');

describe('DouDiZhu AI Module', () => {
    it('determines farmer teammates accurately', () => {
        const landlord = 0;
        expect(DouDiZhuAI.isTeammate(1, 2, landlord)).toBe(true);
        expect(DouDiZhuAI.isTeammate(2, 1, landlord)).toBe(true);
        expect(DouDiZhuAI.isTeammate(0, 1, landlord)).toBe(false);
        expect(DouDiZhuAI.isTeammate(1, 0, landlord)).toBe(false);
    });

    it('bids high (3) for strong hands and passes (0) for weak hands', () => {
        // 极强牌：双王 + 四个2 + 炸弹
        const strongHand = [
            { id: 1, rank: Cards.JOKER_B, suit: 'joker' },
            { id: 2, rank: Cards.JOKER_S, suit: 'joker' },
            { id: 3, rank: 15, suit: 's' },
            { id: 4, rank: 15, suit: 'h' },
            { id: 5, rank: 15, suit: 'c' },
            { id: 6, rank: 15, suit: 'd' }
        ];
        expect(DouDiZhuAI.aiBid(strongHand, 0)).toBe(3);

        // 弱牌：全是散牌小点数
        const weakHand = [
            { id: 1, rank: 3, suit: 's' },
            { id: 2, rank: 4, suit: 'h' },
            { id: 3, rank: 5, suit: 'c' },
            { id: 4, rank: 7, suit: 'd' }
        ];
        expect(DouDiZhuAI.aiBid(weakHand, 0)).toBe(0);

        // 如果手牌想叫 1 分，但当前已有人叫 2 分，应选择不叫 (0)
        const mediumHand = [
            { id: 1, rank: 15, suit: 's' },
            { id: 2, rank: 15, suit: 'h' },
            { id: 3, rank: 14, suit: 's' }
        ];
        expect(DouDiZhuAI.aiBid(mediumHand, 2)).toBe(0);
    });

    it('generates prioritized hints for legal beating plays', () => {
        const hand = [
            { id: 1, rank: 3, suit: 's' },
            { id: 2, rank: 8, suit: 'h' },
            { id: 3, rank: 10, suit: 'c' },
            { id: 4, rank: 14, suit: 'd' }
        ];
        // 目标：单张 7
        const target = Cards.identify([{ id: 99, rank: 7, suit: 's' }]);
        const hints = DouDiZhuAI.hintOptions(hand, target);

        expect(hints.length > 0).toBe(true);
        // 最低代价应当优先推荐出 8，而不是直接出 A (14)
        expect(hints[0].rank).toBe(8);
    });

    describe('aiDecide 首出牌策略 (pickLead)', () => {
        it('手牌可一手走完时，直接出可走完的牌型', () => {
            // 手牌为三带一（4张）
            const hand = [
                { id: 1, rank: 8, suit: 's' },
                { id: 2, rank: 8, suit: 'h' },
                { id: 3, rank: 8, suit: 'c' },
                { id: 4, rank: 3, suit: 'd' }
            ];
            const ctx = {
                seat: 0,
                landlord: 0,
                counts: [4, 10, 10],
                target: null,
                targetSeat: -1,
                level: 'hard'
            };
            const play = DouDiZhuAI.aiDecide(hand, ctx);
            expect(play).not.toBeNull();
            expect(play.cards.length).toBe(4);
            expect(play.type).toBe('triple_single');
        });

        it('仅剩两张散牌时，先出大单张留下小单张', () => {
            const hand = [
                { id: 1, rank: 5, suit: 's' },
                { id: 2, rank: 14, suit: 'h' } // A
            ];
            const ctx = {
                seat: 1,
                landlord: 0,
                counts: [10, 2, 10],
                target: null,
                targetSeat: -1,
                level: 'hard'
            };
            const play = DouDiZhuAI.aiDecide(hand, ctx);
            expect(play).not.toBeNull();
            expect(play.type).toBe('single');
            expect(play.rank).toBe(14);
        });

        it('常规首出牌优先出小散牌，保留高价值牌', () => {
            const hand = [
                { id: 1, rank: 3, suit: 's' },
                { id: 2, rank: 4, suit: 'h' },
                { id: 3, rank: 15, suit: 'c' }, // 2
                { id: 4, rank: Cards.JOKER_B, suit: 'joker' }
            ];
            const ctx = {
                seat: 0,
                landlord: 0,
                counts: [4, 17, 17],
                target: null,
                targetSeat: -1,
                level: 'hard'
            };
            const play = DouDiZhuAI.aiDecide(hand, ctx);
            expect(play).not.toBeNull();
            // 不应起手直接出大王或2
            expect(play.rank).toBeGreaterThan(2);
            expect(play.rank < 15).toBe(true);
        });
    });

    describe('aiDecide 跟牌压牌策略 (pickBeat)', () => {
        it('跟队友大牌时选择不出（过牌）', () => {
            // 农民 seat=2，地主 seat=0，上家队友 seat=1 出了一张大牌（大王）
            const hand = [
                { id: 1, rank: 4, suit: 's' },
                { id: 2, rank: 15, suit: 's' } // 2
            ];
            const bigTarget = Cards.identify([{ id: 99, rank: Cards.JOKER_B, suit: 'joker' }]);
            const ctx = {
                seat: 2,
                landlord: 0,
                counts: [10, 8, 2],
                target: bigTarget,
                targetSeat: 1, // 队友出的大牌
                level: 'hard'
            };
            const play = DouDiZhuAI.aiDecide(hand, ctx);
            expect(play).toBeNull(); // 队友已出大王，理智不出
        });

        it('对手出小单张且有合适牌时，跟牌压制', () => {
            // 地主出单张 5
            const hand = [
                { id: 1, rank: 4, suit: 's' },
                { id: 2, rank: 7, suit: 'h' },
                { id: 3, rank: 10, suit: 'c' }
            ];
            const target = Cards.identify([{ id: 99, rank: 5, suit: 's' }]);
            const ctx = {
                seat: 1,
                landlord: 0,
                counts: [10, 3, 10],
                target: target,
                targetSeat: 0, // 地主出的牌
                level: 'hard'
            };
            const play = DouDiZhuAI.aiDecide(hand, ctx);
            expect(play).not.toBeNull();
            expect(play.rank).toBe(7); // 出最小能够压制的牌（7）
        });

        it('对手只剩 1 张牌时触发紧迫模式 (urgent)，优先出大牌压制', () => {
            // 地主只剩 1 张牌，出了单张 6
            const hand = [
                { id: 1, rank: 8, suit: 's' },
                { id: 2, rank: 15, suit: 'h' } // 2
            ];
            const target = Cards.identify([{ id: 99, rank: 6, suit: 's' }]);
            const ctx = {
                seat: 1,
                landlord: 0,
                counts: [1, 2, 10], // 地主剩余 1 张牌！
                target: target,
                targetSeat: 0,
                level: 'hard'
            };
            const play = DouDiZhuAI.aiDecide(hand, ctx);
            expect(play).not.toBeNull();
            expect(play.rank).toBe(15); // 紧迫状态下果断用 2 顶死
        });

        it('没有任何牌能压制时返回 null', () => {
            const hand = [
                { id: 1, rank: 3, suit: 's' },
                { id: 2, rank: 4, suit: 'h' }
            ];
            const target = Cards.identify([{ id: 99, rank: 14, suit: 's' }]); // A
            const ctx = {
                seat: 1,
                landlord: 0,
                counts: [5, 2, 5],
                target: target,
                targetSeat: 0,
                level: 'hard'
            };
            const play = DouDiZhuAI.aiDecide(hand, ctx);
            expect(play).toBeNull();
        });
    });
});
