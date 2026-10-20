'use strict';

/**
 * =====================================================================
 * 天国骰子 - 主游戏流程控制器 (Main Game App)
 * 调度游戏状态机、玩家与 AI 回合、徽章技能效果与胜负结算
 * =====================================================================
 */

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── DOM ────────────────────────── */
const $ = (id) => document.getElementById(id);
const els = {
    setup: $('setup-panel'),
    game: $('game-panel'),
    scoreboard: $('scoreboard'),
    scoreMe: $('score-me'),
    scoreAi: $('score-ai'),
    scoreTarget: $('score-target'),
    turnMe: $('turn-me'),
    turnAi: $('turn-ai'),
    selMe: $('sel-me'),
    selAi: $('sel-ai'),
    banner: $('table-banner'),
    log: $('log'),
    boardOver: $('board-over'),
    boardOverText: $('board-over-text'),
    boardFlash: $('board-flash'),
    boardFlashText: $('board-flash-text'),
    roll: $('btn-roll'),
    again: $('btn-again'),
    bank: $('btn-bank'),
    surrender: $('btn-surrender'),
    badge: $('btn-badge'),
    badgeSbMe: $('badge-sb-me'),
    badgeSbLabel: $('badge-sb-label'),
    badgeSbAi: $('badge-sb-ai')
};

/* ── UI-Board 基础设施引入 ─────── */
const UIBoard = typeof FarkleUIBoard !== 'undefined' ? FarkleUIBoard : {};
const Panel = UIBoard.Panel;
const setBanner = UIBoard.setBanner || function () {};
const log = UIBoard.log || function () {};
const parkDice = UIBoard.parkDice || function () {};
const rerollDice = UIBoard.rerollDice || function () {};
const hideDieTooltip = UIBoard.hideDieTooltip || function () {};
const rollAnimation = UIBoard.rollAnimation;
const layoutPositions = UIBoard.layoutPositions;
const rollGeom = UIBoard.rollGeom;

const panels = {
    me: new Panel('half-me', 'me', false),
    ai: new Panel('half-ai', 'ai', true)
};
const activePanel = () => panels[state.current];

window.onDieClickDispatcher = (d, panel) => {
    if (state.targeting && panel.key === 'me') {
        onTargetClick(d);
        return;
    }
    toggleSelect(d.id, panel);
};

/* ── 得分与状态渲染 ─────────────── */
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
    const sel = panels.me.dice.filter((d) => d.selected).map((d) => ({ value: d.value, isJoker: d.isJoker }));
    const { score, valid } = scoreValues(sel, fxFor('me'));
    if (state.targeting) {
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
    const mk = (who) => {
        const el = who === 'me' ? els.badgeSbMe : els.badgeSbAi;
        const b = state.badges[who];
        if (!b) {
            el.classList.add('hidden');
            el.textContent = '';
            return;
        }
        el.classList.remove('hidden', 'dead');
        const counted = ['might', 'reroll', 'transmute', 'doppel', 'resurrect'].includes(b.type);
        let txt = `${TIER_CN[b.tier]}·${b.short}`;
        if (b.cancelled) {
            el.classList.add('dead');
            txt += '（已抵消）';
        } else if (b.type === 'warlord' && state.warlordArmed[who]) {
            txt += ' 已发动';
        } else if (counted) {
            txt += ` 剩${b.uses}`;
        }
        el.textContent = txt;
    };
    mk('me');
    mk('ai');
    const any = !!(state.badges.me || state.badges.ai);
    els.badgeSbLabel.classList.toggle('hidden', !any);
    els.scoreboard.classList.toggle('has-badges', any);
}

