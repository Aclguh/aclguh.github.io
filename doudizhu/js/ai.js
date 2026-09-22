'use strict';

/* ── AI：叫分与出牌决策 ───────────────────── */

// 单张牌的价值权重，越大越舍不得出
function cardWeight(r) {
    if (r >= JOKER_S) return 45;
    if (r === 15) return 26;
    if (r === 14) return 17;
    return r;
}

// 是否为队友（两个农民互为队友）
function isTeammate(a, b, landlord) {
    return a !== b && a !== landlord && b !== landlord;
}

// 对手中剩余牌最少的一家
function opponentMin(ctx) {
    const seats = [0, 1, 2].filter(s => s !== ctx.seat && !isTeammate(ctx.seat, s, ctx.landlord));
    return Math.min(...seats.map(s => ctx.counts[s]));
}

/* ── 叫分 ───────────────────── */

function handStrength(hand) {
    const counts = countsOf(hand);
    let s = 0;
    if (counts.get(JOKER_B)) s += 8;
    if (counts.get(JOKER_S)) s += 5;
    s += 3 * (counts.get(15) || 0);
    s += (counts.get(14) || 0);
    counts.forEach(c => { if (c === 4) s += 8; });
    return s;
}

// 返回 0（不叫）或 1/2/3；只能叫比 current 更高的分
function aiBid(hand, current) {
    const s = handStrength(hand);
    const want = s >= 20 ? 3 : s >= 15 ? 2 : s >= 11 ? 1 : 0;
    return want > current ? want : 0;
}

/* ── 出牌代价评估 ───────────────────── */

// 出这手牌的代价：越小越愿意出（负数表示赚了，因为甩掉了牌）
function playCost(byRank, c) {
    const used = countsOf(c.cards);
    const main = new Set(mainRanks(c));
    let mainW = 0, wingW = 0;
    used.forEach((n, r) => {
        const w = cardWeight(r) * n;
        if (main.has(r)) mainW += w; else wingW += w;
    });

    let penalty = 0;
    if (c.type === 'bomb') penalty += 90;
    if (c.type === 'rocket') penalty += 200;
    used.forEach((n, r) => {
        const have = byRank.get(r).length;
        if (have === 4 && n < 4) penalty += 130;                      // 拆炸弹
        else if (have === 3 && n < 3 && (c.type === 'single' || c.type === 'pair')) penalty += 22;
    });

    return mainW + wingW * 0.4 + penalty - 11 * c.cards.length;
}

// 去掉 used 之后的剩余手牌索引
function restIndex(byRank, used) {
    const ids = new Set(used.map(c => c.id));
    const rest = [];
    byRank.forEach(list => list.forEach(c => { if (!ids.has(c.id)) rest.push(c); }));
    return makeIndex(rest);
}

// 出完这手牌后，剩下的能否一次打完
function canFinishInOne(byRank, used) {
    const ri = restIndex(byRank, used);
    const n = indexSize(ri);
    if (n === 0) return true;
    return listLeads(ri).some(o => o.cards.length === n);
}

/* ── 决策 ───────────────────── */

// threshold：跟牌意愿倍率（越大越肯拆大牌）；blunder：随机失误概率
const LEVELS = {
    easy: { threshold: 0.55, blunder: 0.3 },
    normal: { threshold: 1, blunder: 0.08 },
    hard: { threshold: 1.45, blunder: 0 }
};

// ctx = { seat, landlord, counts:[3家剩余张数], target:combo|null, targetSeat:number, level }
// 返回要出的 combo，或 null 表示不出（过）
function aiDecide(hand, ctx) {
    const byRank = makeIndex(hand);
    const lv = LEVELS[ctx.level] || LEVELS.normal;

    // 失误：随手抓一个合法出法（跟牌时也可能直接过掉）
    if (lv.blunder > 0 && Math.random() < lv.blunder) {
        const opts = ctx.target ? listBeats(byRank, ctx.target) : listLeads(byRank);
        if (opts.length) {
            if (ctx.target && Math.random() < 0.4) return null;
            return opts[Math.floor(Math.random() * opts.length)];
        }
    }
    return ctx.target ? pickBeat(byRank, hand.length, ctx, lv) : pickLead(byRank, hand.length, ctx);
}

// 我是否为农民；我出完牌后下一个是不是地主（即「地主上家」，需要顶牌）
function roleOf(ctx) {
    const farmer = ctx.seat !== ctx.landlord;
    return { farmer, beforeLandlord: ((ctx.seat + 1) % 3) === ctx.landlord };
}

