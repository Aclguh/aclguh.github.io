'use strict';

/* ── 计分规则 ───────────────────── */

// 校验一组骰面是否全部参与计分，返回 {score, valid}
// fx：徽章赋予的附加规则 {cut:75} / {gallows:150} / {eye:250} / {emperor:true}
function scoreValues(values, fx) {
    if (values.length === 0) return { score: 0, valid: false };
    const counts = [0, 0, 0, 0, 0, 0, 0];
    values.forEach(v => counts[v]++);
    if (values.length === 6 && counts.slice(1).every(c => c === 1)) {
        return { score: 1500, valid: true };
    }
    if (values.length === 5) {
        if (counts[1] === 1 && counts[2] === 1 && counts[3] === 1 && counts[4] === 1 && counts[5] === 1) {
            return { score: 500, valid: true };
        }
        if (counts[2] === 1 && counts[3] === 1 && counts[4] === 1 && counts[5] === 1 && counts[6] === 1) {
            return { score: 750, valid: true };
        }
    }
    let score = 0;
    for (let v = 1; v <= 6; v++) {
        if (counts[v] >= 3) {
            const base = v === 1 ? (fx && fx.emperor ? 3000 : 1000) : v * 100;
            score += base * Math.pow(2, counts[v] - 3);
            counts[v] = 0;
        }
    }
    // 徽章特殊组合：三同结算后，剩余骰子继续配对（切口/绞架/天眼可重复）
    if (fx) {
        while (fx.eye && counts[1] > 0 && counts[3] > 0 && counts[5] > 0) {
            counts[1]--; counts[3]--; counts[5]--; score += fx.eye;
        }
        while (fx.gallows && counts[4] > 0 && counts[5] > 0 && counts[6] > 0) {
            counts[4]--; counts[5]--; counts[6]--; score += fx.gallows;
        }
        while (fx.cut && counts[3] > 0 && counts[5] > 0) {
            counts[3]--; counts[5]--; score += fx.cut;
        }
    }
    for (let v = 1; v <= 6; v++) {
        const c = counts[v];
        if (c > 0) {
            if (v === 1) score += c * 100;
            else if (v === 5) score += c * 50;
            else return { score: 0, valid: false };
        }
    }
    return { score, valid: score > 0 };
}

// 一次掷骰是否存在任何可计分的骰子
function hasAnyScore(values, fx) {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    values.forEach(v => counts[v]++);
    if (values.length === 6 && counts.slice(1).every(c => c === 1)) return true;
    if (values.length === 5 && counts[1] === 1 && counts[2] === 1 && counts[3] === 1 && counts[4] === 1 && counts[5] === 1) return true;
    if (values.length === 5 && counts[2] === 1 && counts[3] === 1 && counts[4] === 1 && counts[5] === 1 && counts[6] === 1) return true;
    if (counts[1] > 0 || counts[5] > 0 || counts.some(c => c >= 3)) return true;
    return !!(fx && ((fx.eye && counts[1] && counts[3] && counts[5]) ||
                     (fx.gallows && counts[4] && counts[5] && counts[6]) ||
                     (fx.cut && counts[3] && counts[5])));
}

// 把一次掷骰的可计分骰子拆成「组合」（顺子 / 三同及以上 / 徽章组合，quick）与「单颗」（1、5，slow）
function takeGroups(values, fx) {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    values.forEach(v => counts[v]++);
    if (values.length === 6 && counts.slice(1).every(c => c === 1)) {
        return [{ indices: values.map((_, i) => i), quick: true }];
    }
    if (values.length === 5) {
        if (counts[1] === 1 && counts[2] === 1 && counts[3] === 1 && counts[4] === 1 && counts[5] === 1) {
            return [{ indices: values.map((_, i) => i), quick: true }];
        }
        if (counts[2] === 1 && counts[3] === 1 && counts[4] === 1 && counts[5] === 1 && counts[6] === 1) {
            return [{ indices: values.map((_, i) => i), quick: true }];
        }
    }
    const used = values.map(() => false);
    const grabAll = v => {
        const idx = [];
        values.forEach((val, i) => { if (val === v && !used[i]) { used[i] = true; idx.push(i); } });
        return idx;
    };
    const grabOne = v => {
        const i = values.findIndex((val, j) => val === v && !used[j]);
        if (i >= 0) used[i] = true;
        return i;
    };
    const groups = [];
    for (let v = 1; v <= 6; v++) {
        if (counts[v] >= 3) {
            counts[v] = 0;
            groups.push({ indices: grabAll(v), quick: true });
        }
    }
    // 徽章特殊组合（与 scoreValues 同序：三同 → 天眼 → 绞架 → 切口 → 单张）
    if (fx) {
        const takeForm = need => {
            while (need.every(v => counts[v] > 0)) {
                need.forEach(v => counts[v]--);
                const idx = need.map(grabOne).filter(i => i >= 0);
                if (idx.length === need.length) groups.push({ indices: idx, quick: true });
            }
        };
        if (fx.eye) takeForm([1, 3, 5]);
        if (fx.gallows) takeForm([4, 5, 6]);
        if (fx.cut) takeForm([3, 5]);
    }
    values.forEach((val, i) => {
        if (!used[i] && (val === 1 || val === 5)) groups.push({ indices: [i], quick: false });
    });
    return groups;
}

// 计分来源描述：列出本次得分的组合与分值（规则与 scoreValues 一致）
function scoreDetail(values, fx) {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    values.forEach(v => counts[v]++);
    if (values.length === 6 && counts.slice(1).every(c => c === 1)) {
        return '顺子1-6 1500';
    }
    if (values.length === 5 && counts[1] === 1 && counts[2] === 1 && counts[3] === 1 && counts[4] === 1 && counts[5] === 1) {
        return '顺子1-5 500';
    }
    if (values.length === 5 && counts[2] === 1 && counts[3] === 1 && counts[4] === 1 && counts[5] === 1 && counts[6] === 1) {
        return '顺子2-6 750';
    }
    const names = { 3: '三同', 4: '四同', 5: '五同', 6: '六同' };
    const parts = [];
    for (let v = 1; v <= 6; v++) {
        if (counts[v] >= 3) {
            const emperor = v === 1 && fx && fx.emperor;
            const base = v === 1 ? (emperor ? 3000 : 1000) : v * 100;
            parts.push(`${names[counts[v]]}${v} ${base * Math.pow(2, counts[v] - 3)}${emperor ? '（皇帝）' : ''}`);
            counts[v] = 0;
        }
    }
    if (fx) {
        while (fx.eye && counts[1] > 0 && counts[3] > 0 && counts[5] > 0) {
            counts[1]--; counts[3]--; counts[5]--; parts.push(`天眼 ${fx.eye}`);
        }
        while (fx.gallows && counts[4] > 0 && counts[5] > 0 && counts[6] > 0) {
            counts[4]--; counts[5]--; counts[6]--; parts.push(`绞架 ${fx.gallows}`);
        }
        while (fx.cut && counts[3] > 0 && counts[5] > 0) {
            counts[3]--; counts[5]--; parts.push(`切口 ${fx.cut}`);
        }
    }
    for (let v = 1; v <= 6; v++) {
        const c = counts[v];
        if (c > 0 && (v === 1 || v === 5)) {
            const unit = v === 1 ? 100 : 50;
            parts.push(c === 1 ? `单${v} ${unit}` : `${v}×${c} ${unit * c}`);
        }
    }
    return parts.join(' ＋ ');
}

const rollDie = () => 1 + Math.floor(Math.random() * 6);
const delay = ms => new Promise(r => setTimeout(r, ms));

/* ── 徽章（还原《天国：拯救2》）────────
 * 开局双方各佩戴一枚；防御可抵消对方同阶及更低阶徽章。
 * 主动徽章有使用次数，被动徽章整局生效。 */
