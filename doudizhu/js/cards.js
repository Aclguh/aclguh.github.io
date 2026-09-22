'use strict';

/* ── 基础定义 ───────────────────── */

// 牌面点数：3~10 原值，J=11 Q=12 K=13 A=14 2=15 小王=16 大王=17
const SUITS = ['♠', '♥', '♣', '♦'];
const JOKER_S = 16;
const JOKER_B = 17;
const RANK_TEXT = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2', 16: '小王', 17: '大王' };
const TYPE_TEXT = {
    single: '单张',
    pair: '对子',
    triple: '三张',
    triple_single: '三带一',
    triple_pair: '三带二',
    straight: '顺子',
    pair_straight: '连对',
    plane: '飞机',
    plane_single: '飞机带单',
    plane_pair: '飞机带对',
    four_two_single: '四带二',
    four_two_pair: '四带二对',
    bomb: '炸弹',
    rocket: '王炸'
};
// 主牌张数固定的牌型（其余为连续型）
const MAIN_TYPES = ['single', 'pair', 'triple', 'triple_single', 'triple_pair', 'four_two_single', 'four_two_pair'];

function rankText(r) { return RANK_TEXT[r] || String(r); }
function typeText(t) { return TYPE_TEXT[t] || t; }

function buildDeck() {
    const deck = [];
    let id = 0;
    for (let r = 3; r <= 15; r++) {
        for (const s of SUITS) deck.push({ id: id++, rank: r, suit: s });
    }
    deck.push({ id: id++, rank: JOKER_S, suit: 'X' });
    deck.push({ id: id++, rank: JOKER_B, suit: 'D' });
    return deck;
}

function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function sortCards(cards) {
    return cards.slice().sort((a, b) => b.rank - a.rank || SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit));
}

function countsOf(cards) {
    const m = new Map();
    cards.forEach(c => m.set(c.rank, (m.get(c.rank) || 0) + 1));
    return m;
}

// length = 同牌型比较用的「长度单位」：单/对/三/带牌类/炸弹恒为 1，顺子为张数，连对为对数，飞机为三张段数
function combo(type, rank, length, cards) {
    return { type, rank, length, cards: sortCards(cards) };
}

/* ── 牌型识别 ───────────────────── */

// 判断一组牌是否为合法牌型，非法返回 null
function identify(cards) {
    const n = cards.length;
    if (n === 0) return null;
    const counts = countsOf(cards);
    const ranks = Array.from(counts.keys()).sort((a, b) => a - b);
    const cnts = ranks.map(r => counts.get(r));

    if (n === 2 && counts.get(JOKER_S) === 1 && counts.get(JOKER_B) === 1) return combo('rocket', 100, 2, cards);
    if (n === 4 && ranks.length === 1) return combo('bomb', ranks[0], 1, cards);
    if (n === 1) return combo('single', ranks[0], 1, cards);
    if (n === 2) return ranks.length === 1 ? combo('pair', ranks[0], 1, cards) : null;
    if (n === 3) return ranks.length === 1 ? combo('triple', ranks[0], 1, cards) : null;

    // 连续型：点数递增 1 且不超过 A
    const consecutive = ranks.length >= 2
        && ranks.every((r, i) => i === 0 || r - ranks[i - 1] === 1)
        && ranks[ranks.length - 1] <= 14;
    if (consecutive) {
        if (n >= 5 && cnts.every(c => c === 1)) return combo('straight', ranks[0], n, cards);
        if (n >= 6 && cnts.every(c => c === 2)) return combo('pair_straight', ranks[0], n / 2, cards);
        if (n >= 6 && cnts.every(c => c === 3)) return combo('plane', ranks[0], n / 3, cards);
    }

    if (n === 4) {
        const t = ranks.find(r => counts.get(r) === 3);
        if (t !== undefined) return combo('triple_single', t, 1, cards);
        return null;
    }
    if (n === 5) {
        const t = ranks.find(r => counts.get(r) === 3);
        if (t !== undefined) {
            const rest = ranks.filter(r => r !== t);
            if (rest.length === 1 && counts.get(rest[0]) === 2) return combo('triple_pair', t, 1, cards);
        }
        return null;
    }

    // 飞机带翅膀：3k 张主牌 + k 张单翅膀(4k) 或 k 个对翅膀(5k)
    for (const wing of [1, 2]) {
        for (let k = 2; k <= 6; k++) {
            if (3 * k + wing * k !== n) continue;
            for (const run of listTripleRuns(counts, k)) {
                const rest = removeRun(cards, run);
                if (wing === 2) {
                    const rc = countsOf(rest);
                    if (Array.from(rc.values()).some(c => c % 2 !== 0)) continue;
                }
                return combo(wing === 1 ? 'plane_single' : 'plane_pair', run[0], k, cards);
            }
        }
    }

    // 四带二
    const four = ranks.find(r => counts.get(r) === 4);
    if (four !== undefined) {
        const others = ranks.filter(r => r !== four);
        if (n === 6) return combo('four_two_single', four, 1, cards);
        if (n === 8 && others.length === 2 && others.every(r => counts.get(r) === 2)) {
            return combo('four_two_pair', four, 1, cards);
        }
    }
    return null;
}

