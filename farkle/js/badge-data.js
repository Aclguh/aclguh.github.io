/**
 * 天国骰子 - 徽章系统元数据与工厂模块
 * 还原《天国：拯救2》酒馆骰子徽章机制
 */

const TIER_CN = { tin: '锡', silver: '银', gold: '金' };
const TIER_RANK = { tin: 1, silver: 2, gold: 3 };

const BADGES = [
    // ── 锡制 ──
    {
        id: 'tin-defence',
        tier: 'tin',
        type: 'defence',
        name: '锡制防御徽章',
        short: '防御',
        desc: '抵消对手锡制徽章的效果。'
    },
    {
        id: 'tin-headstart',
        tier: 'tin',
        type: 'headstart',
        amount: 100,
        name: '锡制先机徽章',
        short: '先机',
        desc: '开局直接领先 100 分。'
    },
    {
        id: 'tin-might',
        tier: 'tin',
        type: 'might',
        uses: 1,
        name: '锡制力量徽章',
        short: '力量',
        desc: '本回合掷骰后加掷一颗骰子，可用 1 次。'
    },
    {
        id: 'tin-resurrect',
        tier: 'tin',
        type: 'resurrect',
        uses: 1,
        name: '锡制复活徽章',
        short: '复活',
        desc: '爆骰后再掷一次，保住本回合已累计的分数，可用 1 次。'
    },
    {
        id: 'tin-transmute',
        tier: 'tin',
        type: 'transmute',
        to: 3,
        uses: 1,
        name: '锡制点化徽章',
        short: '点化',
        desc: '把场上一颗骰子的点数变为 3，可用 1 次。'
    },
    {
        id: 'tin-warlord',
        tier: 'tin',
        type: 'warlord',
        mult: 1.25,
        uses: 1,
        name: '锡制军阀徽章',
        short: '军阀',
        desc: '本回合记分时分数 ×1.25，可用 1 次。'
    },
    {
        id: 'tin-fortune',
        tier: 'tin',
        type: 'reroll',
        dice: 1,
        uses: 1,
        name: '锡制好运徽章',
        short: '好运',
        desc: '重掷 1 颗未收起的骰子，可用 1 次。'
    },
    {
        id: 'tin-doppel',
        tier: 'tin',
        type: 'doppel',
        uses: 1,
        name: '锡制分身徽章',
        short: '分身',
        desc: '上一次掷骰所得的分数再翻倍，可用 1 次。'
    },
    {
        id: 'tin-cut',
        tier: 'tin',
        type: 'formation',
        formation: 'cut',
        value: 75,
        name: '木匠的优势徽章',
        short: '切口',
        desc: '新增组合「切口」：3＋5 计 75 分，整局反复生效。'
    },
    // ── 银制 ──
    {
        id: 'silver-defence',
        tier: 'silver',
        type: 'defence',
        name: '银制防御徽章',
        short: '防御',
        desc: '抵消对手银制及以下徽章的效果。'
    },
    {
        id: 'silver-headstart',
        tier: 'silver',
        type: 'headstart',
        amount: 250,
        name: '银制先机徽章',
        short: '先机',
        desc: '开局直接领先 250 分。'
    },
    {
        id: 'silver-might',
        tier: 'silver',
        type: 'might',
        uses: 2,
        name: '银制力量徽章',
        short: '力量',
        desc: '本回合掷骰后加掷一颗骰子，可用 2 次。'
    },
    {
        id: 'silver-king',
        tier: 'silver',
        type: 'might',
        uses: 2,
        name: '银制国王徽章',
        short: '国王',
        desc: '与力量徽章相同：加掷一颗骰子，可用 2 次。'
    },
    {
        id: 'silver-resurrect',
        tier: 'silver',
        type: 'resurrect',
        uses: 2,
        name: '银制复活徽章',
        short: '复活',
        desc: '爆骰后再掷一次，保住本回合已累计的分数，可用 2 次。'
    },
    {
        id: 'silver-transmute',
        tier: 'silver',
        type: 'transmute',
        to: 5,
        uses: 1,
        name: '银制点化徽章',
        short: '点化',
        desc: '把场上一颗骰子的点数变为 5，可用 1 次。'
    },
    {
        id: 'silver-warlord',
        tier: 'silver',
        type: 'warlord',
        mult: 1.5,
        uses: 1,
        name: '银制军阀徽章',
        short: '军阀',
        desc: '本回合记分时分数 ×1.5，可用 1 次。'
    },
    {
        id: 'silver-fortune',
        tier: 'silver',
        type: 'reroll',
        dice: 2,
        uses: 1,
        name: '银制好运徽章',
        short: '好运',
        desc: '重掷最多 2 颗未收起的骰子，可用 1 次。'
    },
    {
        id: 'silver-exchange',
        tier: 'silver',
        type: 'reroll',
        dice: 1,
        uses: 1,
        name: '银制交换徽章',
        short: '交换',
        desc: '重掷 1 颗你指定的骰子，可用 1 次。'
    },
    {
        id: 'silver-doppel',
        tier: 'silver',
        type: 'doppel',
        uses: 2,
        name: '银制分身徽章',
        short: '分身',
        desc: '上一次掷骰所得的分数再翻倍，可用 2 次。'
    },
    {
        id: 'silver-gallows',
        tier: 'silver',
        type: 'formation',
        formation: 'gallows',
        value: 150,
        name: '刽子手的优势徽章',
        short: '绞架',
        desc: '新增组合「绞架」：4＋5＋6 计 150 分，整局反复生效。'
    },
    // ── 黄金 ──
    {
        id: 'gold-defence',
        tier: 'gold',
        type: 'defence',
        name: '黄金防御徽章',
        short: '防御',
        desc: '抵消对手黄金及以下徽章的效果。'
    },
    {
        id: 'gold-headstart',
        tier: 'gold',
        type: 'headstart',
        amount: 500,
        name: '黄金先机徽章',
        short: '先机',
        desc: '开局直接领先 500 分。'
    },
    {
        id: 'gold-might',
        tier: 'gold',
        type: 'might',
        uses: 3,
        name: '黄金力量徽章',
        short: '力量',
        desc: '本回合掷骰后加掷一颗骰子，可用 3 次。'
    },
    {
        id: 'gold-resurrect',
        tier: 'gold',
        type: 'resurrect',
        uses: 3,
        name: '黄金复活徽章',
        short: '复活',
        desc: '爆骰后再掷一次，保住本回合已累计的分数，可用 3 次。'
    },
    {
        id: 'gold-transmute',
        tier: 'gold',
        type: 'transmute',
        to: 1,
        uses: 1,
        name: '黄金点化徽章',
        short: '点化',
        desc: '把场上一颗骰子的点数变为 1，可用 1 次。'
    },
    {
        id: 'gold-warlord',
        tier: 'gold',
        type: 'warlord',
        mult: 2,
        uses: 1,
        name: '黄金军阀徽章',
        short: '军阀',
        desc: '本回合记分时分数 ×2，可用 1 次。'
    },
    {
        id: 'gold-fortune',
        tier: 'gold',
        type: 'reroll',
        dice: 3,
        uses: 1,
        name: '黄金好运徽章',
        short: '好运',
        desc: '重掷最多 3 颗未收起的骰子，可用 1 次。'
    },
    {
        id: 'gold-exchange',
        tier: 'gold',
        type: 'reroll',
        dice: 2,
        sameValue: true,
        uses: 1,
        name: '黄金交换徽章',
        short: '交换',
        desc: '重掷 2 颗点数相同的骰子，可用 1 次。'
    },
    {
        id: 'gold-wedding',
        tier: 'gold',
        type: 'reroll',
        dice: 3,
        uses: 1,
        name: '黄金婚礼徽章',
        short: '婚礼',
        desc: '重掷最多 3 颗未收起的骰子，可用 1 次。'
    },
    {
        id: 'gold-doppel',
        tier: 'gold',
        type: 'doppel',
        uses: 3,
        name: '黄金分身徽章',
        short: '分身',
        desc: '上一次掷骰所得的分数再翻倍，可用 3 次。'
    },
    {
        id: 'gold-emperor',
        tier: 'gold',
        type: 'emperor',
        name: '黄金皇帝徽章',
        short: '皇帝',
        desc: '「三个 1」组合的分数 ×3（1000 → 3000），整局反复生效。'
    },
    {
        id: 'gold-eye',
        tier: 'gold',
        type: 'formation',
        formation: 'eye',
        value: 250,
        name: '牧师的优势徽章',
        short: '天眼',
        desc: '新增组合「天眼」：1＋3＋5 计 250 分，整局反复生效。'
    }
];