const TIER_CN = { tin: '锡', silver: '银', gold: '金' };
const TIER_RANK = { tin: 1, silver: 2, gold: 3 };
const BADGES = [
    // ── 锡制 ──
    { id: 'tin-defence', tier: 'tin', type: 'defence', name: '锡制防御徽章', short: '防御', desc: '抵消对手锡制徽章的效果。' },
    { id: 'tin-headstart', tier: 'tin', type: 'headstart', amount: 100, name: '锡制先机徽章', short: '先机', desc: '开局直接领先 100 分。' },
    { id: 'tin-might', tier: 'tin', type: 'might', uses: 1, name: '锡制力量徽章', short: '力量', desc: '本回合掷骰后加掷一颗骰子，可用 1 次。' },
    { id: 'tin-resurrect', tier: 'tin', type: 'resurrect', uses: 1, name: '锡制复活徽章', short: '复活', desc: '爆骰后再掷一次，保住本回合已累计的分数，可用 1 次。' },
    { id: 'tin-transmute', tier: 'tin', type: 'transmute', to: 3, uses: 1, name: '锡制点化徽章', short: '点化', desc: '把场上一颗骰子的点数变为 3，可用 1 次。' },
    { id: 'tin-warlord', tier: 'tin', type: 'warlord', mult: 1.25, uses: 1, name: '锡制军阀徽章', short: '军阀', desc: '本回合记分时分数 ×1.25，可用 1 次。' },
    { id: 'tin-fortune', tier: 'tin', type: 'reroll', dice: 1, uses: 1, name: '锡制好运徽章', short: '好运', desc: '重掷 1 颗未收起的骰子，可用 1 次。' },
    { id: 'tin-doppel', tier: 'tin', type: 'doppel', uses: 1, name: '锡制分身徽章', short: '分身', desc: '上一次掷骰所得的分数再翻倍，可用 1 次。' },
    { id: 'tin-cut', tier: 'tin', type: 'formation', formation: 'cut', value: 75, name: '木匠的优势徽章', short: '切口', desc: '新增组合「切口」：3＋5 计 75 分，整局反复生效。' },
    // ── 银制 ──
    { id: 'silver-defence', tier: 'silver', type: 'defence', name: '银制防御徽章', short: '防御', desc: '抵消对手银制及以下徽章的效果。' },
    { id: 'silver-headstart', tier: 'silver', type: 'headstart', amount: 250, name: '银制先机徽章', short: '先机', desc: '开局直接领先 250 分。' },
    { id: 'silver-might', tier: 'silver', type: 'might', uses: 2, name: '银制力量徽章', short: '力量', desc: '本回合掷骰后加掷一颗骰子，可用 2 次。' },
    { id: 'silver-king', tier: 'silver', type: 'might', uses: 2, name: '银制国王徽章', short: '国王', desc: '与力量徽章相同：加掷一颗骰子，可用 2 次。' },
    { id: 'silver-resurrect', tier: 'silver', type: 'resurrect', uses: 2, name: '银制复活徽章', short: '复活', desc: '爆骰后再掷一次，保住本回合已累计的分数，可用 2 次。' },
    { id: 'silver-transmute', tier: 'silver', type: 'transmute', to: 5, uses: 1, name: '银制点化徽章', short: '点化', desc: '把场上一颗骰子的点数变为 5，可用 1 次。' },
    { id: 'silver-warlord', tier: 'silver', type: 'warlord', mult: 1.5, uses: 1, name: '银制军阀徽章', short: '军阀', desc: '本回合记分时分数 ×1.5，可用 1 次。' },
    { id: 'silver-fortune', tier: 'silver', type: 'reroll', dice: 2, uses: 1, name: '银制好运徽章', short: '好运', desc: '重掷最多 2 颗未收起的骰子，可用 1 次。' },
    { id: 'silver-exchange', tier: 'silver', type: 'reroll', dice: 1, uses: 1, name: '银制交换徽章', short: '交换', desc: '重掷 1 颗你指定的骰子，可用 1 次。' },
    { id: 'silver-doppel', tier: 'silver', type: 'doppel', uses: 2, name: '银制分身徽章', short: '分身', desc: '上一次掷骰所得的分数再翻倍，可用 2 次。' },
    { id: 'silver-gallows', tier: 'silver', type: 'formation', formation: 'gallows', value: 150, name: '刽子手的优势徽章', short: '绞架', desc: '新增组合「绞架」：4＋5＋6 计 150 分，整局反复生效。' },
    // ── 黄金 ──
    { id: 'gold-defence', tier: 'gold', type: 'defence', name: '黄金防御徽章', short: '防御', desc: '抵消对手黄金及以下徽章的效果。' },
    { id: 'gold-headstart', tier: 'gold', type: 'headstart', amount: 500, name: '黄金先机徽章', short: '先机', desc: '开局直接领先 500 分。' },
    { id: 'gold-might', tier: 'gold', type: 'might', uses: 3, name: '黄金力量徽章', short: '力量', desc: '本回合掷骰后加掷一颗骰子，可用 3 次。' },
    { id: 'gold-resurrect', tier: 'gold', type: 'resurrect', uses: 3, name: '黄金复活徽章', short: '复活', desc: '爆骰后再掷一次，保住本回合已累计的分数，可用 3 次。' },
    { id: 'gold-transmute', tier: 'gold', type: 'transmute', to: 1, uses: 1, name: '黄金点化徽章', short: '点化', desc: '把场上一颗骰子的点数变为 1，可用 1 次。' },
    { id: 'gold-warlord', tier: 'gold', type: 'warlord', mult: 2, uses: 1, name: '黄金军阀徽章', short: '军阀', desc: '本回合记分时分数 ×2，可用 1 次。' },
    { id: 'gold-fortune', tier: 'gold', type: 'reroll', dice: 3, uses: 1, name: '黄金好运徽章', short: '好运', desc: '重掷最多 3 颗未收起的骰子，可用 1 次。' },
    { id: 'gold-exchange', tier: 'gold', type: 'reroll', dice: 2, sameValue: true, uses: 1, name: '黄金交换徽章', short: '交换', desc: '重掷 2 颗点数相同的骰子，可用 1 次。' },
    { id: 'gold-wedding', tier: 'gold', type: 'reroll', dice: 3, uses: 1, name: '黄金婚礼徽章', short: '婚礼', desc: '重掷最多 3 颗未收起的骰子，可用 1 次。' },
    { id: 'gold-doppel', tier: 'gold', type: 'doppel', uses: 3, name: '黄金分身徽章', short: '分身', desc: '上一次掷骰所得的分数再翻倍，可用 3 次。' },
    { id: 'gold-emperor', tier: 'gold', type: 'emperor', name: '黄金皇帝徽章', short: '皇帝', desc: '「三个 1」组合的分数 ×3（1000 → 3000），整局反复生效。' },
    { id: 'gold-eye', tier: 'gold', type: 'formation', formation: 'eye', value: 250, name: '牧师的优势徽章', short: '天眼', desc: '新增组合「天眼」：1＋3＋5 计 250 分，整局反复生效。' },
];

function makeBadge(id) {
    const def = BADGES.find(b => b.id === id);
    return { ...def, uses: def.uses || 0, cancelled: false };
}
function randomAiBadge() {
    const r = Math.random();
    const tier = r < 0.42 ? 'tin' : r < 0.75 ? 'silver' : 'gold';
    const pool = BADGES.filter(b => b.tier === tier);
    return makeBadge(pool[Math.floor(Math.random() * pool.length)].id);
}

/* ── DOM ────────────────────────── */
const $ = id => document.getElementById(id);
const els = {
    setup: $('setup-panel'), game: $('game-panel'),
    targetSeg: $('target-seg'), start: $('btn-start'),
    scoreboard: $('scoreboard'),
    scoreMe: $('score-me'), scoreAi: $('score-ai'), scoreTarget: $('score-target'),
    turnMe: $('turn-me'), turnAi: $('turn-ai'),
    selMe: $('sel-me'), selAi: $('sel-ai'),
    banner: $('table-banner'), log: $('log'),
    boardOver: $('board-over'), boardOverText: $('board-over-text'),
    boardFlash: $('board-flash'), boardFlashText: $('board-flash-text'),
    roll: $('btn-roll'), again: $('btn-again'), bank: $('btn-bank'), surrender: $('btn-surrender'),
    badge: $('btn-badge'),
    badgeStrip: $('badge-strip'), badgeChipMe: $('badge-chip-me'), badgeChipAi: $('badge-chip-ai'),
    badgeModal: $('badge-modal'), badgeList: $('badge-list'), btnBadgeNone: $('btn-badge-none'),
    rulesBadgeList: $('rules-badge-list'),
    rulesModal: $('rules-modal'), btnRules: $('btn-rules'), btnCloseRules: $('btn-close-rules'),
};

/* ── 状态 ───────────────────────── */
const state = {
    target: 2000,
    phase: 'setup', // setup | await-roll | select | busy | ai | bust-choice | pre-bank | over
    current: 'me',  // me | ai
    scores: { me: 0, ai: 0 },
    turnPoints: 0,
    nextId: 1,
    badges: { me: null, ai: null },      // 开局时各佩戴一枚（可能被防御抵消：cancelled）
    warlordArmed: { me: false, ai: false },
    lastCollect: null,                   // {who, score, doubled} 上一次掷骰收起的分数（分身徽章用）
    targeting: null,                     // 点化/重掷的选取状态
};
// 每个玩家的徽章附加计分规则（切口/绞架/天眼/皇帝）
function fxFor(who) {
    const b = state.badges[who];
    if (!b || b.cancelled) return null;
    if (b.type === 'formation') return { [b.formation]: b.value };
    if (b.type === 'emperor') return { emperor: true };
    return null;
}
// 已显示（计分浮动提示结束后才更新）
const shown = { me: 0, ai: 0 };
// 每个面板在下一次该方掷骰前清空
const pendingReset = { me: false, ai: false };