// 列出所有长度为 k、点数连续且不超过 A 的三张组合段
function listTripleRuns(counts, k) {
    const pool = Array.from(counts.keys()).filter(r => r <= 14 && counts.get(r) >= 3).sort((a, b) => a - b);
    const runs = [];
    for (let i = 0; i + k <= pool.length; i++) {
        const run = pool.slice(i, i + k);
        if (run[k - 1] - run[0] === k - 1) runs.push(run);
    }
    return runs;
}

// 从牌组中移除三张一组的连续段，返回剩余牌（用于取翅膀）
function removeRun(cards, run) {
    const left = cards.slice();
    run.forEach(r => {
        for (let i = 0; i < 3; i++) {
            const idx = left.findIndex(c => c.rank === r);
            if (idx >= 0) left.splice(idx, 1);
        }
    });
    return left;
}

// 主牌点数集合（翅膀不算）
function mainRanks(c) {
    if (MAIN_TYPES.includes(c.type)) return [c.rank];
    const out = [];
    for (let i = 0; i < c.length; i++) out.push(c.rank + i);
    return out;
}

/* ── 比牌 ───────────────────── */

// a 是否能压过 b（b 为 null 表示自由出牌）
function beats(a, b) {
    if (!a) return false;
    if (!b) return true;
    if (a.type === 'rocket') return true;
    if (b.type === 'rocket') return false;
    if (a.type === 'bomb') return b.type !== 'bomb' || a.rank > b.rank;
    if (b.type === 'bomb') return false;
    return a.type === b.type && a.length === b.length && a.rank > b.rank;
}

/* ── 手牌索引 ───────────────────── */

// rank -> 该点数的牌（按花色排序），枚举候选时用
function makeIndex(hand) {
    const byRank = new Map();
    sortCards(hand).forEach(c => {
        if (!byRank.has(c.rank)) byRank.set(c.rank, []);
        byRank.get(c.rank).push(c);
    });
    return byRank;
}

function indexRanks(byRank) {
    return Array.from(byRank.keys()).sort((a, b) => a - b);
}

function indexSize(byRank) {
    let n = 0;
    byRank.forEach(v => { n += v.length; });
    return n;
}

function takeRank(byRank, r, k) {
    return byRank.get(r).slice(0, k);
}

function hasRun(byRank, start, len, need) {
    for (let i = 0; i < len; i++) {
        const r = start + i;
        if (r > 14) return false;
        const g = byRank.get(r);
        if (!g || g.length < need) return false;
    }
    return true;
}

