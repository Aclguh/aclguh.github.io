'use strict';

/* ── 计分规则 ───────────────────── */

// 校验一组骰面是否全部参与计分，返回 {score, valid}
function scoreValues(values) {
    if (values.length === 0) return { score: 0, valid: false };
    const counts = [0, 0, 0, 0, 0, 0, 0];
    values.forEach(v => counts[v]++);
    if (values.length === 6 && counts.slice(1).every(c => c === 1)) {
        return { score: 1500, valid: true };
    }
    let score = 0;
    for (let v = 1; v <= 6; v++) {
        let c = counts[v];
        if (c >= 3) {
            const base = v === 1 ? 1000 : v * 100;
            score += base * Math.pow(2, c - 3);
            c = 0;
        }
        if (c > 0) {
            if (v === 1) score += c * 100;
            else if (v === 5) score += c * 50;
            else return { score: 0, valid: false };
        }
    }
    return { score, valid: score > 0 };
}

// 一次掷骰是否存在任何可计分的骰子
function hasAnyScore(values) {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    values.forEach(v => counts[v]++);
    if (values.length === 6 && counts.slice(1).every(c => c === 1)) return true;
    return counts[1] > 0 || counts[5] > 0 || counts.some(c => c >= 3);
}

// 把一次掷骰的可计分骰子拆成「组合」（顺子 / 三同及以上，quick）与「单颗」（1、5，slow）
function takeGroups(values) {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    values.forEach(v => counts[v]++);
    if (values.length === 6 && counts.slice(1).every(c => c === 1)) {
        return [{ indices: values.map((_, i) => i), quick: true }];
    }
    const groups = [];
    for (let v = 1; v <= 6; v++) {
        if (counts[v] >= 3) {
            const idx = [];
            values.forEach((val, i) => { if (val === v) idx.push(i); });
            groups.push({ indices: idx, quick: true });
        }
    }
    [1, 5].forEach(v => {
        if (counts[v] > 0 && counts[v] < 3) {
            values.forEach((val, i) => {
                if (val === v) groups.push({ indices: [i], quick: false });
            });
        }
    });
    return groups;
}

// 计分来源描述：列出本次得分的组合与分值（规则与 scoreValues 一致）
function scoreDetail(values) {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    values.forEach(v => counts[v]++);
    if (values.length === 6 && counts.slice(1).every(c => c === 1)) {
        return '顺子1-6 1500';
    }
    const names = { 3: '三同', 4: '四同', 5: '五同', 6: '六同' };
    const parts = [];
    for (let v = 1; v <= 6; v++) {
        let c = counts[v];
        if (c >= 3) {
            const base = v === 1 ? 1000 : v * 100;
            parts.push(`${names[c]}${v} ${base * Math.pow(2, c - 3)}`);
            c = 0;
        }
        if (c > 0 && (v === 1 || v === 5)) {
            const unit = v === 1 ? 100 : 50;
            parts.push(c === 1 ? `单${v} ${unit}` : `${v}×${c} ${unit * c}`);
        }
    }
    return parts.join(' ＋ ');
}

const rollDie = () => 1 + Math.floor(Math.random() * 6);
const delay = ms => new Promise(r => setTimeout(r, ms));

/* ── DOM ────────────────────────── */
const $ = id => document.getElementById(id);
const els = {
    setup: $('setup-panel'), game: $('game-panel'),
    targetSeg: $('target-seg'), start: $('btn-start'),
    scoreMe: $('score-me'), scoreAi: $('score-ai'), scoreTarget: $('score-target'),
    hintMe: $('hint-me'), hintAi: $('hint-ai'),
    turnMe: $('turn-me'), turnAi: $('turn-ai'),
    boxMe: $('box-me'), boxAi: $('box-ai'),
    banner: $('table-banner'), selInfo: $('sel-info'), log: $('log'),
    boardOver: $('board-over'),
    roll: $('btn-roll'), again: $('btn-again'), bank: $('btn-bank'),
    rulesModal: $('rules-modal'), btnRules: $('btn-rules'), btnCloseRules: $('btn-close-rules'),
};