/* ── 场地几何 ───────────────────── */
const dieSize = () => (window.innerWidth <= 600 ? 46 : 56);
// 停放区宽度：需容纳一轮最多 6 颗骰子横排
const parkW = () => (window.innerWidth <= 600 ? 165 : 250);
// 停放缩放：保证 6 颗横排不超出停放区
const parkScale = () => Math.min(
    window.innerWidth <= 600 ? 0.5 : 0.6,
    (parkW() - 33) / (6 * dieSize())
);

/* ── 单个玩家面板 ───────────────── */
class Panel {
    constructor(rootId, key, flipped) {
        this.root = $(rootId);
        this.key = key;              // me | ai
        this.flipped = flipped;      // 人机面板：停放列在左侧（相当于玩家面板旋转 180°）
        this.field = this.root.querySelector('.table-field');
        this.diceLayer = this.root.querySelector('.dice-layer');
        this.parkLayer = this.root.querySelector('.park-layer');
        this.dice = [];              // 场上待决定的骰子
        this.parked = [];            // 本回合已收起的骰子
        this.rounds = [];            // 每轮收起的骰子数（横竖交替堆叠）
        this.ring = document.createElement('div');
        this.ring.className = 'roll-ring';
        this.field.appendChild(this.ring);
    }

    // 停放布局：每轮骰子一律横排，切换轮次即换行。
    // 我方在界面左侧，从左往右排、从左上角逐轮往下；
    // 对方在界面右侧，从右往左排、从右下角逐轮往上
    layoutPark() {
        const s = dieSize(), pw = parkW(), sc = parkScale();
        const W = this.field.clientWidth, H = this.field.clientHeight;
        const vis = s * sc;
        const step = Math.round(vis + 5);
        // 停放骰子以中心缩放（transform-origin 为中心），视觉盒相对布局盒偏移 (s-vis)/2；
        // 对方贴边用完整尺寸 s 锚定，使视觉内边距与我方左上角（8 / 24）保持一致（中心对称）
        // 我方首颗左边对齐 x=8；对方首颗右边对齐 x=W-8-s
        const firstX = this.flipped ? W - 8 - s : 8;
        const dir = this.flipped ? -1 : 1;         // 对方从右往左
        let curY = this.flipped ? H - 24 - s : 24;
        const out = [];
        this.rounds.forEach(count => {
            for (let k = 0; k < count; k++) {
                out.push({ x: firstX + dir * k * step, y: curY });
            }
            curY += this.flipped ? -step : step;
        });
        return out;
    }

    dieEl(id) {
        return this.diceLayer.querySelector(`[data-id="${id}"]`);
    }

    renderActive(selectable) {
        this.diceLayer.innerHTML = '';
        this.dice.forEach(d => {
            const el = makeDieEl(d);
            if (d.selected) el.classList.add('selected', this.key);
            // 点击统一绑定：徽章选取模式下点骰子选目标，否则切换计分选取
            // （toggleSelect 内部有阶段/面板守卫，滚动中与对方骰子点击无效）
            el.addEventListener('click', () => {
                if (state.targeting && this.key === 'me') { onTargetClick(d); return; }
                toggleSelect(d.id, this);
            });
            if (selectable) el.classList.add('selectable');
            this.diceLayer.appendChild(el);
        });
    }

    clear() {
        this.dice = [];
        this.parked = [];
        this.rounds = [];
        this.diceLayer.innerHTML = '';
        this.parkLayer.innerHTML = '';
        this.field.classList.remove('rolling');
    }
}

const panels = {
    me: new Panel('half-me', 'me', false),
    ai: new Panel('half-ai', 'ai', true),
};
const activePanel = () => panels[state.current];

/* ── 投掷区几何（空心圆范围 / 环） ── */
function rollGeom(panel) {
    const s = dieSize(), pw = parkW();
    const W = panel.field.clientWidth, H = panel.field.clientHeight;
    // 我方停放区在左、对方在右（我的视角），骰子区占据另一侧
    const xMin = (panel.flipped ? 6 : pw + 6) + s / 2;
    const xMax = (panel.flipped ? W - pw - 6 : W - 6) - s / 2;
    const yMin = 12 + s / 2;
    const yMax = H - 8 - s / 2;
    const cx = (xMin + xMax) / 2, cy = (yMin + yMax) / 2;
    const R = Math.max(s * 1.9, Math.min(xMax - xMin, yMax - yMin) * 0.48);
    return {
        s, xMin, xMax, yMin, yMax, cx, cy, R,
        lim: R - s * 0.72,   // 骰心约束半径：保证整颗骰子不越出空心圆
    };
}

// 结果分布：优先从圆心向外径向散发；若可用区域过窄无法避免重叠，
// 则改用网格播种 —— 两者都会经过松弛迭代，保证结果骰子互不重叠
function layoutPositions(panel, n) {
    const g = rollGeom(panel);
    const minD = g.s * 1.06;

    const relax = (pts, iters) => {
        for (let it = 0; it < iters; it++) {
            let moved = false;
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    let dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
                    let d = Math.hypot(dx, dy);
                    if (d < 1e-4) { dx = 1; dy = 0; d = 1; }
                    if (d < minD) {
                        const push = (minD - d) / 2;
                        dx /= d; dy /= d;
                        pts[i].x -= dx * push; pts[i].y -= dy * push;
                        pts[j].x += dx * push; pts[j].y += dy * push;
                        moved = true;
                    }
                }
            }
            pts.forEach(p => {
                // 圆形约束：把越出空心圆的骰心拉回圆周内
                const dx = p.x - g.cx, dy = p.y - g.cy;
                const d = Math.hypot(dx, dy);
                if (d > g.lim) {
                    const k = g.lim / (d || 0.01);
                    p.x = g.cx + dx * k;
                    p.y = g.cy + dy * k;
                }
            });
            if (!moved) break;
        }
        return pts;
    };
    const minPair = pts => {
        let m = Infinity;
        for (let i = 0; i < pts.length; i++) {
            for (let j = i + 1; j < pts.length; j++) {
                m = Math.min(m, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
            }
        }
        return m;
    };
    const inCircle = p => Math.hypot(p.x - g.cx, p.y - g.cy) <= g.lim + 0.5;

    // 方案 A：径向螺旋（由圆心向外散发，限制在圆内）
    const golden = 2.39996;
    const maxR = Math.max(g.s * 0.8, g.lim * 0.88);
    const radial = [];
    for (let i = 0; i < n; i++) {
        const r = n === 1 ? 0 : maxR * Math.sqrt((i + 0.5) / n);
        const a = i * golden + (Math.random() - 0.5) * 0.7;
        radial.push({ x: g.cx + Math.cos(a) * r, y: g.cy + Math.sin(a) * r });
    }
    relax(radial, 80);
    if (radial.every(inCircle) && minPair(radial) >= minD - 0.5) {
        return radial.map(p => ({ x: p.x - g.s / 2, y: p.y - g.s / 2 }));
    }

    // 方案 B：圆内网格播种；若圆太小无法规则排布，则沿圆周均匀分布
    const boxW = g.lim * 2, boxH = g.lim * 2;
    let best = null;
    for (let cols = 1; cols <= n; cols++) {
        const rows = Math.ceil(n / cols);
        const cellW = boxW / cols, cellH = boxH / rows;
        if (cellW < g.s * 0.98 || cellH < g.s * 0.98) continue;
        const ratio = Math.abs(cellW - cellH) / Math.max(cellW, cellH);
        if (!best || ratio < best.ratio) best = { cols, rows, cellW, cellH, ratio };
    }
    let pts;
    if (best) {
        pts = [];
        for (let i = 0; i < n; i++) {
            const r = Math.floor(i / best.cols);
            const c = i % best.cols;
            const m = Math.min(best.cols, n - r * best.cols);
            const off = (best.cols - m) * best.cellW / 2;
            pts.push({
                x: g.cx - boxW / 2 + off + (c + 0.5) * best.cellW + (Math.random() - 0.5) * best.cellW * 0.3,
                y: g.cy - boxH / 2 + (r + 0.5) * best.cellH + (Math.random() - 0.5) * best.cellH * 0.3,
            });
        }
    } else {
        pts = [];
        for (let i = 0; i < n; i++) {
            const a = (Math.PI * 2 * i) / n - Math.PI / 2 + (Math.random() - 0.5) * 0.3;
            pts.push({ x: g.cx + Math.cos(a) * g.lim, y: g.cy + Math.sin(a) * g.lim });
        }
    }
    relax(pts, 140);
    return pts.map(p => ({ x: p.x - g.s / 2, y: p.y - g.s / 2 }));
}

const ROLL_MS = 950;   // 环内碰撞阶段时长