function collectRun(byRank, start, len, need) {
    const out = [];
    for (let i = 0; i < len; i++) out.push(...takeRank(byRank, start + i, need));
    return out;
}

// 挑最"不值钱"的 k 张带牌；needPair=true 时挑 k 个对子
function pickFiller(byRank, exclude, k, needPair) {
    const skip = new Set(exclude);
    const cost = r => {
        const c = byRank.get(r).length;
        let p = r >= 16 ? r + 28 : r;          // 王尽量留下
        if (r === 15) p += 12;                  // 2 尽量留下
        if (!needPair) {
            if (c === 4) p += 120;
            else if (c === 3) p += 55;
            else if (c === 2) p += 18;
        } else if (c === 4) {
            p += 120;
        } else if (c === 3) {
            p += 30;
        }
        return p;
    };
    const pool = indexRanks(byRank).filter(r => !skip.has(r) && byRank.get(r).length >= (needPair ? 2 : 1));
    pool.sort((a, b) => cost(a) - cost(b));
    if (pool.length < k) return null;
    const out = [];
    pool.slice(0, k).forEach(r => out.push(...takeRank(byRank, r, needPair ? 2 : 1)));
    return out;
}

/* ── 候选枚举 ───────────────────── */

// 枚举所有能压过 target 的出法（含炸弹/王炸）
function listBeats(byRank, target) {
    const out = [];
    if (!target) return out;
    const ranks = indexRanks(byRank);
    const cnt = r => (byRank.get(r) ? byRank.get(r).length : 0);
    const push = (type, rank, length, cards) => { if (cards) out.push(combo(type, rank, length, cards)); };

    switch (target.type) {
        case 'single':
            ranks.filter(r => r > target.rank).forEach(r => push('single', r, 1, takeRank(byRank, r, 1)));
            break;
        case 'pair':
            ranks.filter(r => r > target.rank && cnt(r) >= 2)
                .forEach(r => push('pair', r, 1, takeRank(byRank, r, 2)));
            break;
        case 'triple':
            ranks.filter(r => r > target.rank && cnt(r) >= 3)
                .forEach(r => push('triple', r, 1, takeRank(byRank, r, 3)));
            break;
        case 'triple_single':
        case 'triple_pair': {
            const needPair = target.type === 'triple_pair';
            ranks.filter(r => r > target.rank && cnt(r) >= 3).forEach(r => {
                const fill = pickFiller(byRank, [r], 1, needPair);
                push(target.type, r, 1, fill ? takeRank(byRank, r, 3).concat(fill) : null);
            });
            break;
        }
        case 'straight': {
            const L = target.length;
            for (let s = target.rank + 1; s + L - 1 <= 14; s++) {
                if (hasRun(byRank, s, L, 1)) push('straight', s, L, collectRun(byRank, s, L, 1));
            }
            break;
        }
        case 'pair_straight': {
            const L = target.length;
            for (let s = target.rank + 1; s + L - 1 <= 14; s++) {
                if (hasRun(byRank, s, L, 2)) push('pair_straight', s, L, collectRun(byRank, s, L, 2));
            }
            break;
        }
        case 'plane':
        case 'plane_single':
        case 'plane_pair': {
            const k = target.length;
            const wing = target.type === 'plane' ? 0 : (target.type === 'plane_single' ? 1 : 2);
            for (let s = target.rank + 1; s + k - 1 <= 14; s++) {
                if (!hasRun(byRank, s, k, 3)) continue;
                const run = collectRun(byRank, s, k, 3);
                if (wing === 0) { push('plane', s, k, run); continue; }
                const skip = [];
                for (let i = 0; i < k; i++) skip.push(s + i);
                const fill = pickFiller(byRank, skip, k, wing === 2);
                push(wing === 1 ? 'plane_single' : 'plane_pair', s, k, fill ? run.concat(fill) : null);
            }
            break;
        }
        case 'four_two_single':
        case 'four_two_pair': {
            const needPair = target.type === 'four_two_pair';
            ranks.filter(r => r > target.rank && cnt(r) >= 4).forEach(r => {
                const fill = pickFiller(byRank, [r], 2, needPair);
                push(target.type, r, 1, fill ? takeRank(byRank, r, 4).concat(fill) : null);
            });
            break;
        }
        default:
            break;
    }

    // 炸弹与王炸：只有 target 不是更大的炸弹时才可压
    if (target.type !== 'rocket') {
        ranks.filter(r => cnt(r) === 4 && (target.type !== 'bomb' || r > target.rank))
            .forEach(r => push('bomb', r, 1, takeRank(byRank, r, 4)));
        if (cnt(JOKER_S) >= 1 && cnt(JOKER_B) >= 1) {
            push('rocket', 100, 2, takeRank(byRank, JOKER_S, 1).concat(takeRank(byRank, JOKER_B, 1)));
        }
    }
    return out;
}

