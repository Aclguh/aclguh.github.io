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
});
