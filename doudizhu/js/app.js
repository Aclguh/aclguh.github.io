'use strict';

/* 斗地主对局流程与渲染（依赖 cards.js / ai.js） */
(function () {

    const $ = id => document.getElementById(id);
    const ME = 0, EAST = 1, WEST = 2;              // 0=我（下），1=下家（右），2=上家（左）
    const NAMES = ['你', '电脑·东', '电脑·西'];
    const AI_DELAY = 850;
    const TRICK_CLEAR = 900;

    const S = {
        phase: 'setup',          // setup | bid | play | over
        base: 5,
        level: 'normal',
        hands: [[], [], []],
        kitty: [],
        landlord: -1,
        turn: 0,
        bidScore: 0,
        bidTurns: 0,
        last: null,              // 当前需要压过的牌型
        lastSeat: -1,
        passCount: 0,
        bombs: 0,
        playedBy: [null, null, null],
        playCount: [0, 0, 0],
        selected: new Set(),
        hints: null,
        hintIdx: 0,
        scores: [0, 0, 0],
        rounds: 0,
        wins: 0,
        gen: 0,                  // 代次：重开时让所有待执行的定时器失效
        timers: []
    };

    /* ── 定时器 ───────────────────── */

    function later(fn, ms) {
        const gen = S.gen;
        S.timers.push(setTimeout(() => { if (gen === S.gen) fn(); }, ms));
    }

    function clearTimers() {
        S.timers.forEach(clearTimeout);
        S.timers = [];
        S.gen++;
    }

    const next = s => (s + 1) % 3;
    const isFreeLead = () => S.last === null || S.lastSeat === S.turn;
    const seatLabel = s => (s === ME ? '你' : NAMES[s]);

    /* ── 牌面渲染 ───────────────────── */

    const isRed = c => c.suit === '♥' || c.suit === '♦';

    function cardEl(card, cls) {
        const el = document.createElement('div');
        el.className = cls;
        el.dataset.id = card.id;
        if (card.rank >= JOKER_S) {
            const big = card.rank === JOKER_B;
            el.classList.add('joker', big ? 'big' : 'small');
            el.innerHTML = '<span class="c-corner"><b class="c-rank">王</b><i class="c-suit">★</i></span>'
                + '<span class="c-pip">' + (big ? '大王' : '小王') + '</span>';
        } else {
            if (isRed(card)) el.classList.add('red');
            el.innerHTML = '<span class="c-corner"><b class="c-rank">' + rankText(card.rank) + '</b>'
                + '<i class="c-suit">' + card.suit + '</i></span>'
                + '<span class="c-pip">' + card.suit + '</span>';
        }
        return el;
    }

    function backEl(cls) {
        const el = document.createElement('div');
        el.className = 'card-back ' + cls;
        return el;
    }

    function renderHand(animate) {
        const hand = $('hand');
        hand.innerHTML = '';
        S.hands[ME].forEach((c, i) => {
            const el = cardEl(c, 'card');
            if (animate) {
                el.classList.add('deal-in');
                el.style.animationDelay = Math.min(i * 26, 420) + 'ms';
            }
            if (S.selected.has(c.id)) el.classList.add('sel');
            el.addEventListener('click', () => toggleCard(c.id));
            hand.appendChild(el);
        });
        layoutHand();
        syncHandState();
    }

    // 只同步选中态与可点状态，不重建 DOM（避免重播发牌动画）
    function syncHandState() {
        const hand = $('hand');
        hand.querySelectorAll('.card').forEach(el => {
            el.classList.toggle('sel', S.selected.has(Number(el.dataset.id)));
        });
        hand.classList.toggle('locked', S.phase !== 'play' || S.turn !== ME);
        updateSeatCount(ME);
    }

    // 手牌过多时压缩叠放间距，保证不溢出牌桌
    function layoutHand() {
        const hand = $('hand');
        const n = hand.children.length;
        if (!n) return;
        const cw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-w'));
        const maxStep = cw * 0.62;
        const avail = hand.clientWidth;
        // 容器尚不可见（宽度为 0）时用默认叠放，避免算出负间距
        const step = (avail > cw && n > 1) ? Math.min(maxStep, (avail - cw) / (n - 1)) : maxStep;
        hand.style.setProperty('--step', Math.max(10, step) + 'px');
    }

    function renderFan(seat) {
        const fan = $('seat-' + seat).querySelector('[data-fan]');
        fan.innerHTML = '';
        for (let i = 0; i < Math.min(S.hands[seat].length, 12); i++) fan.appendChild(backEl(''));
        updateSeatCount(seat);
    }

    function updateSeatCount(seat) {
        const n = S.hands[seat].length;
        const el = $('seat-' + seat).querySelector('[data-count]');
        el.textContent = n;
        el.classList.toggle('low', S.phase === 'play' && n <= 2);
    }

    function renderKitty(revealed) {
        const box = $('kitty');
        box.innerHTML = '';
        S.kitty.forEach(c => box.appendChild(revealed ? cardEl(c, 'mini') : backEl('mini-back')));
    }

    function renderPlayed(seat) {
        const zone = $('played-' + seat);
        zone.innerHTML = '';
        const p = S.playedBy[seat];
        if (!p) return;
        if (p.pass) {
            const s = document.createElement('span');
            s.className = 'played-note';
            s.textContent = '不出';
            zone.appendChild(s);
            return;
        }
        const row = document.createElement('div');
        row.className = 'played-cards';
        p.cards.forEach(c => row.appendChild(cardEl(c, 'mini play-in')));
        zone.appendChild(row);
        const tag = document.createElement('span');
        tag.className = 'played-note combo';
        tag.textContent = typeText(p.type);
        zone.appendChild(tag);
        fitPlayed(zone, row);
    }

    // 长牌型（如 12 张顺子）在展示格里放不下时压缩叠放间距
    function fitPlayed(zone, row) {
        const n = row.children.length;
        if (n < 2) { row.style.removeProperty('--mini-step'); return; }
        const mw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mini-w'));
        const avail = zone.clientWidth;
        if (!avail) return;
        const step = Math.min(mw * 0.55, (avail - mw) / (n - 1));
        row.style.setProperty('--mini-step', Math.max(7, step) + 'px');
    }

    function clearPlayed() {
        S.playedBy = [null, null, null];
        [0, 1, 2].forEach(renderPlayed);
    }

    function renderCrowns() {
        [0, 1, 2].forEach(s => {
            $('seat-' + s).querySelector('[data-crown]').classList.toggle('hidden', s !== S.landlord);
        });
    }

    function multiplier() {
        return Math.max(1, S.bidScore) * Math.pow(2, S.bombs);
    }

    function renderHud() {
        $('hud-base').textContent = S.base;
        $('hud-bomb').textContent = S.bombs;
        const el = $('hud-mult');
        const m = String(multiplier());
        if (el.textContent !== m) {
            el.textContent = m;
            const cell = el.closest('.hud-cell');
            cell.classList.remove('bump');
            void cell.offsetWidth;
            cell.classList.add('bump');
        }
        $('hud-turn').textContent = S.phase === 'bid' ? '叫分中'
            : S.phase === 'over' ? '本局结束' : seatLabel(S.turn);
    }

    function banner(text, hi) {
        const b = $('banner');
        b.textContent = text;
        b.classList.toggle('hi', !!hi);
    }

    function bubble(seat, text, ms) {
        const el = $('seat-' + seat).querySelector('[data-bubble]');
        el.textContent = text;
        el.classList.remove('hidden');
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.add('hidden'), ms || 1600);
    }

    // 高亮当前行动的一家；电脑行动时加「思考中」呼吸效果
    function markActive() {
        const live = S.phase === 'bid' || S.phase === 'play';
        [0, 1, 2].forEach(s => {
            const el = $('seat-' + s);
            el.classList.toggle('active', live && s === S.turn);
            el.classList.toggle('thinking', live && s === S.turn && s !== ME);
        });
    }

    /* ── 日志 ───────────────────── */

    function log(html, cls) {
        const box = $('log');
        const line = document.createElement('div');
        line.className = 'log-line ' + (cls || '');
        line.innerHTML = '<time>' + (box.children.length + 1) + '</time><span>' + html + '</span>';
        box.appendChild(line);
        box.scrollTop = box.scrollHeight;
    }

    function logPlay(seat, c) {
        const big = c.type === 'bomb' || c.type === 'rocket';
        log('<b>' + seatLabel(seat) + '</b> 出 ' + typeText(c.type) + '：'
            + c.cards.map(x => rankText(x.rank)).join(' ') + (big ? '（倍数翻倍）' : ''),
            seat === S.landlord ? 'landlord' : (seat === ME ? 'me' : ''));
    }

    /* ── 发牌与叫分 ───────────────────── */

    function startRound() {
        clearTimers();
        $('over-modal').classList.add('hidden');
        S.rounds++;
        S.kitty = [];
        S.landlord = -1;
        S.bidScore = 0;
        S.bidTurns = 0;
        S.last = null;
        S.lastSeat = -1;
        S.passCount = 0;
        S.bombs = 0;
        S.playedBy = [null, null, null];
        S.playCount = [0, 0, 0];
        S.selected.clear();
        S.hints = null;
        S.hintIdx = 0;
        S.phase = 'bid';

        const deck = shuffle(buildDeck());
        S.hands = [deck.slice(0, 17), deck.slice(17, 34), deck.slice(34, 51)].map(sortCards);
        S.kitty = deck.slice(51);

        clearPlayed();
        renderKitty(false);
        renderCrowns();
        renderHand(true);
        renderFan(EAST);
        renderFan(WEST);
        $('log').innerHTML = '';
        $('btn-restart').classList.remove('hidden');
        log('第 ' + S.rounds + ' 局开始，底分 ' + S.base + '，难度 '
            + { easy: '轻松', normal: '普通', hard: '高手' }[S.level], 'sys');

        S.turn = (S.rounds - 1) % 3;
        showActions('bid');
        beginTurn();
    }

    function beginBidActions() {
        $('btn-bid-pass').disabled = false;
        [1, 2, 3].forEach(v => { $('btn-bid-' + v).disabled = v <= S.bidScore; });
    }

    function hideBidButtons() {
        $('btn-bid-pass').disabled = true;
        [1, 2, 3].forEach(v => { $('btn-bid-' + v).disabled = true; });
    }

    function doBid(seat, value) {
        if (S.phase !== 'bid' || S.turn !== seat) return;
        S.bidTurns++;
        hideBidButtons();
        if (value > S.bidScore) {
            S.bidScore = value;
            S.landlord = seat;
            bubble(seat, value + ' 分');
            log('<b>' + seatLabel(seat) + '</b> 叫 ' + value + ' 分', seat === ME ? 'me' : '');
        } else {
            bubble(seat, '不叫');
            log('<b>' + seatLabel(seat) + '</b> 不叫', seat === ME ? 'me' : '');
        }
        renderHud();
        if (value === 3 || S.bidTurns >= 3) { later(finishBid, 750); return; }
        S.turn = next(seat);
        beginTurn();
    }

    function finishBid() {
        if (S.landlord < 0) {
            banner('三家都不叫，重新发牌');
            log('三家都不叫，本局作废，重新发牌', 'sys');
            S.rounds--;
            later(startRound, 1300);
            return;
        }
        const L = S.landlord;
        S.hands[L] = sortCards(S.hands[L].concat(S.kitty));
        S.phase = 'play';
        renderKitty(true);
        renderCrowns();
        if (L === ME) renderHand(false); else renderFan(L);
        log('<b>' + seatLabel(L) + '</b> 以 ' + S.bidScore + ' 分成为地主，收走底牌', 'landlord');
        bubble(L, '地主 ' + S.bidScore + ' 分', 2000);
        banner(seatLabel(L) + ' 是地主 · ' + S.bidScore + ' 分 · 倍数 ×' + multiplier(), true);
        S.turn = L;
        later(beginTurn, 950);
    }

    /* ── 出牌回合 ───────────────────── */

    function beginTurn() {
        markActive();
        renderHud();
        syncHandState();

        if (S.phase === 'bid') {
            banner('叫分中：轮到 ' + seatLabel(S.turn));
            showActions('bid');
            if (S.turn === ME) {
                beginBidActions();
            } else {
                hideBidButtons();
                later(() => doBid(S.turn, aiBid(S.hands[S.turn], S.bidScore)), AI_DELAY);
            }
            return;
        }
        if (S.phase !== 'play') return;

        S.hints = null;
        S.hintIdx = 0;
        if (S.turn === ME) {
            showActions('play');
            const free = isFreeLead();
            $('btn-pass').disabled = free;
            $('btn-hint').disabled = false;
            $('btn-play').disabled = !validateSelection();
            banner(free ? '轮到你自由出牌' : '轮到你，需要压过 ' + typeText(S.last.type));
        } else {
            showActions('none');
            banner(seatLabel(S.turn) + ' 思考中…');
            later(aiTurn, AI_DELAY);
        }
    }

    function aiTurn() {
        const seat = S.turn;
        if (S.phase !== 'play' || seat === ME) return;
        const free = isFreeLead();
        let c = null;
        try {
            c = aiDecide(S.hands[seat], {
                seat,
                landlord: S.landlord,
                counts: S.hands.map(h => h.length),
                target: free ? null : S.last,
                targetSeat: free ? -1 : S.lastSeat,
                level: S.level
            });
        } catch (err) {
            console.error('AI 决策失败', err);
        }
        const ok = c && identify(c.cards) && (free || beats(identify(c.cards), S.last));
        if (ok) applyPlay(seat, c);
        else applyPass(seat, free);
    }

    function applyPlay(seat, c) {
        const ids = new Set(c.cards.map(x => x.id));
        S.hands[seat] = S.hands[seat].filter(x => !ids.has(x.id));
        S.playCount[seat]++;
        S.playedBy[seat] = c;
        renderPlayed(seat);

        const big = c.type === 'bomb' || c.type === 'rocket';
        if (big) S.bombs++;
        renderHud();
        if (big) banner(typeText(c.type) + '！倍数 ×' + multiplier(), true);
        else bubble(seat, typeText(c.type), 1300);

        if (seat === ME) { S.selected.clear(); renderHand(false); } else renderFan(seat);

        S.last = c;
        S.lastSeat = seat;
        S.passCount = 0;
        logPlay(seat, c);

        if (!S.hands[seat].length) { later(() => endRound(seat), 550); return; }
        S.turn = next(seat);
        later(beginTurn, big ? 850 : 430);
    }

    function applyPass(seat, wasFreeLead) {
        // 自由出牌时 AI 决策异常才会走到这里：兜底出最小单张，避免牌局卡死
        if (wasFreeLead) {
            const fallback = identify([S.hands[seat][S.hands[seat].length - 1]]);
            applyPlay(seat, fallback);
            return;
        }
        S.playedBy[seat] = { pass: true };
        renderPlayed(seat);
        bubble(seat, '不出', 1200);
        log('<b>' + seatLabel(seat) + '</b> 不出', seat === ME ? 'me' : '');

        S.passCount++;
        if (S.passCount >= 2) {
            // 连续两家不要，牌权回到最后出牌的一家，开启新一轮自由出牌
            const leader = S.lastSeat;
            S.last = null;
            S.lastSeat = -1;
            S.passCount = 0;
            S.turn = leader;
            later(clearPlayed, TRICK_CLEAR);
        } else {
            S.turn = next(seat);
        }
        renderHud();
        later(beginTurn, 430);
    }

    /* ── 玩家操作 ───────────────────── */

    function toggleCard(id) {
        if (S.phase !== 'play' || S.turn !== ME) return;
        if (S.selected.has(id)) S.selected.delete(id); else S.selected.add(id);
        S.hints = null;
        syncHandState();
        $('btn-play').disabled = !validateSelection();
    }

    // 选中牌是否为合法出法（不改动界面），返回 combo 或 null
    function validateSelection() {
        if (S.phase !== 'play' || S.turn !== ME) return null;
        const c = identify(S.hands[ME].filter(x => S.selected.has(x.id)));
        if (!c) return null;
        return (isFreeLead() || beats(c, S.last)) ? c : null;
    }

    function rejectSelection(msg) {
        $('hand').querySelectorAll('.card.sel').forEach(el => {
            el.classList.add('bad');
            setTimeout(() => el.classList.remove('bad'), 340);
        });
        banner(msg);
    }

    function onPlay() {
        if (S.phase !== 'play' || S.turn !== ME) return;
        const cards = S.hands[ME].filter(x => S.selected.has(x.id));
        if (!cards.length) { rejectSelection('请先选择要出的牌'); return; }
        const c = identify(cards);
        if (!c) { rejectSelection('不是合法牌型'); return; }
        if (!isFreeLead() && !beats(c, S.last)) { rejectSelection('压不过 ' + typeText(S.last.type)); return; }
        showActions('none');
        applyPlay(ME, c);
    }

    function onPass() {
        if (S.phase !== 'play' || S.turn !== ME || isFreeLead()) return;
        S.selected.clear();
        syncHandState();
        showActions('none');
        applyPass(ME, false);
    }

    function onHint() {
        if (S.phase !== 'play' || S.turn !== ME) return;
        if (!S.hints) {
            S.hints = hintOptions(S.hands[ME], isFreeLead() ? null : S.last);
            S.hintIdx = 0;
        }
        if (!S.hints.length) { banner('要不起，只能选择「不出」'); return; }
        const c = S.hints[S.hintIdx % S.hints.length];
        S.hintIdx++;
        S.selected = new Set(c.cards.map(x => x.id));
        syncHandState();
        banner(typeText(c.type) + ' · 第 ' + (((S.hintIdx - 1) % S.hints.length) + 1) + '/' + S.hints.length + ' 种，再点「提示」换下一个');
        $('btn-play').disabled = !validateSelection();
    }

    function showActions(which) {
        $('bid-actions').classList.toggle('hidden', which !== 'bid');
        $('play-actions').classList.toggle('hidden', which !== 'play');
        $('over-actions').classList.toggle('hidden', which !== 'over');
    }

    /* ── 结算 ───────────────────── */

    function endRound(winner) {
        S.phase = 'over';
        clearTimers();
        const L = S.landlord;
        const landlordWin = winner === L;
        const farmers = [0, 1, 2].filter(s => s !== L);
        const spring = landlordWin
            ? farmers.every(s => S.playCount[s] === 0)
            : S.playCount[L] <= 1;
        const mult = multiplier() * (spring ? 2 : 1);
        const unit = S.base * mult;
        const delta = [0, 0, 0];
        delta[L] = landlordWin ? 2 * unit : -2 * unit;
        farmers.forEach(s => { delta[s] = landlordWin ? -unit : unit; });
        delta.forEach((d, i) => { S.scores[i] += d; });
        // 胜负按阵营算：农民一方只要有人先出完，两名农民都算赢
        if (delta[ME] > 0) S.wins++;

        log('<b>' + seatLabel(winner) + '</b> 出完手牌，' + (landlordWin ? '地主' : '农民')
            + '获胜！倍数 ×' + mult + (spring ? '（春天翻倍）' : '')
            + '，你 ' + (delta[ME] >= 0 ? '+' : '') + delta[ME] + ' 分', 'win');
        banner((winner === ME ? '你赢了' : seatLabel(winner) + ' 获胜')
            + ' · ' + (landlordWin ? '地主' : '农民') + '胜 · ×' + mult, true);
        markActive();
        renderHud();
        showActions('over');
        renderOverModal(winner, landlordWin, spring, mult, delta);
        renderRecord();
    }

    function renderOverModal(winner, landlordWin, spring, mult, delta) {
        $('over-hero').classList.toggle('lose', winner !== ME);
        $('over-title').textContent = winner === ME ? '你赢了！'
            : (landlordWin ? '地主获胜' : '农民获胜');
        $('over-sub').innerHTML = seatLabel(winner) + ' 出完了所有手牌 · 倍数 ×' + mult
            + (spring ? ' · <b>春天翻倍</b>' : '');

        const box = $('over-table');
        box.innerHTML = '';
        [0, 1, 2].forEach(s => {
            const row = document.createElement('div');
            row.className = 'over-row' + (s === ME ? ' me' : '');
            row.innerHTML = '<span class="who">'
                + (s === S.landlord ? '<svg><use href="#i-crown"/></svg>' : '')
                + seatLabel(s) + (s === winner ? ' · 赢家' : '') + '</span>'
                + '<span class="delta ' + (delta[s] >= 0 ? 'plus' : 'minus') + '">'
                + (delta[s] >= 0 ? '+' : '') + delta[s] + '<small> / ' + S.scores[s] + '</small></span>';
            box.appendChild(row);
        });
        $('over-modal').classList.remove('hidden');
    }

    function renderRecord() {
        const el = $('setup-record');
        if (!S.rounds) { el.textContent = ''; return; }
        el.innerHTML = '本次已玩 <b>' + S.rounds + '</b> 局 · 胜 <b>' + S.wins + '</b> 局 · 累计积分 <b>'
            + (S.scores[ME] >= 0 ? '+' : '') + S.scores[ME] + '</b>';
    }

    /* ── 界面切换 ───────────────────── */

    function showSetup() {
        clearTimers();
        S.phase = 'setup';
        document.body.classList.remove('in-game');
        $('over-modal').classList.add('hidden');
        $('game-panel').classList.add('hidden');
        $('setup-panel').classList.remove('hidden');
        $('btn-restart').classList.add('hidden');
        renderRecord();
    }

    function showGame() {
        document.body.classList.add('in-game');
        $('setup-panel').classList.add('hidden');
        $('game-panel').classList.remove('hidden');
    }

    /* ── 事件绑定 ───────────────────── */

    function bindSeg(id, attr, onPick) {
        $(id).addEventListener('click', e => {
            const btn = e.target.closest('button');
            if (!btn) return;
            $(id).querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            onPick(btn.dataset[attr]);
        });
    }

    bindSeg('base-seg', 'base', v => { S.base = Number(v); });
    bindSeg('level-seg', 'level', v => { S.level = v; });

    $('btn-start').addEventListener('click', () => {
        S.scores = [0, 0, 0];
        S.rounds = 0;
        S.wins = 0;
        showGame();
        startRound();
    });
    $('btn-again').addEventListener('click', startRound);
    $('btn-over-again').addEventListener('click', () => { $('over-modal').classList.add('hidden'); startRound(); });
    $('btn-over-close').addEventListener('click', () => $('over-modal').classList.add('hidden'));
    $('btn-setup').addEventListener('click', showSetup);
    $('btn-restart').addEventListener('click', startRound);

    $('btn-play').addEventListener('click', onPlay);
    $('btn-pass').addEventListener('click', onPass);
    $('btn-hint').addEventListener('click', onHint);
    $('btn-bid-pass').addEventListener('click', () => doBid(ME, 0));
    [1, 2, 3].forEach(v => $('btn-bid-' + v).addEventListener('click', () => doBid(ME, v)));

    const closeModal = id => $(id).classList.add('hidden');
    $('btn-rules').addEventListener('click', () => $('rules-modal').classList.remove('hidden'));
    $('btn-close-rules').addEventListener('click', () => closeModal('rules-modal'));
    ['rules-modal', 'over-modal'].forEach(id => {
        $(id).addEventListener('click', e => { if (e.target === $(id)) closeModal(id); });
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeModal('rules-modal'); closeModal('over-modal'); return; }
        if (S.phase !== 'play' || S.turn !== ME) return;
        if (e.target.closest('button')) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPlay(); }
        else if (e.key === 'h' || e.key === 'H') onHint();
    });

    window.addEventListener('resize', () => {
        layoutHand();
        [0, 1, 2].forEach(s => {
            const zone = $('played-' + s);
            const row = zone.querySelector('.played-cards');
            if (row) fitPlayed(zone, row);
        });
    });
    renderRecord();

})();