// 枚举自由出牌时所有合法出法
function listLeads(byRank) {
    const out = [];
    const ranks = indexRanks(byRank);
    const cnt = r => (byRank.get(r) ? byRank.get(r).length : 0);
    const push = (type, rank, length, cards) => { if (cards) out.push(combo(type, rank, length, cards)); };

    ranks.forEach(r => {
        push('single', r, 1, takeRank(byRank, r, 1));
        if (cnt(r) >= 2) push('pair', r, 1, takeRank(byRank, r, 2));
        if (cnt(r) >= 3) {
            push('triple', r, 1, takeRank(byRank, r, 3));
            const f1 = pickFiller(byRank, [r], 1, false);
            push('triple_single', r, 1, f1 ? takeRank(byRank, r, 3).concat(f1) : null);
            const f2 = pickFiller(byRank, [r], 1, true);
            push('triple_pair', r, 1, f2 ? takeRank(byRank, r, 3).concat(f2) : null);
        }
        if (cnt(r) === 4) {
            push('bomb', r, 1, takeRank(byRank, r, 4));
            const fs = pickFiller(byRank, [r], 2, false);
            push('four_two_single', r, 1, fs ? takeRank(byRank, r, 4).concat(fs) : null);
            const fp = pickFiller(byRank, [r], 2, true);
            push('four_two_pair', r, 1, fp ? takeRank(byRank, r, 4).concat(fp) : null);
        }
    });

    for (let L = 5; L <= 12; L++) {
        for (let s = 3; s + L - 1 <= 14; s++) {
            if (hasRun(byRank, s, L, 1)) push('straight', s, L, collectRun(byRank, s, L, 1));
        }
    }
    for (let L = 3; L <= 10; L++) {
        for (let s = 3; s + L - 1 <= 14; s++) {
            if (hasRun(byRank, s, L, 2)) push('pair_straight', s, L, collectRun(byRank, s, L, 2));
        }
    }

    // 飞机：连续三张段，长度 2~6
    const tripleRanks = ranks.filter(r => r <= 14 && cnt(r) >= 3);
    for (let k = 2; k <= 6; k++) {
        for (let i = 0; i + k <= tripleRanks.length; i++) {
            const run = tripleRanks.slice(i, i + k);
            if (run[k - 1] - run[0] !== k - 1) continue;
            const s = run[0];
            const main = collectRun(byRank, s, k, 3);
            push('plane', s, k, main);
            const f1 = pickFiller(byRank, run, k, false);
            push('plane_single', s, k, f1 ? main.concat(f1) : null);
            const f2 = pickFiller(byRank, run, k, true);
            push('plane_pair', s, k, f2 ? main.concat(f2) : null);
        }
    }

    if (cnt(JOKER_S) >= 1 && cnt(JOKER_B) >= 1) {
        push('rocket', 100, 2, takeRank(byRank, JOKER_S, 1).concat(takeRank(byRank, JOKER_B, 1)));
    }
    return out;
}