function flashRing(panel) {
    const now = performance.now();
    if (now - (panel.lastRingPulse || 0) < 90) return;
    panel.lastRingPulse = now;
    panel.ring.classList.add('pulse');
    setTimeout(() => panel.ring.classList.remove('pulse'), 110);
}

// 投掷过程：骰子在面板中间的空心圆内互相碰撞（允许重叠），
// 结束后由圆心向外散发到互不重叠的结果位置
// 帧驱动：requestAnimationFrame + 真实时间步长；位置只写 transform（GPU 合成，无重排）
function rollAnimation(panel, values) {
    return new Promise(resolve => {
        const g = rollGeom(panel);
        const n = panel.dice.length;
        // 结果位置预先算好：环内运动与散发使用同一速度
        const finals = layoutPositions(panel, n);
        const speedPerMs = g.R * 0.005;   // 恒定速度（px/ms），环内与散发共用

        panel.ring.style.left = (g.cx - g.R) + 'px';
        panel.ring.style.top = (g.cy - g.R) + 'px';
        panel.ring.style.width = panel.ring.style.height = (g.R * 2) + 'px';
        panel.field.classList.add('rolling');

        const st = panel.dice.map((d, i) => {
            const a = (Math.PI * 2 * i) / n + Math.random() * 0.8;
            const rr = g.R * (0.15 + Math.random() * 0.5);
            const x = g.cx + Math.cos(a) * rr;
            const y = g.cy + Math.sin(a) * rr;
            const rot = Math.round(Math.random() * 360);
            const dir = Math.random() * Math.PI * 2;
            // 首帧即位于环内
            d.x = x - g.s / 2;
            d.y = y - g.s / 2;
            d.rot = rot;
            return {
                d, x, y, el: null,
                vx: Math.cos(dir) * speedPerMs,
                vy: Math.sin(dir) * speedPerMs,
                rot,
                vr: (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.35), // 度/ms
            };
        });
        panel.renderActive(false);
        st.forEach(o => { o.el = panel.dieEl(o.d.id); });

        const t0 = performance.now();
        let last = t0;
        let lastFace = t0;
        let done = false;
        let rafId = 0;

        const draw = () => {
            for (const o of st) {
                o.d.x = o.x - g.s / 2;
                o.d.y = o.y - g.s / 2;
                o.d.rot = o.rot;
                if (o.el) {
                    o.el.style.transform =
                        `translate3d(${o.d.x}px, ${o.d.y}px, 0) rotate(${o.rot}deg) scale(1)`;
                }
            }
        };

        const finish = () => {
            done = true;
            cancelAnimationFrame(rafId);
            clearInterval(hiddenTimer);
            // 结果：由圆心向外散发，按各自距离换算时长，保持与环内一致的恒定速度
            panel.field.classList.remove('rolling');
            let maxDur = 0;
            panel.dice.forEach((d, i) => {
                d.scale = 1;
                d.rot = Math.round(Math.random() * 56 - 28);
                const el = panel.dieEl(d.id);
                const dist = Math.hypot(finals[i].x - d.x, finals[i].y - d.y);
                const dur = Math.min(900, Math.max(120, Math.round(dist / speedPerMs)));
                maxDur = Math.max(maxDur, dur);
                d.x = finals[i].x;
                d.y = finals[i].y;
                if (el) {
                    el.style.transitionDuration = dur + 'ms';
                    el.dataset.value = values[i];
                    placeDie(el, d);
                }
            });
            setTimeout(resolve, maxDur + 60);
        };

        const step = now => {
            const dt = Math.min(now - last, 64); // 限制单帧步长，切回前台不会跳帧
            last = now;
            if (dt <= 0) return;
            for (const o of st) {
                o.x += o.vx * dt;
                o.y += o.vy * dt;
                o.rot += o.vr * dt;
            }
            for (const o of st) {
                // 环壁碰撞：无损反射，速率不衰减（骰心不越出空心圆）
                const dx = o.x - g.cx, dy = o.y - g.cy;
                const dist = Math.hypot(dx, dy) || 0.01;
                if (dist > g.lim) {
                    const nx = dx / dist, ny = dy / dist;
                    const dot = o.vx * nx + o.vy * ny;
                    if (dot > 0) {
                        o.vx -= 2 * dot * nx;
                        o.vy -= 2 * dot * ny;
                        o.vr += (Math.random() * 2 - 1) * 0.2;
                        flashRing(panel);
                    }
                    o.x = g.cx + nx * g.lim;
                    o.y = g.cy + ny * g.lim;
                }
            }
            draw();
            if (now - lastFace > 90) {
                lastFace = now;
                [...panel.diceLayer.children].forEach(el => { el.dataset.value = rollDie(); });
            }
            if (now - t0 > ROLL_MS) finish();
        };

        const rafLoop = now => {
            if (done) return;
            step(now);
            if (!done) rafId = requestAnimationFrame(rafLoop);
        };
        rafId = requestAnimationFrame(rafLoop);
        // 隐藏标签页 rAF 停摆时的兜底驱动
        const hiddenTimer = setInterval(() => {
            if (done) return;
            const now = performance.now();
            if (now - last > 120) step(now);
        }, 100);
    });
}

/* ── 渲染 ───────────────────────── */
function makeDieEl(die) {
    const el = document.createElement('div');
    el.className = 'die';
    el.dataset.id = die.id;
    el.dataset.value = die.value;
    el.style.setProperty('--rot', '0deg');
    for (let i = 1; i <= 9; i++) {
        const pip = document.createElement('span');
        pip.className = 'pip p' + i;
        el.appendChild(pip);
    }
    placeDie(el, die);
    return el;
}

function placeDie(el, die) {
    el.style.setProperty('--rot', die.rot + 'deg');
    el.style.transform =
        `translate3d(${die.x}px, ${die.y}px, 0) rotate(${die.rot}deg) scale(${die.scale || 1})`;
}

function setBanner(text, cls) {
    els.banner.textContent = text;
    els.banner.className = 'table-banner' + (cls ? ' ' + cls : '');
}

function log(text, cls) {
    const line = document.createElement('div');
    line.className = 'log-line' + (cls ? ' ' + cls : '');
    line.innerHTML = text;
    els.log.appendChild(line);
    els.log.scrollTop = els.log.scrollHeight;
}

function paintScores() {
    els.scoreMe.textContent = shown.me;
    els.scoreAi.textContent = shown.ai;
    els.scoreTarget.textContent = state.target;
}

function renderScores() {
    paintScores();
    const b = state.badges[state.current];
    const armed = b && !b.cancelled && b.type === 'warlord' && state.warlordArmed[state.current];
    const turnText = state.turnPoints > 0 ? (armed ? `${state.turnPoints}×${b.mult}` : `${state.turnPoints}`) : '0';
    const live = state.phase !== 'over' && state.phase !== 'setup';
    els.turnMe.textContent = live && state.current === 'me' ? turnText : '0';
    els.turnAi.textContent = live && state.current === 'ai' ? turnText : '0';
}

function updateSelInfo() {
    const sel = panels.me.dice.filter(d => d.selected).map(d => d.value);
    const { score, valid } = scoreValues(sel, fxFor('me'));
    if (state.targeting) {
        // 徽章选取模式下：骰子点击用于选取目标，收骰/记分暂不可用
        els.selMe.textContent = sel.length && valid ? score : '0';
        els.again.disabled = true;
        els.bank.disabled = true;
        els.bank.classList.remove('hl');
        refreshBadgeBtn();
        return;
    }
    if (sel.length === 0) {
        els.selMe.textContent = '0';
        els.bank.innerHTML = '<svg><use href="#i-play"/></svg> 跳过';
        els.bank.disabled = false;
        els.bank.classList.add('hl');
    } else if (!valid) {
        els.selMe.textContent = '0';
        els.bank.innerHTML = '<svg><use href="#i-coin"/></svg> 计分并跳过';
        els.bank.disabled = true;
        els.bank.classList.remove('hl');
    } else {
        els.selMe.textContent = score;
        els.bank.innerHTML = '<svg><use href="#i-coin"/></svg> 计分并跳过';
        els.bank.disabled = false;
        els.bank.classList.remove('hl');
    }
    const canAct = state.phase === 'select' && valid;
    els.again.disabled = !canAct;
    refreshBadgeBtn();
}

function setButtons() {
    if (state.phase === 'bust-choice') {
        els.again.disabled = true;
        els.bank.disabled = false;
        els.bank.innerHTML = '<svg><use href="#i-alert"/></svg> 放弃回合';
        els.bank.classList.remove('hl');
    } else if (state.phase === 'pre-bank') {
        els.again.disabled = true;
        els.bank.disabled = false;
        els.bank.innerHTML = '<svg><use href="#i-coin"/></svg> 直接记分';
        els.bank.classList.remove('hl');
    } else if (state.phase !== 'select') {
        els.again.disabled = true;
        els.bank.disabled = true;
    }
    refreshBadgeBtn();
}