function refreshBadgeBtn() {
    const btn = els.badge;
    const b = state.badges.me;
    const tag = b ? `<i class="tier-dot ${b.tier}"></i>` : '';
    if (!b) {
        btn.classList.add('hidden');
        btn.disabled = true;
        btn.innerHTML = '<svg><use href="#i-badge"/></svg> 无徽章';
        return;
    }
    btn.classList.remove('hidden');
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
            btn.innerHTML = t.picked.length === 0 ? `${tag} 取消重掷` : `${tag} 确认重掷 ${t.picked.length}/${t.max}`;
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
            const ok =
                b.uses > 0 &&
                lc &&
                lc.who === 'me' &&
                !lc.doubled &&
                (state.phase === 'select' || state.phase === 'pre-bank');
            btn.disabled = !ok;
            btn.innerHTML = ok ? `${tag} 分身：翻倍上次掷骰 +${lc.score}` : `${tag} 分身（剩${b.uses}）`;
            break;
        }
        case 'warlord': {
            const armed = state.warlordArmed.me;
            btn.disabled = armed || state.phase !== 'select' || b.uses <= 0 || state.turnPoints <= 0;
            btn.innerHTML = armed ? `${tag} 军阀已发动 ×${b.mult}` : `${tag} 军阀：本回合 ×${b.mult}`;
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
        default:
            btn.disabled = true;
            btn.innerHTML = `${tag} ${b.short}（被动生效）`;
    }
}

function applyDoppel(who) {
    const b = state.badges[who];
    const lc = state.lastCollect;
    if (!b || b.cancelled || b.type !== 'doppel' || b.uses <= 0 || !lc || lc.who !== who || lc.doubled) return false;
    b.uses--;
    lc.doubled = true;
    state.turnPoints += lc.score;
    const name = who === 'me' ? '你' : '对方';
    log(
        `${name}使用「${b.name}」：上次掷骰 <b>${lc.score}</b> 分翻倍，+<b>${lc.score}</b>（本回合 ${state.turnPoints}）`,
        'important'
    );
    renderBadges();
    renderScores();
    refreshBadgeBtn();
    return true;
}

/* ── 徽章目标选取 ───────────────── */
function enterTargeting(t) {
    state.targeting = t;
    renderTargeting();
    setBanner(
        t.type === 'transmute'
            ? `点化：点击场上一颗骰子，将其点数变为 ${t.to}`
            : `重掷：点击最多 ${t.max} 颗骰子标记${t.sameValue ? '（须点数相同）' : ''}，再点徽章键确认`,
        'good'
    );
    updateSelInfo();
}

function renderTargeting() {
    panels.me.renderActive(false);
    panels.me.dice.forEach((d) => {
        const el = panels.me.dieEl(d.id);
        if (!el) return;
        el.classList.add('targetable');
        if (state.targeting && state.targeting.type === 'reroll' && state.targeting.picked.includes(d.id))
            el.classList.add('picked');
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
        die.isJoker = die.dieDef && die.dieDef.special === 'joker' && die.value === 1;
        state.badges.me.uses--;
        state.targeting = null;
        const el = panels.me.dieEl(die.id);
        if (el) {
            el.dataset.value = t.to;
            if (die.isJoker) el.classList.add('is-joker');
            else el.classList.remove('is-joker');
        }
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
            const first = panels.me.dice.find((d) => d.id === t.picked[0]);
            if (!first || first.value !== die.value) return;
        }
        t.picked.push(die.id);
    }
    renderTargeting();
    refreshBadgeBtn();
}

async function confirmReroll() {
    const t = state.targeting;
    const b = state.badges.me;
    if (!t || t.type !== 'reroll' || !b) return;
    const dice = t.picked.map((id) => panels.me.dice.find((d) => d.id === id)).filter(Boolean);
    if (!dice.length) {
        exitTargeting();
        return;
    }
    b.uses--;
    state.targeting = null;
    dice.forEach((d) => {
        d.selected = false;
    });
    state.phase = 'busy';
    setButtons();
    log(`你使用「${b.name}」：重掷 ${dice.map((d) => d.value).join('、')}`, 'important');
    renderBadges();
    await rerollDice(panels.me, dice);
    const values = panels.me.dice.map((d) => ({ value: d.value, isJoker: d.isJoker }));
    const rawVals = panels.me.dice.map((d) => (d.isJoker ? `${d.value}(鬼牌)` : d.value));
    log(`重掷结果：${rawVals.join('、')}`);
    if (!hasAnyScore(values, fxFor('me'))) {
        await resolveBust('me');
        return;
    }
    state.phase = 'select';
    panels.me.renderActive(true);
    setBanner('选取计分骰子，然后「收骰再掷」或「记分结束回合」');
    updateSelInfo();
}

