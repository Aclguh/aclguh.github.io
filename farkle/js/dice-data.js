'use strict';
/**
 * 天国骰子（Farkle）全量骰子数据字典与概率系统
 * 数据来源：Aclguh/kcd2-farkle-rule 及 inara.cz 解包概率数据
 */

const DICE_LIST = [
    // ── 默认与公平骰 ──
    {
        id: 'ordinary',
        name: '普通骰',
        enName: 'Ordinary Die',
        category: 'fair',
        tag: '默认·公平',
        desc: '标准的公平骰子，每个面的投出概率完全相等（各约 16.7%）。',
        weights: [1, 1, 1, 1, 1, 1],
    },
    {
        id: 'hugo',
        name: '雨果的骰子',
        enName: "Hugo's Die",
        category: 'fair',
        tag: '公平骰',
        desc: '雨果遗留的骰子，做工工整，各面概率完全均等（各约 16.7%）。',
        weights: [1, 1, 1, 1, 1, 1],
    },
    {
        id: 'molar',
        name: '臼齿骰',
        enName: 'Molar Die',
        category: 'fair',
        tag: '牙齿系列',
        desc: '以动物臼齿磨制而成的骰子，各面概率均衡（各约 16.7%）。',
        weights: [1, 1, 1, 1, 1, 1],
    },
    {
        id: 'premolar',
        name: '前臼齿骰',
        enName: 'Premolar Die',
        category: 'fair',
        tag: '牙齿系列',
        desc: '以前臼齿雕琢的小巧骰子，各面概率均衡（各约 16.7%）。',
        weights: [1, 1, 1, 1, 1, 1],
    },
    {
        id: 'wisdom-tooth',
        name: '智齿骰',
        enName: 'Wisdom Tooth Die',
        category: 'fair',
        tag: '牙齿系列',
        desc: '以质地坚硬的智齿雕制，各面概率均衡（各约 16.7%）。',
        weights: [1, 1, 1, 1, 1, 1],
    },
    {
        id: 'st-stephen',
        name: '圣斯德望骰',
        enName: "St. Stephen's Die",
        category: 'fair',
        tag: '公平骰',
        desc: '以首位殉道者圣斯德望命名的圣洁骰子，六面概率公平（各约 16.7%）。',
        weights: [1, 1, 1, 1, 1, 1],
    },

    // ── 特殊功能骰 ──
    {
        id: 'devils-head',
        name: '魔鬼头骰',
        enName: "Devil's Head Die",
        category: 'special',
        tag: '万能鬼牌',
        special: 'joker',
        desc: '万能鬼牌（Joker）：点数 1 替换为魔鬼头面，可当作任意点数用于计分组合（概率均等，各约 16.7%）。',
        weights: [1, 1, 1, 1, 1, 1],
    },
    {
        id: 'balatro',
        name: '巴拉特罗骰',
        enName: "Balatro's Die",
        category: 'special',
        tag: '小丑鬼牌',
        special: 'joker',
        desc: '带小丑（Joker）面的联动特殊骰，各面概率均等（各约 16.7%），掷出小丑面可百搭组合。',
        weights: [1, 1, 1, 1, 1, 1],
    },

    // ── 加权偏重骰（按特点分类） ──
    {
        id: 'weighted',
        name: '灌铅骰',
        enName: 'Weighted Die',
        category: 'weighted',
        tag: '极度偏重1',
        desc: '灌了重铅的作弊骰：点数 1 的概率高达 66.7%！极易凑出三同 1 或单 1 得分。',
        weights: [10, 1, 1, 1, 1, 1],
    },
    {
        id: 'grozav',
        name: '格罗扎夫的好运骰',
        enName: "Grozav's Lucky Die",
        category: 'weighted',
        tag: '极度偏重2',
        desc: '赌徒格罗扎夫的招牌骰：点数 2 的概率高达 66.7%，配合多颗可瞬间凑齐多同 2。',
        weights: [1, 10, 1, 1, 1, 1],
    },
    {
        id: 'monk',
        name: '和尚骰',
        enName: "Monk's Die",
        category: 'weighted',
        tag: '偏重 1 与 2',
        desc: '修道院修士喜爱的骰子，点数 1 与 2 各占 40%，极度稳定产出小点数。',
        weights: [8, 8, 1, 1, 1, 1],
    },
    {
        id: 'pie',
        name: '馅饼骰',
        enName: 'Pie Die',
        category: 'weighted',
        tag: '无5与6',
        desc: '点数 1 占 46.2%，点数 3 与 4 各占 23.1%，永远不会掷出 5 与 6。',
        weights: [6, 1, 3, 3, 0, 0],
    },
    {
        id: 'favourable',
        name: '有利骰',
        enName: 'Favourable Die',
        category: 'weighted',
        tag: '极品得分骰',
        desc: '强力计分骰：点数 1 与 5 各占 33.3%，点数 6 占 22.2%，绝不会掷出 2。',
        weights: [6, 0, 1, 1, 6, 4],
    },
    {
        id: 'lucky',
        name: '好运骰',
        enName: 'Lucky Die',
        category: 'weighted',
        tag: '偏重 1/5/6',
        desc: '点数 1 与 6 各占 27.3%，点数 5 占 18.2%，综合得分率与顺子配合俱佳。',
        weights: [6, 1, 2, 3, 4, 6],
    },
    {
        id: 'heavenly',
        name: '天国骰',
        enName: 'Heavenly Kingdom Die',
        category: 'weighted',
        tag: '偏重 1 与 6',
        desc: '点数 1 占 36.8%，点数 6 占 21.1%，两头偏重，极富进攻性。',
        weights: [7, 2, 2, 2, 2, 4],
    },
    {
        id: 'mother-of-pearl',
        name: '珠母骰',
        enName: 'Mother-of-Pearl Die',
        category: 'weighted',
        tag: '得分三角',
        desc: '点数 1、5、6 各占 25%，极利于单点保底与触发全收热骰。',
        weights: [3, 1, 1, 1, 3, 3],
    },
    {
        id: 'painted',
        name: '绘彩骰',
        enName: 'Painted Die',
        category: 'weighted',
        tag: '偏重点数5',
        desc: '绘有鲜艳花纹的骰子：点数 5 概率高达 40%，点数 1 与 6 各占 20%。',
        weights: [3, 1, 1, 1, 6, 3],
    },
    {
        id: 'aranka',
        name: '阿兰卡骰',
        enName: "Aranka's Die",
        category: 'weighted',
        tag: '纯奇数偏重',
        desc: '纯奇数骰：点数 1、3、5 各占 28.6%，极适合凑奇数组合或天眼徽章。',
        weights: [6, 1, 6, 1, 6, 1],
    },
    {
        id: 'odd',
        name: '奇骰',
        enName: 'Odd Die',
        category: 'weighted',
        tag: '单数偏重',
        desc: '奇数偏重大师：点数 1、3、5 各占 26.7%，偶数仅各占 6.7%，自带计分优势。',
        weights: [4, 1, 4, 1, 4, 1],
    },
    {
        id: 'even',
        name: '偶骰',
        enName: 'Even Die',
        category: 'weighted',
        tag: '双数偏重',
        desc: '偶数偏重：点数 2、4、6 各占 26.7%，奇数仅各占 6.7%，利于凑多同偶数。',
        weights: [1, 4, 1, 4, 1, 4],
    },
    {
        id: 'holy-trinity',
        name: '三位一体骰',
        enName: 'Holy Trinity Die',
        category: 'weighted',
        tag: '偏重点数3',
        desc: '偏重点数 3（36.8%）与点数 2（26.3%）、点数 1（21.1%），小点高聚拢。',
        weights: [4, 5, 7, 1, 1, 1],
    },
    {
        id: 'trinity',
        name: '三一骰',
        enName: 'Trinity Die',
        category: 'weighted',
        tag: '偏重点数3',
        desc: '偏重点数 3（36.4%），其次为点数 1 与 5（各 18.2%）。',
        weights: [2, 1, 4, 1, 2, 1],
    },
    {
        id: 'antiochus',
        name: '圣安提阿骰',
        enName: "Saint Antiochus' Die",
        category: 'weighted',
        tag: '偏重点数3',
        desc: '受圣安提阿庇佑的骰子：点数 3 概率高达 40%，点数 1 与 6 各占 20%。',
        weights: [3, 1, 6, 1, 1, 3],
    },
    {
        id: 'wagoner',
        name: '车夫骰',
        enName: "Wagoner's Die",
        category: 'weighted',
        tag: '偏重 2 与 3',
        desc: '波西米亚车夫的爱用骰：点数 3 占 33.3%，点数 2 占 27.8%。',
        weights: [1, 5, 6, 2, 2, 2],
    },
    {
        id: 'tengri',
        name: '腾格里骰',
        enName: "Tengri's Die",
        category: 'weighted',
        tag: '东方偏重1',
        desc: '来自库曼营地的长生天骰子，点数 1 占 28.6%，其余各点数平分 14.3%。',
        weights: [2, 1, 1, 1, 1, 1],
    },
    {
        id: 'ci',
        name: '奇骰',
        enName: 'Ci Die',
        category: 'weighted',
        tag: '偏重点数6',
        desc: '恶魔路西法三连骰之「奇（Ci）」，点数 6 占 28.6%，其余各点数占 14.3%。',
        weights: [1, 1, 1, 1, 1, 2],
    },
    {
        id: 'fer',
        name: '费骰',
        enName: 'Fer Die',
        category: 'weighted',
        tag: '偏重点数6',
        desc: '恶魔路西法三连骰之「费（Fer）」，点数 6 占 28.6%，其余各点数占 14.3%。',
        weights: [1, 1, 1, 1, 1, 2],
    },
    {
        id: 'lu',
        name: '卢骰',
        enName: 'Lu Die',
        category: 'weighted',
        tag: '偏重点数6',
        desc: '恶魔路西法三连骰之「卢（Lu）」，点数 6 占 28.6%，其余各点数占 14.3%。',
        weights: [1, 1, 1, 1, 1, 2],
    },
    {
        id: 'shrinking',
        name: '收缩骰',
        enName: 'Shrinking Die',
        category: 'weighted',
        tag: '偏重 6 与 1',
        desc: '点数 6 占 33.3%，点数 1 占 22.2%，两头偏重。',
        weights: [2, 1, 1, 1, 1, 3],
    },
    {
        id: 'lousy-gambler',
        name: '邪恶赌徒骰',
        enName: "Lousy Gambler's Die",
        category: 'weighted',
        tag: '偏重点数5',
        desc: '赌场劣徒常用的骰子，点数 5 占 35%，点数 2、4、6 各占 15%。',
        weights: [2, 3, 2, 3, 7, 3],
    },
    {
        id: 'grimy',
        name: '肮脏骰',
        enName: 'Grimy Die',
        category: 'weighted',
        tag: '偏重 5 与 2',
        desc: '布满污渍的骰子，点数 5 占 43.8%，点数 2 占 31.3%。',
        weights: [1, 5, 1, 1, 7, 1],
    },
    {
        id: 'greasy',
        name: '油腻骰',
        enName: 'Greasy Die',
        category: 'weighted',
        tag: '偏重 6 与奇数',
        desc: '油腻发亮的骰子，偏重点数 6（23.5%）与奇数点 1、3、5（各 17.7%）。',
        weights: [3, 2, 3, 2, 3, 4],
    },
    {
        id: 'sad-greaser',
        name: '悲伤油仔骰',
        enName: "Sad Greaser's Die",
        category: 'weighted',
        tag: '偏重 1/2/5',
        desc: '点数 1、2、5 各占 26.1%，点数 6 占 13.0%，极少出 3 和 4。',
        weights: [6, 6, 1, 1, 6, 3],
    },
    {
        id: 'mathematician',
        name: '数学家的骰',
        enName: "Mathematician's Die",
        category: 'weighted',
        tag: '阶梯递增',
        desc: '点数 4(29.2%)、3(25%)、2(20.8%)、1(16.7%) 顺向递增，5 与 6 仅各 4.2%。',
        weights: [4, 5, 6, 7, 1, 1],
    },
    {
        id: 'king-die',
        name: '国王的骰',
        enName: "King's Die",
        category: 'weighted',
        tag: '偏重 4 与 3',
        desc: '王室贵族棋骰：偏重 4(25%)、3(21.9%)、2(18.8%)、1(12.5%)。',
        weights: [4, 6, 7, 8, 4, 3],
    },
    {
        id: 'cautious-cheater',
        name: '谨慎作弊者骰',
        enName: "Cautious Cheater's Die",
        category: 'weighted',
        tag: '稳健 1 与 5',
        desc: '巧妙隐蔽的作弊骰，点数 1 与 5 各占 23.8%，保底容易且不易起疑。',
        weights: [5, 3, 2, 3, 5, 3],
    },
    {
        id: 'unbalanced',
        name: '不平衡骰',
        enName: 'Unbalanced Die',
        category: 'weighted',
        tag: '偏重 2 与 1',
        desc: '重心不稳：点数 2 占 33.3%，点数 1 占 25%，点数 5 占 16.7%。',
        weights: [3, 4, 1, 1, 2, 1],
    },
    {
        id: 'misfortune',
        name: '不幸骰',
        enName: 'Die of Misfortune',
        category: 'weighted',
        tag: '两端罕见',
        desc: '中间点数 2、3、4、5 各占 22.7%，但核心得分点 1 与 6 仅各 4.6%。',
        weights: [1, 5, 5, 5, 5, 1],
    },
    {
        id: 'unlucky',
        name: '倒霉骰',
        enName: 'Unlucky Die',
        category: 'weighted',
        tag: '偏重点数2',
        desc: '点数 2 占 27.3%，中段 3、4、5 各占 18.2%，两头 1 与 6 仅各 9.1%。',
        weights: [1, 3, 2, 2, 2, 1],
    },
    {
        id: 'painter-blue',
        name: '画家骰（蓝）',
        enName: "Painter's Die (Blue)",
        category: 'weighted',
        tag: '蓝色特制',
        color: '#2563eb',
        desc: '青金石蓝料特制骰，点数 2 占 27.3%，中段 3、4、5 各占 18.2%。',
        weights: [1, 3, 2, 2, 2, 1],
    },
    {
        id: 'painter-green',
        name: '画家骰（绿）',
        enName: "Painter's Die (Green)",
        category: 'weighted',
        tag: '绿色特制',
        color: '#16a34a',
        desc: '孔雀石绿料特制骰，点数 2 占 27.3%，中段 3、4、5 各占 18.2%。',
        weights: [1, 3, 2, 2, 2, 1],
    },
    {
        id: 'painter-red',
        name: '画家骰（红）',
        enName: "Painter's Die (Red)",
        category: 'weighted',
        tag: '红色特制',
        color: '#dc2626',
        desc: '朱砂红料特制骰，点数 2 占 27.3%，中段 3、4、5 各占 18.2%。',
        weights: [1, 3, 2, 2, 2, 1],
    },
    {
        id: 'strip',
        name: '条纹骰',
        enName: 'Strip Die',
        category: 'weighted',
        tag: '偏重 1 与 5/6',
        desc: '带横条纹的珍稀骰，点数 1 占 25%，点数 5 与 6 各占 18.8%。',
        weights: [4, 2, 2, 2, 3, 3],
    },
];