/* ── 停放（所有选中骰子一次性平移） ─ */
function parkDice(panel, dice) {
    if (!dice.length) return;
    panel.rounds.push(dice.length);          // 新增一轮
    const pos = panel.layoutPark();          // 重算全部停放位置
    const sc = parkScale();
    const base = panel.parked.length;
    dice.forEach((d, k) => {
        d.parked = true;
        d.selected = false;
        d.rot = 0;
        d.scale = sc;
        const p = pos[base + k] || { x: 8, y: 12 };
        d.x = p.x;
        d.y = p.y;
        panel.parked.push(d);
        const el = panel.dieEl(d.id);
        if (el) {
            el.style.transitionDuration = '';   // 复位散发阶段设置的时长
            el.classList.remove('selected', 'selectable');
            el.classList.add('parked');
            panel.parkLayer.appendChild(el);
            placeDie(el, d);
        }
    });
    panel.dice = panel.dice.filter(d => !d.parked);
}

// 全部骰子收起且场上无剩余 → 热骰，清空停放区重新掷满 6 颗
// （力量徽章可能令场上出现第 7 颗：收满 6 颗但仍有剩余时不触发）
function checkHotDice(panel) {
    if (panel.parked.length < 6 || panel.dice.length > 0) return;
    const n = panel.parked.length;
    panel.parked = [];
    panel.rounds = [];
    panel.parkLayer.innerHTML = '';
    log(`${n} 颗骰子全部计分，触发<b>热骰</b>：重新掷满 6 颗`, 'important');
}

/* ── 徽章 UI 与效果 ─────────────── */
function renderBadges() {
    const mk = who => {
        const el = who === 'me' ? els.badgeChipMe : els.badgeChipAi;
        const b = state.badges[who];
        if (!b) {
            el.classList.add('hidden');
            el.innerHTML = '';
            return;
        }
        el.classList.remove('hidden', 'dead', 'armed');
        const counted = ['might', 'reroll', 'transmute', 'doppel', 'resurrect'].includes(b.type);
        let txt = `<i class="tier-dot ${b.tier}"></i>${TIER_CN[b.tier]}·${b.short}`;
        if (b.cancelled) {
            el.classList.add('dead');
            txt += '（已抵消）';
        } else if (b.type === 'warlord' && state.warlordArmed[who]) {
            el.classList.add('armed');
            txt += ' 已发动';
        } else if (counted) {
            txt += ` 剩${b.uses}`;
        }
        el.innerHTML = txt;
    };
    mk('me');
    mk('ai');
    els.badgeStrip.classList.toggle('hidden', !state.badges.me && !state.badges.ai);
}

// 徽章按钮：随阶段/剩余次数刷新文案与可用性
function refreshBadgeBtn() {
    const btn = els.badge;
    const b = state.badges.me;
    const tag = b ? `<i class="tier-dot ${b.tier}"></i>` : '';
    if (!b) {
        btn.disabled = true;
        btn.innerHTML = '<svg><use href="#i-badge"/></svg> 无徽章';
        return;
    }
    if (b.cancelled) {
        btn.disabled = true;
        btn.innerHTML = `${tag} 徽章已抵消`;
        return;
    }
    const t = state.targeting;
    if (t) {
        btn.disabled = false;
        if (t.type === 'transmute') {
            btn.innerHTML = `${tag} 取消点化`;
        } else {
            btn.innerHTML = t.picked.length === 0
                ? `${tag} 取消重掷`
                : `${tag} 确认重掷 ${t.picked.length}/${t.max}`;
        }
        return;
    }
    switch (b.type) {
        case 'might':
            btn.disabled = state.phase !== 'select' || b.uses <= 0;
            btn.innerHTML = `${tag} 力量：加掷一颗（剩${b.uses}）`;
            break;
        case 'reroll':
            btn.disabled = state.phase !== 'select' || b.uses <= 0;
            btn.innerHTML = `${tag} ${b.short}：重掷${b.sameValue ? '2 颗同点' : `最多 ${b.dice} 颗`}（剩${b.uses}）`;
            break;
        case 'transmute':
            btn.disabled = state.phase !== 'select' || b.uses <= 0;
            btn.innerHTML = `${tag} 点化：一颗骰变为 ${b.to}（剩${b.uses}）`;
            break;
        case 'doppel': {
            const lc = state.lastCollect;
            const ok = b.uses > 0 && lc && lc.who === 'me' && !lc.doubled &&
                (state.phase === 'select' || state.phase === 'pre-bank');
            btn.disabled = !ok;
            btn.innerHTML = ok
                ? `${tag} 分身：翻倍上次掷骰 +${lc.score}`
                : `${tag} 分身（剩${b.uses}）`;
            break;
        }
        case 'warlord': {
            const armed = state.warlordArmed.me;
            btn.disabled = armed || state.phase !== 'select' || b.uses <= 0 || state.turnPoints <= 0;
            btn.innerHTML = armed
                ? `${tag} 军阀已发动 ×${b.mult}`
                : `${tag} 军阀：本回合 ×${b.mult}`;
            break;
        }
        case 'resurrect':
            if (state.phase === 'bust-choice') {
                btn.disabled = false;
                btn.innerHTML = `${tag} 复活：保住 ${state.turnPoints} 分再掷（剩${b.uses}）`;
            } else {
                btn.disabled = true;
                btn.innerHTML = `${tag} 复活（爆骰时可用，剩${b.uses}）`;
            }
            break;
        default: // defence / headstart / formation / emperor：被动
            btn.disabled = true;
            btn.innerHTML = `${tag} ${b.short}（被动生效）`;
    }
}

// 分身徽章：把上次掷骰的分数再加一遍
function applyDoppel(who) {
    const b = state.badges[who];
    const lc = state.lastCollect;
    if (!b || b.cancelled || b.type !== 'doppel' || b.uses <= 0 || !lc || lc.who !== who || lc.doubled) return false;
    b.uses--;
    lc.doubled = true;
    state.turnPoints += lc.score;
    const name = who === 'me' ? '你' : '对方';
    log(`${name}使用「${b.name}」：上次掷骰 <b>${lc.score}</b> 分翻倍，+<b>${lc.score}</b>（本回合 ${state.turnPoints}）`, 'important');
    renderBadges();
    renderScores();
    refreshBadgeBtn();
    return true;
}

/* ── 徽章目标选取（点化 / 重掷）── */
function enterTargeting(t) {
    state.targeting = t;
    renderTargeting();
    setBanner(t.type === 'transmute'
        ? `点化：点击场上一颗骰子，将其点数变为 ${t.to}`
        : `重掷：点击最多 ${t.max} 颗骰子标记${t.sameValue ? '（须点数相同）' : ''}，再点徽章键确认`, 'good');
    updateSelInfo();
}
function renderTargeting() {
    panels.me.renderActive(false);
    panels.me.dice.forEach(d => {
        const el = panels.me.dieEl(d.id);
        if (!el) return;
        el.classList.add('targetable');
        if (state.targeting && state.targeting.type === 'reroll' &&
            state.targeting.picked.includes(d.id)) el.classList.add('picked');
    });
}
function exitTargeting() {
    state.targeting = null;
    if (state.phase === 'select') {
        panels.me.renderActive(true);
        setBanner('选取计分骰子，然后「收骰再掷」或「记分结束回合」');
        updateSelInfo();
    } else {
        refreshBadgeBtn();
    }
}
function onTargetClick(die) {
    const t = state.targeting;
    if (!t) return;
    if (t.type === 'transmute') {
        const from = die.value;
        die.value = t.to;
        state.badges.me.uses--;
        state.targeting = null;
        const el = panels.me.dieEl(die.id);
        if (el) el.dataset.value = t.to;
        log(`你使用「${state.badges.me.name}」：${from} → <b>${t.to}</b>`, 'important');
        renderBadges();
        panels.me.renderActive(true);
        setBanner('选取计分骰子，然后「收骰再掷」或「记分结束回合」');
        updateSelInfo();
        return;
    }
    const at = t.picked.indexOf(die.id);
    if (at >= 0) {
        t.picked.splice(at, 1);
    } else {
        if (t.picked.length >= t.max) return;
        if (t.sameValue && t.picked.length > 0) {
            const first = panels.me.dice.find(d => d.id === t.picked[0]);
            if (!first || first.value !== die.value) return;
        }
        t.picked.push(die.id);
    }
    renderTargeting();
    refreshBadgeBtn();
}