async function addExtraDie(who) {
    const panel = panels[who];
    const def = getDieDef('ordinary');
    const val = rollDieDef(def);
    panel.dice.push({
        id: state.nextId++,
        dieDef: def,
        value: val,
        isJoker: false,
        selected: false,
        x: 0,
        y: 0,
        rot: 0,
        scale: 1
    });
    await rollAnimation(
        panel,
        panel.dice.map((d) => d.value)
    );
}

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

function aiTransmuteTarget(values) {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    const nums = values.map((v) => (typeof v === 'object' && v !== null ? v.value : v));
    nums.forEach((v) => counts[v]++);
    const to = [1, 5, 6, 4, 3, 2].find((v) => counts[v] === 2);
    if (to === undefined) return null;
    const dieIdx = nums.findIndex((v) => [2, 3, 4, 6].includes(v) && counts[v] < 3 && v !== to);
    if (dieIdx < 0) return null;
    return { dieIdx, to };
}

/* ── 掷骰 ───────────────────────── */
function toggleSelect(id, panel) {
    if (state.phase !== 'select' || panel !== panels.me) return;
    const die = panel.dice.find((d) => d.id === id);
    if (!die) return;
    die.selected = !die.selected;
    panel.renderActive(true);
    updateSelInfo();
}

async function doRoll() {
    const panel = activePanel();
    hideDieTooltip();
    for (;;) {
        if (pendingReset[state.current]) {
            panel.clear();
            pendingReset[state.current] = false;
        }
        state.phase = 'busy';
        setButtons();
        if (panel.dice.length === 0) {
            const pool =
                panel.dicePool && panel.dicePool.length === 6
                    ? panel.dicePool
                    : Array.from({ length: 6 }, () => getDieDef('ordinary'));
            panel.dice = pool.map((def) => {
                const val = rollDieDef(def);
                return {
                    id: state.nextId++,
                    dieDef: def,
                    value: val,
                    isJoker: def.special === 'joker' && val === 1,
                    selected: false,
                    x: 0,
                    y: 0,
                    rot: 0,
                    scale: 1
                };
            });
        } else {
            panel.dice.forEach((d) => {
                if (!d.dieDef) d.dieDef = getDieDef('ordinary');
                d.value = rollDieDef(d.dieDef);
                d.isJoker = d.dieDef.special === 'joker' && d.value === 1;
                d.selected = false;
            });
        }

        setBanner(state.current === 'me' ? '掷骰中…' : '对方掷骰中…');
        const values = panel.dice.map((d) => ({ value: d.value, isJoker: d.isJoker }));
        await rollAnimation(
            panel,
            panel.dice.map((d) => d.value)
        );

        const who = state.current === 'me' ? '你' : '对方';
        const displayVals = panel.dice.map((d) => (d.isJoker ? `${d.value}(鬼牌)` : d.value));
        log(`${who}掷出 ${displayVals.join('、')}`);

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
        const r = await resolveBust(state.current);
        if (r !== 'resurrect') return r;
    }
}

/* ── 玩家回合 ───────────────────── */
async function collectSelected() {
    const panel = panels.me;
    const sel = panel.dice.filter((d) => d.selected);
    const values = sel.map((d) => ({ value: d.value, isJoker: d.isJoker }));
    const { score, valid } = scoreValues(values, fxFor('me'));
    if (!valid) return null;
    state.turnPoints += score;
    state.lastCollect = { who: 'me', score, doubled: false };
    const numDisplay = sel.map((d) => (d.isJoker ? `${d.value}(鬼牌)` : d.value));
    log(
        `你收起 ${numDisplay.join('、')}，+<b>${score}</b> 分（${scoreDetail(values, fxFor('me'))}・本回合 ${state.turnPoints}）`
    );
    state.phase = 'busy';
    setButtons();
    parkDice(panel, sel);
    els.selMe.textContent = '0';
    await delay(430);
    checkHotDice(panel);
    renderScores();
    return { score, values };
}