/* ── 状态 ───────────────────────── */
const state = {
    target: 2000,
    phase: 'setup', // setup | await-roll | select | busy | ai | over
    current: 'me',  // me | ai
    scores: { me: 0, ai: 0 },
    turnPoints: 0,
    nextId: 1,
};
// 已显示（计分浮动提示结束后才更新）
const shown = { me: 0, ai: 0 };
// 每个面板在下一次该方掷骰前清空
const pendingReset = { me: false, ai: false };

/* ── 场地几何 ───────────────────── */
const dieSize = () => (window.innerWidth <= 600 ? 46 : 56);
const parkW = () => (window.innerWidth <= 600 ? 64 : 76);

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
        this.ring = document.createElement('div');
        this.ring.className = 'roll-ring';
        this.field.appendChild(this.ring);
    }

    // 停放区第 i 个槽位：玩家在右侧、人机在左侧，均自上而下竖排
    parkPos(i) {
        const s = dieSize(), pw = parkW();
        const H = this.field.clientHeight;
        const vis = s * 0.62;
        const step = Math.min(Math.round(s * 0.5), Math.max(11, (H - 20 - vis - 4) / 5));
        return {
            x: this.flipped ? (pw - s) / 2 + 2 : this.field.clientWidth - pw + (pw - s) / 2,
            y: Math.round(20 + i * step),
        };
    }

    dieEl(id) {
        return this.diceLayer.querySelector(`[data-id="${id}"]`);
    }

    renderActive(selectable) {
        this.diceLayer.innerHTML = '';
        this.dice.forEach(d => {
            const el = makeDieEl(d);
            if (d.selected) el.classList.add('selected');
            if (selectable) {
                el.classList.add('selectable');
                el.addEventListener('click', () => toggleSelect(d.id, this));
            }
            this.diceLayer.appendChild(el);
        });
    }

    clear() {
        this.dice = [];
        this.parked = [];
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

/* ── 投掷区几何（散落范围 / 环） ── */
function rollGeom(panel) {
    const s = dieSize(), pw = parkW();
    const W = panel.field.clientWidth, H = panel.field.clientHeight;
    const xMin = (panel.flipped ? pw + 4 : 6) + s / 2;
    const xMax = (panel.flipped ? W - 6 : W - pw - 4) - s / 2;
    const yMin = 12 + s / 2;
    const yMax = H - 8 - s / 2;
    return {
        s, xMin, xMax, yMin, yMax,
        cx: (xMin + xMax) / 2,
        cy: (yMin + yMax) / 2,
        R: Math.max(s * 0.85, Math.min(W, H) * 0.30),
    };
}

// 结果分布：优先从圆心向外径向散发；若可用区域过窄无法避免重叠，
// 则改用网格播种 —— 两者都会经过松弛迭代，保证结果骰子互不重叠
function layoutPositions(panel, n) {
    const g = rollGeom(panel);
    const minD = g.s * 1.06;
    const W = g.xMax - g.xMin, H = g.yMax - g.yMin;

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
                p.x = Math.min(g.xMax, Math.max(g.xMin, p.x));
                p.y = Math.min(g.yMax, Math.max(g.yMin, p.y));
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
    const inBox = p => p.x >= g.xMin && p.x <= g.xMax && p.y >= g.yMin && p.y <= g.yMax;

    // 方案 A：径向螺旋（由圆心向外散发）
    const golden = 2.39996;
    const maxR = Math.max(g.s * 0.8, Math.hypot(W / 2, H / 2) * 0.72);
    const radial = [];
    for (let i = 0; i < n; i++) {
        const r = n === 1 ? 0 : maxR * Math.sqrt((i + 0.5) / n);
        const a = i * golden + (Math.random() - 0.5) * 0.7;
        radial.push({ x: g.cx + Math.cos(a) * r, y: g.cy + Math.sin(a) * r });
    }
    relax(radial, 80);
    if (radial.every(inBox) && minPair(radial) >= minD - 0.5) {
        return radial.map(p => ({ x: p.x - g.s / 2, y: p.y - g.s / 2 }));
    }

    // 方案 B：网格播种（窄区域下保证可分离），带随机抖动后松弛
    let best = null;
    for (let cols = 1; cols <= n; cols++) {
        const rows = Math.ceil(n / cols);
        const cellW = W / cols, cellH = H / rows;
        if (cellW < g.s * 0.98 || cellH < g.s * 0.98) continue;
        const ratio = Math.abs(cellW - cellH) / Math.max(cellW, cellH);
        if (!best || ratio < best.ratio) best = { cols, rows, cellW, cellH, ratio };
    }
    if (!best) best = { cols: n, rows: 1, cellW: W / n, cellH: H };
    const grid = [];
    for (let i = 0; i < n; i++) {
        const r = Math.floor(i / best.cols);
        const c = i % best.cols;
        const m = Math.min(best.cols, n - r * best.cols);
        const off = (best.cols - m) * best.cellW / 2;
        grid.push({
            x: g.xMin + off + (c + 0.5) * best.cellW + (Math.random() - 0.5) * best.cellW * 0.3,
            y: g.yMin + (r + 0.5) * best.cellH + (Math.random() - 0.5) * best.cellH * 0.3,
        });
    }
    relax(grid, 140);
    return grid.map(p => ({ x: p.x - g.s / 2, y: p.y - g.s / 2 }));
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
                // 环壁碰撞：无损反射，速率不衰减
                const dx = o.x - g.cx, dy = o.y - g.cy;
                const dist = Math.hypot(dx, dy) || 0.01;
                const lim = g.R - g.s * 0.34;
                if (dist > lim) {
                    const nx = dx / dist, ny = dy / dist;
                    const dot = o.vx * nx + o.vy * ny;
                    if (dot > 0) {
                        o.vx -= 2 * dot * nx;
                        o.vy -= 2 * dot * ny;
                        o.vr += (Math.random() * 2 - 1) * 0.2;
                        flashRing(panel);
                    }
                    o.x = g.cx + nx * lim;
                    o.y = g.cy + ny * lim;
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
    for (let i = 1; i <= 9; i++) {
        const pip = document.createElement('span');
        pip.className = 'pip p' + i;
        el.appendChild(pip);
    }
    placeDie(el, die);
    return el;
}

function placeDie(el, die) {
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
    const turnText = state.turnPoints > 0 ? `本回合 +${state.turnPoints}` : '';
    const live = state.phase !== 'over' && state.phase !== 'setup';
    els.turnMe.textContent = live && state.current === 'me' ? turnText : '';
    els.turnAi.textContent = live && state.current === 'ai' ? turnText : '';
    els.boxMe.classList.toggle('on-turn', live && state.current === 'me');
    els.boxAi.classList.toggle('on-turn', live && state.current === 'ai');
}

function updateSelInfo() {
    const sel = panels.me.dice.filter(d => d.selected).map(d => d.value);
    const { score, valid } = scoreValues(sel);
    if (sel.length === 0) {
        els.selInfo.textContent = '未选取骰子 — 点击骰子选取计分组合';
        els.selInfo.className = 'sel-info';
    } else if (!valid) {
        els.selInfo.textContent = '所选骰子无法全部计分，请调整选择';
        els.selInfo.className = 'sel-info bad';
    } else {
        els.selInfo.innerHTML = `已选 <b>${sel.length}</b> 颗，计 <b>${score}</b> 分`;
        els.selInfo.className = 'sel-info';
    }
    const canAct = state.phase === 'select' && valid;
    els.again.disabled = !canAct;
    els.bank.disabled = !canAct;
}

function setButtons() {
    els.roll.disabled = !(state.phase === 'await-roll' && state.current === 'me');
    if (state.phase !== 'select') {
        els.again.disabled = true;
        els.bank.disabled = true;
    }
}

/* ── 停放（所有选中骰子一次性平移） ─ */
function parkDice(panel, dice) {
    dice.forEach(d => {
        d.parked = true;
        d.selected = false;
        panel.parked.push(d);
        const p = panel.parkPos(panel.parked.length - 1);
        d.x = p.x;
        d.y = p.y;
        d.rot = 0;
        d.scale = 0.62;
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

// 6 颗全部收起 → 热骰，清空停放区重新掷满
function checkHotDice(panel) {
    if (panel.parked.length !== 6) return;
    panel.parked = [];
    panel.parkLayer.innerHTML = '';
    log('六颗骰子全部计分，触发<b>热骰</b>：重新掷满 6 颗', 'important');
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
    if (pendingReset[state.current]) {
        panel.clear();
        pendingReset[state.current] = false;
    }
    state.phase = 'busy';
    setButtons();
    const count = 6 - panel.parked.length;
    panel.dice = Array.from({ length: count }, () => ({
        id: state.nextId++, value: rollDie(), selected: false,
        x: 0, y: 0, rot: 0, scale: 1,
    }));
    setBanner(state.current === 'me' ? '掷骰中…' : '对方掷骰中…');
    const values = panel.dice.map(d => d.value);
    await rollAnimation(panel, values);

    const who = state.current === 'me' ? '你' : '对方';
    log(`${who}掷出 ${values.join('、')}`);

    if (!hasAnyScore(values)) {
        const lost = state.turnPoints;
        state.turnPoints = 0;
        log(`${who}爆骰！本回合 ${lost} 分作废`, 'bust');
        setBanner(`${who}爆骰，回合结束`, 'warn');
        renderScores();
        await delay(1400);
        endTurn();
        return;
    }
    if (state.current === 'me') {
        state.phase = 'select';
        panel.renderActive(true);
        setBanner('选取计分骰子，然后「收骰再掷」或「记分结束回合」');
        updateSelInfo();
    } else {
        state.phase = 'ai';
    }
    setButtons();
}

/* ── 玩家回合 ───────────────────── */
// 把玩家所选骰子计分并一次性停放到右侧（同时记录得分来源），返回 {score, values}；无效返回 null
async function collectSelected() {
    const panel = panels.me;
    const sel = panel.dice.filter(d => d.selected);
    const values = sel.map(d => d.value);
    const { score, valid } = scoreValues(values);
    if (!valid) return null;
    state.turnPoints += score;
    log(`你收起 ${values.join('、')}，+<b>${score}</b> 分（${scoreDetail(values)}・本回合 ${state.turnPoints}）`);
    state.phase = 'busy';
    setButtons();
    parkDice(panel, sel);
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

// 玩家：记分结束回合
async function onBank() {
    const got = await collectSelected();
    if (!got) return;
    bankScore('me');
    if (state.scores.me >= state.target) {
        finishGame('me');
        return;
    }
    endTurn();
}

// 记分：先弹出加成提示，0.5 秒后消失，随后分数才变化显示
function bankScore(who) {
    const gained = state.turnPoints;
    state.scores[who] += gained;
    const name = who === 'me' ? '你' : '对方';
    log(`${name}记分 <b>${gained}</b>，总分 ${state.scores[who]}`, 'bank');
    state.turnPoints = 0;
    const hint = who === 'me' ? els.hintMe : els.hintAi;
    hint.textContent = `+${gained}`;
    hint.classList.remove('show');
    void hint.offsetWidth; // 重启动画
    hint.classList.add('show');
    setTimeout(() => {
        hint.classList.remove('show');
        shown[who] = state.scores[who];
        paintScores();
    }, 500);
    renderScores();
}

function endTurn() {
    pendingReset[state.current] = true; // 该面板保留到下一次该方掷骰前
    els.selInfo.textContent = '';
    if (state.current === 'me') {
        state.current = 'ai';
        state.phase = 'ai';
        renderScores();
        setButtons();
        runAiTurn();
    } else {
        state.current = 'me';
        state.phase = 'await-roll';
        setBanner('轮到你：点击「掷骰」');
        renderScores();
        setButtons();
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

    for (;;) {
        await doRoll();
        if (state.phase !== 'ai') return; // 爆骰，已交还回合

        const panel = panels.ai;
        const values = panel.dice.map(d => d.value);
        const groups = takeGroups(values);
        const taken = groups.flatMap(g => g.indices);
        const takenValues = taken.map(i => values[i]);
        const takenScore = scoreValues(takenValues).score;

        // 选骰动画：组合（三同及以上）快速依次点亮，单张（1/5）慢速依次点亮；
        // 每颗骰子选中前后的等待间隔一致（快速 240ms / 慢速 720ms），
        // 从快速切到慢速时也先等待一个慢速间隔，避免慢速骰子被"追上"
        setBanner('对方选取骰子…');
        const QUICK_STEP = 240;
        const SLOW_STEP = 720;
        let lastStep = SLOW_STEP;
        for (const g of groups) {
            const step = g.quick ? QUICK_STEP : SLOW_STEP;
            for (const i of g.indices) {
                await delay(step);
                const el = panel.dieEl(panel.dice[i].id);
                if (el) el.classList.add('selected');
                lastStep = step;
            }
        }
        await delay(lastStep);
        const takenDice = taken.map(i => panel.dice[i]).filter(d => d && !d.parked);
        parkDice(panel, takenDice);
        await delay(430);
        state.turnPoints += takenScore;
        renderScores();
        log(`对方收起 ${takenValues.join('、')}，+<b>${takenScore}</b> 分（${scoreDetail(takenValues)}・本回合 ${state.turnPoints}）`);
        checkHotDice(panel);
        await delay(500);

        if (state.scores.ai + state.turnPoints >= state.target) {
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
    }
}

/* ── 结算 ───────────────────────── */
function finishGame(winner) {
    state.phase = 'over';
    renderScores();
    els.selInfo.textContent = '';
    els.boardOver.innerHTML = `<span>${winner === 'me' ? 'YOU WIN' : 'YOU LOSE'}</span>`;
    els.boardOver.classList.toggle('lose', winner !== 'me');
    els.boardOver.classList.remove('hidden');
    // 主按钮变为再来一局
    els.roll.innerHTML = '<svg><use href="#i-refresh"/></svg> 再来一局';
    els.roll.disabled = false;
    els.again.disabled = true;
    els.bank.disabled = true;
    log(winner === 'me' ? '对局结束：你获胜！' : '对局结束：对方获胜', 'important');
}

function backToSetup() {
    els.boardOver.classList.add('hidden');
    els.game.classList.add('hidden');
    els.setup.classList.remove('hidden');
    els.roll.innerHTML = '<svg><use href="#i-play"/></svg> 掷骰';
    state.phase = 'setup';
}

/* ── 开局 ───────────────────────── */
function startGame() {
    state.scores = { me: 0, ai: 0 };
    state.turnPoints = 0;
    state.current = 'me';
    state.phase = 'await-roll';
    shown.me = shown.ai = 0;
    pendingReset.me = pendingReset.ai = false;
    panels.me.clear();
    panels.ai.clear();
    els.hintMe.classList.remove('show');
    els.hintAi.classList.remove('show');
    els.hintMe.textContent = els.hintAi.textContent = '';
    els.log.innerHTML = '';
    els.selInfo.textContent = '';
    els.boardOver.classList.add('hidden');
    els.roll.innerHTML = '<svg><use href="#i-play"/></svg> 掷骰';
    els.setup.classList.add('hidden');
    els.game.classList.remove('hidden');
    setBanner('轮到你：点击「掷骰」');
    renderScores();
    setButtons();
    fitLogHeight();
    log(`对局开始，目标 <b>${state.target}</b> 分，你先手`, 'important');
}

// 日志向下扩展到浏览器底部（底部留 65px 空隙）
function fitLogHeight() {
    if (els.game.classList.contains('hidden')) return;
    const top = els.log.getBoundingClientRect().top + window.scrollY;
    const avail = window.innerHeight + window.scrollY - top - 65;
    els.log.style.maxHeight = Math.max(160, avail) + 'px';
}

/* ── 事件绑定 ───────────────────── */
els.targetSeg.addEventListener('click', e => {
    const btn = e.target.closest('button[data-target]');
    if (!btn) return;
    [...els.targetSeg.children].forEach(b => b.classList.toggle('active', b === btn));
    state.target = Number(btn.dataset.target);
});
els.start.addEventListener('click', startGame);
els.roll.addEventListener('click', () => {
    if (state.phase === 'over') {
        backToSetup();
        return;
    }
    if (state.phase === 'await-roll' && state.current === 'me') doRoll();
});
els.again.addEventListener('click', onAgain);
els.bank.addEventListener('click', onBank);
els.btnRules.addEventListener('click', () => els.rulesModal.classList.remove('hidden'));
els.btnCloseRules.addEventListener('click', () => els.rulesModal.classList.add('hidden'));
els.rulesModal.addEventListener('click', e => {
    if (e.target === els.rulesModal) els.rulesModal.classList.add('hidden');
});
window.addEventListener('resize', fitLogHeight);

// 控制台/测试钩子
window.__farkle = { state, panels, shown, scoreValues, takeGroups, layoutPositions, rollGeom, finishGame, rollAnimation, scoreDetail };