// 原地把若干骰子重掷（好运/交换/婚礼徽章）：抖动 + 面数切换
async function rerollDice(panel, dice) {
    const elsDice = dice.map(d => panel.dieEl(d.id)).filter(Boolean);
    elsDice.forEach(el => {
        el.classList.remove('selected', 'targetable', 'picked');
        el.classList.add('rerolling');
    });
    const flicker = setInterval(() => {
        elsDice.forEach(el => { el.dataset.value = rollDie(); });
    }, 90);
    await delay(620);
    clearInterval(flicker);
    dice.forEach(d => {
        d.value = rollDie();
        d.rot = Math.round(Math.random() * 56 - 28);
        const el = panel.dieEl(d.id);
        if (el) {
            el.dataset.value = d.value;
            placeDie(el, d);
        }
    });
    await delay(340);
    elsDice.forEach(el => el.classList.remove('rerolling'));
}

// 确认重掷：结算爆骰风险
async function confirmReroll() {
    const t = state.targeting;
    const b = state.badges.me;
    if (!t || t.type !== 'reroll' || !b) return;
    const dice = t.picked.map(id => panels.me.dice.find(d => d.id === id)).filter(Boolean);
    if (!dice.length) { exitTargeting(); return; }
    b.uses--;
    state.targeting = null;
    dice.forEach(d => { d.selected = false; });
    state.phase = 'busy';
    setButtons();
    log(`你使用「${b.name}」：重掷 ${dice.map(d => d.value).join('、')}`, 'important');
    renderBadges();
    await rerollDice(panels.me, dice);
    const values = panels.me.dice.map(d => d.value);
    log(`重掷结果：${values.join('、')}`);
    if (!hasAnyScore(values, fxFor('me'))) {
        await resolveBust('me');
        return;
    }
    state.phase = 'select';
    panels.me.renderActive(true);
    setBanner('选取计分骰子，然后「收骰再掷」或「记分结束回合」');
    updateSelInfo();
}

// 力量徽章：当场加掷一颗骰子（与本掷骰子一起参与选取）
async function addExtraDie(who) {
    const panel = panels[who];
    panel.dice.push({
        id: state.nextId++, value: rollDie(), selected: false,
        x: 0, y: 0, rot: 0, scale: 1,
    });
    await rollAnimation(panel, panel.dice.map(d => d.value));
}

// 爆骰结算：有无复活徽章决定走向。返回 'end' | 'choice' | 'resurrect'
async function resolveBust(who) {
    const name = who === 'me' ? '你' : '对方';
    const lost = state.turnPoints;
    const b = state.badges[who];
    const canRes = !!(b && !b.cancelled && b.type === 'resurrect' && b.uses > 0);
    if (state.warlordArmed[who]) {
        state.warlordArmed[who] = false;
        log(`${name}发动的「军阀徽章」随爆骰失效`);
        renderBadges();
    }
    log(`${name}爆骰！${lost > 0 ? `本回合 ${lost} 分${canRes ? '命悬一线' : '作废'}` : ''}`, 'bust');
    setBanner(`${name}爆骰！`, 'warn');
    els.boardFlashText.textContent = canRes ? '爆骰！' : '本轮作废';
    els.boardFlash.classList.remove('hidden');
    await delay(1000);
    els.boardFlash.classList.add('hidden');
    if (!canRes) {
        state.turnPoints = 0;
        renderScores();
        endTurn();
        return 'end';
    }
    if (who === 'me') {
        log(`「${b.name}」可再掷一次，保住本回合 ${lost} 分`, 'important');
        setBanner(`爆骰！${lost} 分命悬一线——「复活」再掷，或放弃回合`, 'warn');
        state.phase = 'bust-choice';
        setButtons();
        return 'choice';
    }
    if (lost >= 250) {
        b.uses--;
        renderBadges();
        log(`对方使用「${b.name}」：保住本回合 ${lost} 分，再掷一次`, 'important');
        setBanner('对方使用复活徽章，再次掷骰…');
        await delay(800);
        return 'resurrect';
    }
    log('对方放弃使用复活徽章');
    state.turnPoints = 0;
    renderScores();
    endTurn();
    return 'end';
}

// AI 点化目标：牺牲一颗无用骰子补全某点数的三同（优先 1、5）
function aiTransmuteTarget(values) {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    values.forEach(v => counts[v]++);
    const to = [1, 5, 6, 4, 3, 2].find(v => counts[v] === 2);
    if (to === undefined) return null;
    const dieIdx = values.findIndex(v => [2, 3, 4, 6].includes(v) && counts[v] < 3 && v !== to);
    if (dieIdx < 0) return null;
    return { dieIdx, to };
}

/* ── 掷骰 ───────────────────────── */
function toggleSelect(id, panel) {
    if (state.phase !== 'select' || panel !== panels.me) return;
    const die = panel.dice.find(d => d.id === id);
    if (!die) return;
    die.selected = !die.selected;
    panel.renderActive(true);
    updateSelInfo();
}

async function doRoll() {
    const panel = activePanel();
    for (;;) {
        if (pendingReset[state.current]) {
            panel.clear();
            pendingReset[state.current] = false;
        }
        state.phase = 'busy';
        setButtons();
        // 场上剩几颗掷几颗（开局/热骰为 6；力量徽章加掷的骰子计入在场数）
        const count = panel.dice.length || 6;
        panel.dice = Array.from({ length: count }, () => ({
            id: state.nextId++, value: rollDie(), selected: false,
            x: 0, y: 0, rot: 0, scale: 1,
        }));
        setBanner(state.current === 'me' ? '掷骰中…' : '对方掷骰中…');
        const values = panel.dice.map(d => d.value);
        await rollAnimation(panel, values);

        const who = state.current === 'me' ? '你' : '对方';
        log(`${who}掷出 ${values.join('、')}`);

        if (hasAnyScore(values, fxFor(state.current))) {
            if (state.current === 'me') {
                state.phase = 'select';
                panel.renderActive(true);
                setBanner('选取计分骰子，然后「收骰再掷」或「记分结束回合」');
                updateSelInfo();
            } else {
                state.phase = 'ai';
            }
            setButtons();
            return 'score';
        }
        // 爆骰：由 resolveBust 决定结束回合还是使用复活徽章再掷
        const r = await resolveBust(state.current);
        if (r !== 'resurrect') return r;
    }
}

/* ── 玩家回合 ───────────────────── */
// 把玩家所选骰子计分并一次性停放到右侧（同时记录得分来源），返回 {score, values}；无效返回 null
async function collectSelected() {
    const panel = panels.me;
    const sel = panel.dice.filter(d => d.selected);
    const values = sel.map(d => d.value);
    const { score, valid } = scoreValues(values, fxFor('me'));
    if (!valid) return null;
    state.turnPoints += score;
    state.lastCollect = { who: 'me', score, doubled: false };
    log(`你收起 ${values.join('、')}，+<b>${score}</b> 分（${scoreDetail(values, fxFor('me'))}・本回合 ${state.turnPoints}）`);
    state.phase = 'busy';
    setButtons();
    parkDice(panel, sel);
    els.selMe.textContent = '0';
    await delay(430);
    checkHotDice(panel);
    renderScores();
    return { score, values };
}

// 玩家：收骰再掷
async function onAgain() {
    const got = await collectSelected();
    if (!got) return;
    await doRoll();
}

// 记分（含分身/军阀结算后）：记分 → 胜负判定 → 交回合
function finishBank(who) {
    bankScore(who);
    if (state.scores[who] >= state.target) {
        finishGame(who);
        return;
    }
    endTurn();
}

// 玩家：计分结束回合 / 跳过 / 放弃复活 / 直接记分
async function onBank() {
    if (state.phase === 'bust-choice') {
        const lost = state.turnPoints;
        state.turnPoints = 0;
        log(`你放弃复活，本回合 ${lost} 分作废`, 'bust');
        renderScores();
        endTurn();
        return;
    }
    if (state.phase === 'pre-bank') {
        finishBank('me');
        return;
    }
    if (state.phase !== 'select') return;
    const sel = panels.me.dice.filter(d => d.selected);
    if (sel.length === 0) {
        if (state.turnPoints > 0) {
            finishBank('me');
        } else {
            log('你选择跳过回合');
            endTurn();
        }
        return;
    }
    const got = await collectSelected();
    if (!got) return;
    // 分身徽章可用时，给出「翻倍后再记分」的选择窗口
    const b = state.badges.me;
    if (b && !b.cancelled && b.type === 'doppel' && b.uses > 0 &&
        state.lastCollect && state.lastCollect.who === 'me' && !state.lastCollect.doubled) {
        state.phase = 'pre-bank';
        setBanner(`可发动「分身」翻倍本次掷骰（+${state.lastCollect.score} 分），或直接记分`, 'good');
        setButtons();
        return;
    }
    finishBank('me');
}