async function onAgain() {
    const got = await collectSelected();
    if (!got) return;
    await doRoll();
}

function finishBank(who) {
    bankScore(who);
    if (state.scores[who] >= state.target) {
        finishGame(who);
        return;
    }
    endTurn();
}

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
    const sel = panels.me.dice.filter((d) => d.selected);
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
    const b = state.badges.me;
    if (
        b &&
        !b.cancelled &&
        b.type === 'doppel' &&
        b.uses > 0 &&
        state.lastCollect &&
        state.lastCollect.who === 'me' &&
        !state.lastCollect.doubled
    ) {
        state.phase = 'pre-bank';
        setBanner(`可发动「分身」翻倍本次掷骰（+${state.lastCollect.score} 分），或直接记分`, 'good');
        setButtons();
        return;
    }
    finishBank('me');
}

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
    if (remaining === 0) return true;
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
        if (rolled !== 'score') return;

        const panel = panels.ai;
        const bAi = state.badges.ai;
        const fx = fxFor('ai');

        if (!mightUsed && bAi && !bAi.cancelled && bAi.type === 'might' && bAi.uses > 0) {
            mightUsed = true;
            bAi.uses--;
            renderBadges();
            log('对方使用「力量徽章」：本掷加一颗骰子', 'important');
            setBanner('对方使用力量徽章，加掷一颗骰子…');
            await delay(500);
            await addExtraDie('ai');
        }

        for (;;) {
            let values = panel.dice.map((d) => d.value);

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
                    values = panel.dice.map((d) => d.value);
                    await delay(600);
                }
            }

            let groups = takeGroups(values, fx);
            let taken = groups.flatMap((g) => g.indices);
            let takenValues = taken.map((i) => values[i]);

            if (
                bAi &&
                !bAi.cancelled &&
                bAi.type === 'reroll' &&
                bAi.uses > 0 &&
                state.turnPoints === 0 &&
                takenValues.length > 0 &&
                takenValues.length <= bAi.dice &&
                groups.every((g) => !g.quick) &&
                takenValues.every((v) => v === 5)
            ) {
                bAi.uses--;
                renderBadges();
                const picked = taken.map((i) => panel.dice[i]).filter(Boolean);
                log(`对方使用「${bAi.name}」：重掷 ${picked.length} 颗骰子`, 'important');
                setBanner('对方使用好运徽章，重掷骰子…');
                await delay(500);
                await rerollDice(panel, picked);
                values = panel.dice.map((d) => d.value);
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
                taken = groups.flatMap((g) => g.indices);
                takenValues = taken.map((i) => values[i]);
            }

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
            const takenDice = taken.map((i) => panel.dice[i]).filter((d) => d && !d.parked);
            parkDice(panel, takenDice);
            await delay(430);
            const takenScore = scoreValues(takenValues, fx).score;
            state.turnPoints += takenScore;
            state.lastCollect = { who: 'ai', score: takenScore, doubled: false };
            renderScores();
            log(
                `对方收起 ${takenValues.join('、')}，+<b>${takenScore}</b> 分（${scoreDetail(takenValues, fx)}・本回合 ${state.turnPoints}）`
            );
            checkHotDice(panel);
            await delay(500);

            if (
                bAi &&
                !bAi.cancelled &&
                bAi.type === 'doppel' &&
                bAi.uses > 0 &&
                (takenScore >= 300 || state.scores.ai + state.turnPoints + takenScore >= state.target)
            ) {
                if (applyDoppel('ai')) await delay(600);
            }

            if (
                bAi &&
                !bAi.cancelled &&
                bAi.type === 'warlord' &&
                bAi.uses > 0 &&
                !state.warlordArmed.ai &&
                (state.turnPoints >= 400 || state.scores.ai + Math.round(state.turnPoints * bAi.mult) >= state.target)
            ) {
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
            break;
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
    hideDieTooltip();
    renderBadges();
    if (typeof FarkleModalManager !== 'undefined') {
        FarkleModalManager.renderSetupLoadout();
    }
}