function makeBadge(id) {
    const def = BADGES.find((b) => b.id === id);
    if (!def) return null;
    return { ...def, uses: def.uses || 0, cancelled: false };
}

// 目标分 → 玩家与对手可用的徽章阶位（对手在同池内随机）
const TARGET_TIERS = {
    3000: ['tin'],
    5000: ['tin', 'silver'],
    8000: ['tin', 'silver', 'gold']
};

const TIER_WEIGHT = { tin: 0.42, silver: 0.33, gold: 0.25 };

function randomAiBadge(allowedTiers) {
    const tiers = allowedTiers && allowedTiers.length ? allowedTiers : TARGET_TIERS[8000];
    const total = tiers.reduce((s, t) => s + TIER_WEIGHT[t], 0);
    let r = Math.random() * total;
    let tier = tiers[tiers.length - 1];
    for (const t of tiers) {
        if (r < TIER_WEIGHT[t]) {
            tier = t;
            break;
        }
        r -= TIER_WEIGHT[t];
    }
    const pool = BADGES.filter((b) => b.tier === tier);
    return makeBadge(pool[Math.floor(Math.random() * pool.length)].id);
}

const FarkleBadges = {
    TIER_CN,
    TIER_RANK,
    BADGES,
    TARGET_TIERS,
    TIER_WEIGHT,
    makeBadge,
    randomAiBadge
};

if (typeof window !== 'undefined') {
    window.FarkleBadges = FarkleBadges;
    // 兼容既有全局变量
    window.TIER_CN = TIER_CN;
    window.TIER_RANK = TIER_RANK;
    window.BADGES = BADGES;
    window.TARGET_TIERS = TARGET_TIERS;
    window.TIER_WEIGHT = TIER_WEIGHT;
    window.makeBadge = makeBadge;
    window.randomAiBadge = randomAiBadge;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FarkleBadges;
}