// 记分：分数跳动动画后更新显示，选定栏立即清零；军阀徽章在此结算倍率
function bankScore(who) {
    const b = state.badges[who];
    let gained = state.turnPoints;
    let suffix = '';
    if (b && !b.cancelled && b.type === 'warlord' && state.warlordArmed[who]) {
        gained = Math.round(gained * b.mult);
        suffix = `（军阀 ×${b.mult}）`;
        state.warlordArmed[who] = false;
    }
    state.scores[who] += gained;
    const name = who === 'me' ? '你' : '对方';
    log(`${name}记分 <b>${gained}</b>${suffix}，总分 ${state.scores[who]}`, 'bank');
    state.turnPoints = 0;
    els.selMe.textContent = '0';
    els.selAi.textContent = '0';
    const scoreEl = who === 'me' ? els.scoreMe : els.scoreAi;
    scoreEl.classList.remove('flash');
    void scoreEl.offsetWidth;
    scoreEl.classList.add('flash');
    setTimeout(() => {
        scoreEl.classList.remove('flash');
        shown[who] = state.scores[who];
        paintScores();
    }, 400);
    renderScores();
}

function endTurn() {
    state.targeting = null;
    state.lastCollect = null;
    state.warlordArmed.me = false;
    state.warlordArmed.ai = false;
    pendingReset[state.current] = true;
    els.selMe.textContent = '0';
    els.selAi.textContent = '0';
    els.bank.innerHTML = '<svg><use href="#i-coin"/></svg> 计分并跳过';
    if (state.current === 'me') {
        state.current = 'ai';
        state.phase = 'ai';
        renderScores();
        renderBadges();
        setButtons();
        runAiTurn();
    } else {
        state.current = 'me';
        state.phase = 'await-roll';
        setBanner('对方回合结束，轮到你');
        renderScores();
        renderBadges();
        setButtons();
        doRoll();
    }
}

/* ── AI 回合 ────────────────────── */
function aiShouldContinue(remaining) {
    if (remaining === 0) return true; // 热骰，免费再掷
    if (remaining >= 3) return true;
    return state.turnPoints < 350;
}

async function runAiTurn() {
    setBanner('对方回合…');
    await delay(800);
    let mightUsed = false;

    for (;;) {
        els.selAi.textContent = '0';
        const rolled = await doRoll();
        if (rolled !== 'score') return; // 爆骰：已在 resolveBust 中交还回合或复活

        const panel = panels.ai;
        const bAi = state.badges.ai;
        const fx = fxFor('ai');

        // 力量徽章：每回合首次掷骰后加掷一颗
        if (!mightUsed && bAi && !bAi.cancelled && bAi.type === 'might' && bAi.uses > 0) {
            mightUsed = true;
            bAi.uses--;
            renderBadges();
            log('对方使用「力量徽章」：本掷加一颗骰子', 'important');
            setBanner('对方使用力量徽章，加掷一颗骰子…');
            await delay(500);
            await addExtraDie('ai');
        }

        // 掷后处理；复活徽章再掷成功后回到这里重新选取
        for (;;) {
            let values = panel.dice.map(d => d.value);

            // 点化徽章：牺牲一颗无用骰子补全三同
            if (bAi && !bAi.cancelled && bAi.type === 'transmute' && bAi.uses > 0) {
                const t = aiTransmuteTarget(values);
                if (t) {
                    bAi.uses--;
                    renderBadges();
                    const die = panel.dice[t.dieIdx];
                    log(`对方使用「点化徽章」：${die.value} → <b>${t.to}</b>（补全三同）`, 'important');
                    die.value = t.to;
                    const el = panel.dieEl(die.id);
                    if (el) el.dataset.value = t.to;
                    values = panel.dice.map(d => d.value);
                    await delay(600);
                }
            }

            let groups = takeGroups(values, fx);
            let taken = groups.flatMap(g => g.indices);
            let takenValues = taken.map(i => values[i]);

            // 好运/交换类徽章：回合分嘴上还是 0 且只能收到单张 5 时，赌一次重掷
            if (bAi && !bAi.cancelled && bAi.type === 'reroll' && bAi.uses > 0 && state.turnPoints === 0 &&
                takenValues.length > 0 && takenValues.length <= bAi.dice &&
                groups.every(g => !g.quick) && takenValues.every(v => v === 5)) {
                bAi.uses--;
                renderBadges();
                const picked = taken.map(i => panel.dice[i]).filter(Boolean);
                log(`对方使用「${bAi.name}」：重掷 ${picked.length} 颗骰子`, 'important');
                setBanner('对方使用好运徽章，重掷骰子…');
                await delay(500);
                await rerollDice(panel, picked);
                values = panel.dice.map(d => d.value);
                log(`对方重掷结果：${values.join('、')}`);
                if (!hasAnyScore(values, fx)) {
                    const r = await resolveBust('ai');
                    if (r === 'end') return;
                    if (r === 'resurrect') {
                        const rr = await doRoll();
                        if (rr !== 'score') return;
                        continue;
                    }
                }
                groups = takeGroups(values, fx);
                taken = groups.flatMap(g => g.indices);
                takenValues = taken.map(i => values[i]);
            }

            // 选骰动画：组合（三同及以上/特殊组合）快速依次点亮，单张（1/5）慢速依次点亮；
            // 每颗骰子选中前后的等待间隔一致（快速 240ms / 慢速 720ms），
            // 从快速切到慢速时也先等待一个慢速间隔，避免慢速骰子被"追上"
            setBanner('对方选取骰子…');
            const QUICK_STEP = 240;
            const SLOW_STEP = 720;
            let lastStep = SLOW_STEP;
            const selAccum = [];
            for (const g of groups) {
                const step = g.quick ? QUICK_STEP : SLOW_STEP;
                for (const i of g.indices) {
                    await delay(step);
                    const el = panel.dieEl(panel.dice[i].id);
                    if (el) el.classList.add('selected', panel.key);
                    selAccum.push(values[i]);
                    els.selAi.textContent = scoreValues(selAccum, fx).score;
                    lastStep = step;
                }
            }
            await delay(lastStep);
            const takenDice = taken.map(i => panel.dice[i]).filter(d => d && !d.parked);
            parkDice(panel, takenDice);
            await delay(430);
            const takenScore = scoreValues(takenValues, fx).score;
            state.turnPoints += takenScore;
            state.lastCollect = { who: 'ai', score: takenScore, doubled: false };
            renderScores();
            log(`对方收起 ${takenValues.join('、')}，+<b>${takenScore}</b> 分（${scoreDetail(takenValues, fx)}・本回合 ${state.turnPoints}）`);
            checkHotDice(panel);
            await delay(500);

            // 分身徽章：大额掷骰或能直接取胜时翻倍
            if (bAi && !bAi.cancelled && bAi.type === 'doppel' && bAi.uses > 0 &&
                (takenScore >= 300 || state.scores.ai + state.turnPoints + takenScore >= state.target)) {
                if (applyDoppel('ai')) await delay(600);
            }

            // 军阀徽章：大额回合或能直接取胜时发动
            if (bAi && !bAi.cancelled && bAi.type === 'warlord' && bAi.uses > 0 && !state.warlordArmed.ai &&
                (state.turnPoints >= 400 || state.scores.ai + Math.round(state.turnPoints * bAi.mult) >= state.target)) {
                bAi.uses--;
                state.warlordArmed.ai = true;
                renderBadges();
                log(`对方发动「军阀徽章」：本回合记分 ×${bAi.mult}`, 'important');
                renderScores();
                await delay(600);
            }

            const armed = bAi && !bAi.cancelled && bAi.type === 'warlord' && state.warlordArmed.ai;
            const eff = Math.round(state.turnPoints * (armed ? bAi.mult : 1));
            if (state.scores.ai + eff >= state.target) {
                bankScore('ai');
                finishGame('ai');
                return;
            }

            if (!aiShouldContinue(panel.dice.length)) {
                bankScore('ai');
                await delay(900);
                endTurn();
                return;
            }
            setBanner('对方选择继续掷骰…');
            await delay(700);
            break; // 用剩余骰子继续掷
        }
    }
}

/* ── 结算 ───────────────────────── */
function finishGame(winner) {
    state.phase = 'over';
    renderScores();
    els.scoreboard.classList.add('hidden');
    els.boardOverText.textContent = winner === 'me' ? 'YOU WIN' : 'YOU LOSE';
    els.boardOver.classList.toggle('lose', winner !== 'me');
    els.boardOver.classList.remove('hidden');
    els.again.disabled = true;
    els.bank.disabled = true;
    disarmSurrender();
    log(winner === 'me' ? '对局结束：你获胜！' : '对局结束：对方获胜', 'important');
}

function backToSetup() {
    els.boardOver.classList.add('hidden');
    els.scoreboard.classList.add('hidden');
    els.game.classList.add('hidden');
    els.setup.classList.remove('hidden');
    state.phase = 'setup';
    state.targeting = null;
    state.lastCollect = null;
    state.warlordArmed = { me: false, ai: false };
    state.badges = { me: null, ai: null };
    renderBadges();
}