function pickLead(byRank, size, ctx) {
    const opts = listLeads(byRank);
    if (!opts.length) return null;
    const finish = opts.find(o => o.cards.length === size);
    if (finish) return finish;
    if (size === 2) {
        // 剩两张散牌：先出大的，把小的留作最后一手
        return opts.filter(o => o.type === 'single').reduce((a, b) => (a.rank >= b.rank ? a : b));
    }

    const oppMin = opponentMin(ctx);
    const urgent = oppMin <= 2;
    const role = roleOf(ctx);
    // 地主上家首出小单张/小对子等于白送地主牌权，改出更大的牌顶住
    const block = role.farmer && role.beforeLandlord && !urgent;

    let best = null, bestScore = Infinity;
    for (const o of opts) {
        let s = playCost(byRank, o);
        if (block && (o.type === 'single' || o.type === 'pair') && o.rank < 11) s += 18;
        if (urgent) {
            const isBomb = o.type === 'bomb' || o.type === 'rocket';
            // 对手马上走完：优先出大牌压制，能顺势走完才开炸
            if (isBomb && !canFinishInOne(byRank, o.cards)) s += 500;
            else s -= 2.2 * cardWeight(o.rank);
        }
        if (s < bestScore) { bestScore = s; best = o; }
    }
    return best;
}

function pickBeat(byRank, size, ctx, lv) {
    const opts = listBeats(byRank, ctx.target);
    if (!opts.length) return null;
    const finish = opts.find(o => o.cards.length === size);
    if (finish) return finish;

    const bombs = opts.filter(o => o.type === 'bomb' || o.type === 'rocket');
    let pool = opts.filter(o => o.type !== 'bomb' && o.type !== 'rocket');
    const oppMin = opponentMin(ctx);
    const urgent = oppMin <= 2;
    const pressure = oppMin <= 5;
    const role = roleOf(ctx);

    // 队友出的牌：让队友掌权，除非能一把走完，或队友牌还很多而我方代价极低
    if (ctx.targetSeat >= 0 && isTeammate(ctx.seat, ctx.targetSeat, ctx.landlord)) {
        if (ctx.counts[ctx.targetSeat] <= 3) return null;
        const cheap = pool.filter(o => o.type === ctx.target.type && o.rank <= 11 && playCost(byRank, o) < 0);
        if (!cheap.length) return null;
        return cheap.reduce((a, b) => (playCost(byRank, a) <= playCost(byRank, b) ? a : b));
    }

    let threshold = 16 * lv.threshold;
    if (pressure) threshold = 30 * lv.threshold;
    if (urgent) threshold = Infinity;

    // 地主上家跟牌：压完立刻轮到地主，出小牌等于把牌权送回去，只顶大牌
    if (role.farmer && role.beforeLandlord && !urgent) {
        pool = pool.filter(o => o.rank >= 10);
        if (!pool.length) return null;
    }

    let best = null, bestScore = Infinity;
    for (const o of pool) {
        let s = playCost(byRank, o);
        if (urgent) s -= 1.6 * cardWeight(o.rank);   // 拦截时宁可用大牌
        if (s < bestScore) { bestScore = s; best = o; }
    }
    if (best && bestScore <= threshold) return best;

    // 炸弹只在有收益时开：对手快走完，或炸完自己能一口气走完
    if (bombs.length && (urgent || pressure)) {
        const usable = bombs.filter(o => o.type === 'rocket' || oppMin <= 3 || canFinishInOne(byRank, o.cards));
        if (usable.length) return usable.reduce((a, b) => (playCost(byRank, a) <= playCost(byRank, b) ? a : b));
    }
    return null;
}

/* ── 玩家「提示」用：同牌型同点数只留代价最低的一种，再按代价排序 ───────────────────── */

function hintOptions(hand, target) {
    const byRank = makeIndex(hand);
    const opts = target ? listBeats(byRank, target) : listLeads(byRank);
    const best = new Map();
    opts.forEach(o => {
        const key = o.type + ':' + o.rank + ':' + o.length;
        const prev = best.get(key);
        if (!prev || playCost(byRank, o) < playCost(byRank, prev)) best.set(key, o);
    });
    return Array.from(best.values()).sort((a, b) => playCost(byRank, a) - playCost(byRank, b));
}