/**
 * 根据 ID 获取骰子原型定义
 */
function getDieDef(id) {
    return DICE_LIST.find(d => d.id === id) || DICE_LIST[0];
}

/**
 * 计算骰子六面的真实概率（百分比，保留 1 位小数）
 */
function calcProbs(weights) {
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map(w => Number(((w / sum) * 100).toFixed(1)));
}

/**
 * 格式化概率总表文本（用于 Tooltip / 规则弹层）
 */
function formatProbText(weights) {
    const probs = calcProbs(weights);
    return [1, 2, 3, 4, 5, 6].map(face => `${face}点: ${probs[face - 1]}%`).join(' | ');
}

/**
 * 掷骰核心算法：根据权重概率数组投掷出 1～6
 */
function rollDieWithWeights(weights) {
    if (!weights || weights.length !== 6) {
        return 1 + Math.floor(Math.random() * 6);
    }
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (let i = 0; i < 6; i++) {
        if (r < weights[i]) return i + 1;
        r -= weights[i];
    }
    return 6;
}

/**
 * 按照骰子定义投掷
 */
function rollDieDef(dieDef) {
    return rollDieWithWeights(dieDef ? dieDef.weights : null);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DICE_LIST,
        getDieDef,
        calcProbs,
        formatProbText,
        rollDieWithWeights,
        rollDieDef,
    };
}