/* ── 开局 ───────────────────────── */
function announceBadges() {
    const me = state.badges.me,
        ai = state.badges.ai;
    log(me ? `你佩戴「${me.name}」` : '你本局不佩戴徽章');
    log(ai ? `对方佩戴「${ai.name}」` : '对方本局未佩戴徽章');
}

function announceDice() {
    const mySpecials = state.playerDice.filter((id) => id !== 'ordinary').map((id) => getDieDef(id).name);
    if (mySpecials.length > 0) {
        log(`你携带了特殊骰子：${mySpecials.join('、')}`);
    } else {
        log('你使用全套普通骰子');
    }
    const aiSpecials = state.aiDice.filter((id) => id !== 'ordinary').map((id) => getDieDef(id).name);
    if (aiSpecials.length > 0) {
        log(`对方携带了特殊骰子：${aiSpecials.join('、')}（共 ${aiSpecials.length} 颗）`);
    } else {
        log('对方使用全套普通骰子');
    }
}

function resolveDefence() {
    const me = state.badges.me,
        ai = state.badges.ai;
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
    ['me', 'ai'].forEach((who) => {
        const b = state.badges[who];
        if (b && !b.cancelled && b.type === 'headstart') {
            state.scores[who] += b.amount;
            shown[who] = state.scores[who];
            log(`${who === 'me' ? '你' : '对方'}的「${b.name}」生效：开局 +<b>${b.amount}</b> 分`, 'important');
        }
    });
}

async function startGame(playerDice) {
    state.playerDice = playerDice && playerDice.length === 6 ? [...playerDice] : [...state.defaultDice];
    state.aiDice = generateAiDice();
    panels.me.dicePool = state.playerDice.map((id) => getDieDef(id));
    panels.ai.dicePool = state.aiDice.map((id) => getDieDef(id));
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
    hideDieTooltip();
    announceBadges();
    announceDice();
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
window.startGame = startGame;

/* ── 投降机制 ───────────────────── */
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

els.roll.addEventListener('click', () => {
    if (state.phase === 'over') backToSetup();
});
els.again.addEventListener('click', onAgain);
els.bank.addEventListener('click', onBank);

els.badge.addEventListener('click', async () => {
    if (state.phase === 'over' || state.phase === 'setup') return;
    const b = state.badges.me;
    if (!b || b.cancelled) return;
    const t = state.targeting;
    if (t) {
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

/* ── 弹层初始化 ─────────────────── */
if (typeof FarkleModalManager !== 'undefined') {
    FarkleModalManager.initModalEvents({ startGame });
    FarkleModalManager.renderSetupLoadout();
}

/* ── 控制台与测试钩子 ───────────── */
window.__farkle = {
    state,
    panels,
    shown,
    scoreValues,
    takeGroups,
    hasAnyScore,
    scoreDetail,
    fxFor,
    layoutPositions,
    rollGeom,
    rollAnimation,
    finishGame,
    BADGES,
    makeBadge,
    renderBadges,
    refreshBadgeBtn,
    resolveBust,
    addExtraDie,
    applyDoppel,
    DICE_LIST,
    getDieDef,
    generateAiDice,
    openDiceSelectModal: typeof FarkleModalManager !== 'undefined' ? FarkleModalManager.openDiceSelectModal : null,
    openSettingsModal: typeof FarkleModalManager !== 'undefined' ? FarkleModalManager.openSettingsModal : null,
    startGame
};