/* ── 开局 ───────────────────────── */
// 徽章开场：宣告双方佩戴 → 防御抵消 → 先机加分
function announceBadges() {
    const me = state.badges.me, ai = state.badges.ai;
    log(me ? `你佩戴「${me.name}」` : '你本局不佩戴徽章');
    log(ai ? `对方佩戴「${ai.name}」` : '对方本局未佩戴徽章');
}
function resolveDefence() {
    const me = state.badges.me, ai = state.badges.ai;
    if (me && me.type === 'defence' && ai && !ai.cancelled && TIER_RANK[me.tier] >= TIER_RANK[ai.tier]) {
        ai.cancelled = true;
        log(`你的「${me.name}」抵消了对方的「${ai.name}」！`, 'important');
    }
    if (ai && ai.type === 'defence' && me && !me.cancelled && TIER_RANK[ai.tier] >= TIER_RANK[me.tier]) {
        me.cancelled = true;
        log(`对方的「${ai.name}」抵消了你的「${me.name}」！`, 'important');
    }
}
function applyHeadstart() {
    ['me', 'ai'].forEach(who => {
        const b = state.badges[who];
        if (b && !b.cancelled && b.type === 'headstart') {
            state.scores[who] += b.amount;
            shown[who] = state.scores[who];
            log(`${who === 'me' ? '你' : '对方'}的「${b.name}」生效：开局 +<b>${b.amount}</b> 分`, 'important');
        }
    });
}

async function startGame() {
    state.scores = { me: 0, ai: 0 };
    state.turnPoints = 0;
    state.current = 'me';
    state.phase = 'await-roll';
    state.lastCollect = null;
    state.targeting = null;
    state.warlordArmed = { me: false, ai: false };
    shown.me = shown.ai = 0;
    pendingReset.me = pendingReset.ai = false;
    panels.me.clear();
    panels.ai.clear();
    els.log.innerHTML = '';
    els.selMe.textContent = '0';
    els.selAi.textContent = '0';
    els.bank.innerHTML = '<svg><use href="#i-coin"/></svg> 计分并跳过';
    els.boardOver.classList.add('hidden');
    els.setup.classList.add('hidden');
    els.game.classList.remove('hidden');
    els.scoreboard.classList.remove('hidden');
    announceBadges();
    resolveDefence();
    applyHeadstart();
    renderBadges();
    setBanner('对局开始，你先手');
    renderScores();
    setButtons();
    disarmSurrender();
    log(`对局开始，目标 <b>${state.target}</b> 分，你先手`, 'important');
    await doRoll();
}

/* ── 事件绑定 ───────────────────── */
els.targetSeg.addEventListener('click', e => {
    const btn = e.target.closest('button[data-target]');
    if (!btn) return;
    [...els.targetSeg.children].forEach(b => b.classList.toggle('active', b === btn));
    state.target = Number(btn.dataset.target);
});
els.start.addEventListener('click', () => {
    renderBadgeList();
    els.badgeModal.classList.remove('hidden');
});
els.roll.addEventListener('click', () => { if (state.phase === 'over') backToSetup(); });
els.again.addEventListener('click', onAgain);
els.bank.addEventListener('click', onBank);

/* ── 徽章按钮：按阶段分发 ────────── */
els.badge.addEventListener('click', async () => {
    if (state.phase === 'over' || state.phase === 'setup') return;
    const b = state.badges.me;
    if (!b || b.cancelled) return;
    const t = state.targeting;
    if (t) {
        // 选取模式：再点一次确认（重掷）或取消
        if (t.type === 'reroll' && t.picked.length > 0) {
            await confirmReroll();
        } else {
            exitTargeting();
        }
        return;
    }
    if (state.phase === 'bust-choice') {
        if (b.type !== 'resurrect' || b.uses <= 0) return;
        b.uses--;
        renderBadges();
        log(`你使用「${b.name}」：保住本回合 ${state.turnPoints} 分，再掷一次`, 'important');
        state.phase = 'busy';
        setBanner('复活！再次掷骰…', 'good');
        setButtons();
        await doRoll();
        return;
    }
    if (state.phase === 'pre-bank') {
        if (applyDoppel('me')) finishBank('me');
        return;
    }
    if (state.phase !== 'select') return;
    switch (b.type) {
        case 'might': {
            if (b.uses <= 0) return;
            b.uses--;
            renderBadges();
            log(`你使用「${b.name}」：本掷加一颗骰子`, 'important');
            state.phase = 'busy';
            setButtons();
            await addExtraDie('me');
            state.phase = 'select';
            panels.me.renderActive(true);
            setBanner('选取计分骰子，然后「收骰再掷」或「记分结束回合」');
            updateSelInfo();
            break;
        }
        case 'reroll':
            if (b.uses <= 0) return;
            enterTargeting({ type: 'reroll', max: b.dice, sameValue: !!b.sameValue, picked: [] });
            break;
        case 'transmute':
            if (b.uses <= 0) return;
            enterTargeting({ type: 'transmute', to: b.to });
            break;
        case 'doppel':
            applyDoppel('me');
            break;
        case 'warlord': {
            if (b.uses <= 0 || state.warlordArmed.me || state.turnPoints <= 0) return;
            b.uses--;
            state.warlordArmed.me = true;
            log(`你发动「${b.name}」：本回合记分 ×${b.mult}`, 'important');
            renderBadges();
            renderScores();
            refreshBadgeBtn();
            break;
        }
    }
});

/* ── 徽章选择弹层 ────────────────── */
function renderBadgeList() {
    els.badgeList.innerHTML = '';
    const tierTitle = { tin: '锡制徽章', silver: '银制徽章', gold: '黄金徽章' };
    ['tin', 'silver', 'gold'].forEach(tier => {
        const head = document.createElement('div');
        head.className = 'badge-tier-head';
        head.innerHTML = `<i class="tier-dot ${tier}"></i>${tierTitle[tier]}`;
        els.badgeList.appendChild(head);
        const grid = document.createElement('div');
        grid.className = 'badge-grid';
        BADGES.filter(b => b.tier === tier).forEach(def => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'badge-card';
            card.innerHTML = `<span class="b-name">${def.name}</span><span class="b-desc">${def.desc}</span>`;
            card.addEventListener('click', () => {
                state.badges.me = makeBadge(def.id);
                state.badges.ai = randomAiBadge();
                els.badgeModal.classList.add('hidden');
                startGame();
            });
            grid.appendChild(card);
        });
        els.badgeList.appendChild(grid);
    });
}
els.btnBadgeNone.addEventListener('click', () => {
    state.badges.me = null;
    state.badges.ai = randomAiBadge();
    els.badgeModal.classList.add('hidden');
    startGame();
});

// 规则弹层中的徽章一览
(function renderRulesBadges() {
    if (!els.rulesBadgeList) return;
    const tbl = document.createElement('table');
    tbl.className = 'score-table';
    tbl.innerHTML = '<thead><tr><th>徽章</th><th>效果</th></tr></thead><tbody>' +
        BADGES.map(b => `<tr><td>${b.name}</td><td>${b.desc}</td></tr>`).join('') +
        '</tbody>';
    els.rulesBadgeList.appendChild(tbl);
})();

/* ── 投降：两次点击确认，避免误触 ── */
const SURRENDER_HTML = '<svg><use href="#i-shield"/></svg> 投降';
const SURRENDER_ARMED_HTML = '<svg><use href="#i-shield"/></svg> 确认投降？';
let surrenderArmed = false;
let surrenderTimer = 0;
function disarmSurrender() {
    clearTimeout(surrenderTimer);
    surrenderArmed = false;
    els.surrender.innerHTML = SURRENDER_HTML;
}
els.surrender.addEventListener('click', () => {
    if (state.phase === 'over' || state.phase === 'setup') return;
    if (!surrenderArmed) {
        surrenderArmed = true;
        els.surrender.innerHTML = SURRENDER_ARMED_HTML;
        surrenderTimer = setTimeout(disarmSurrender, 3000);
        return;
    }
    disarmSurrender();
    log('你选择投降', 'bust');
    finishGame('ai');
});
els.btnRules.addEventListener('click', () => els.rulesModal.classList.remove('hidden'));
els.btnCloseRules.addEventListener('click', () => els.rulesModal.classList.add('hidden'));
els.rulesModal.addEventListener('click', e => {
    if (e.target === els.rulesModal) els.rulesModal.classList.add('hidden');
});

// 控制台/测试钩子
window.__farkle = {
    state, panels, shown, scoreValues, takeGroups, hasAnyScore, scoreDetail, fxFor,
    layoutPositions, rollGeom, rollAnimation, finishGame,
    BADGES, makeBadge, renderBadges, refreshBadgeBtn, resolveBust, addExtraDie, applyDoppel,
};
