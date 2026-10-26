'use strict';
/* =====================================================================
 * 将棋 - 新手教程模块
 * 职责：教程关卡配置、局面初始化、走步校验、步骤引导与面板更新
 * ===================================================================== */

const PIECE_DESC = {
    王: '走法：向周围 8 个方向各走 1 格。\n全盘最重要的棋子，被将死即告负。先手记作「王」，后手记作「玉」。',
    金: '走法：向前、后、左、右、左前、右前共 6 个方向走 1 格，不能斜后退。\n金将不能升级。',
    银: '走法：向前、左前、右前、左后、右后共 5 个方向走 1 格，不能横走、不能正后退。\n升级后（成银）走法与金将相同。',
    桂: '走法：向正前方跳 2 格、再向左或右 1 格，可以越过棋子（没有绊马腿）。\n升级后（成桂）走法与金将相同。',
    香: '走法：向正前方直走任意格，不能后退、不能越过棋子。\n升级后（成香）走法与金将相同。',
    飞: '走法：向前、后、左、右直走任意格，不能越子。全盘最强棋子之一。\n升级为「龙王」后，还能斜向走 1 格。',
    角: '走法：沿 4 个斜线方向走任意格，不能越子。\n升级为「龙马」后，还能前后左右走 1 格。',
    步: '走法：只能向正前方走 1 格。\n升级为「と金」后走法与金将相同。注意：同一列不能有两个己方未升级的步兵（二步禁手）。'
};
const TUT_PIECE_ORDER = ['王', '步', '香', '桂', '银', '金', '角', '飞'];

function tutPos(pieces, hands1) {
    const s = new GameState();
    for (const x of pieces) s.set(x[0], x[1], { t: x[2], o: x[3], p: !!x[4] });
    if (hands1) Object.assign(s.hands[1], hands1);
    s.turn = 1;
    return s;
}

const TSTEPS = [
    {
        id: 'board',
        title: '第 1 步 · 棋盘介绍',
        interactive: false,
        zones: true,
        text:
            '将棋的棋盘是 <b>9×9 共 81 格</b>，双方各执 20 枚棋子。\n\n' +
            '你执<b>先手（☗）</b>，棋子在下方、向上进攻；AI 执<b>后手（☚）</b>，棋子倒放、向下进攻。\n\n' +
            '靠近你的三行是<b>自阵</b>（绿色区域），最上面三行是<b>敌阵</b>（红色区域）。棋子进入、离开或在敌阵内移动时可以选择<b>升级</b>（第 5 步详述）。',
        task: '本步为演示，点击「下一步」继续。',
        setup() {
            game.state = initialState();
        }
    },
    {
        id: 'pieces',
        title: '第 2 步 · 认识棋子',
        interactive: true,
        demo: true,
        text: function () {
            return (
                '<b>' +
                FULL_NAME[TUT_PIECE_ORDER[tut.sub]] +
                '（' +
                TUT_PIECE_ORDER[tut.sub] +
                '）</b>\n' +
                PIECE_DESC[TUT_PIECE_ORDER[tut.sub]] +
                '\n\n绿色圆点为它位于棋盘中央时的可走位置。'
            );
        },
        task: function () {
            return '已观看 ' + tut.seen.size + '/8 种棋子。看完所有棋子后可进入下一步。';
        },
        setup() {
            game.state = new GameState();
            game.state.set(8, 4, { t: '王', o: 1, p: false });
            game.state.set(0, 4, { t: '王', o: 2, p: false });
            setTutSub(tut.sub);
        }
    },
    {
        id: 'move',
        title: '第 3 步 · 走法演示',
        interactive: true,
        text: '点击<b>己方棋子</b>选中，绿色圆点是它当前能走的所有位置；再点击其中一个位置即可移动。\n\n移动后若再次点击该棋子可以重新查看走法。点击已选中的棋子或按右键 / Esc 可取消选择。',
        task: '试一试：任意移动一个己方棋子。',
        setup() {
            game.state = tutPos([
                [8, 4, '王', 1],
                [7, 3, '金', 1],
                [4, 4, '飞', 1],
                [7, 6, '桂', 1],
                [0, 8, '王', 2]
            ]);
        },
        check(_m, _info) {
            return true;
        },
        doneText: '很好！你已经完成了一次走子。',
        failText: ''
    },
    {
        id: 'capture',
        title: '第 4 步 · 吃子演示',
        interactive: true,
        text: '移动到<b>对方棋子所在的格子</b>即可吃掉它（绿圈表示可吃目标），被吃的棋子会进入你的驹台，之后可以重新打入棋盘（第 6 步详述）。',
        task: '试一试：用飞车吃掉同一行的对方银将。',
        setup() {
            game.state = tutPos([
                [8, 4, '王', 1],
                [4, 4, '飞', 1],
                [4, 7, '银', 2],
                [0, 4, '王', 2]
            ]);
        },
        check(m, info) {
            return !!info.captured;
        },
        doneText: '吃子成功！银将已进入你的驹台。',
        failText: '这一步没有吃到对方棋子，再试一次。'
    },
    {
        id: 'promote',
        title: '第 5 步 · 成金（升级）演示',
        interactive: true,
        text: '棋子<b>进入、离开或在敌阵内移动</b>时，会弹出「是否升级？」的询问。\n\n银/桂/香/步升级后走法与金将相同；飞车升级为<b>龙王</b>、角行升级为<b>龙马</b>（第 2 步已介绍）。到达最后一行的步兵、香车和最后两行的桂马<b>必须升级</b>。',
        task: '试一试：把银将移入敌阵（前三行），并在弹出窗口中选择「是」升级。',
        setup() {
            game.state = tutPos([
                [8, 4, '王', 1],
                [3, 4, '银', 1],
                [0, 8, '王', 2]
            ]);
        },
        check(m, info) {
            return !!info.promoted;
        },
        doneText: '升级成功！注意棋子上的字变成了红色——升级后走法与金将相同。',
        failText: '这次没有升级。把银将移到前三行并在弹窗中选「是」。'
    },
    {
        id: 'drop',
        title: '第 6 步 · 打入（持駒）演示',
        interactive: true,
        text: '轮到你时，点击<b>驹台上的棋子</b>，再点击棋盘空格即可「打入」。\n\n打入限制：\n· 同一列不能有两个己方未升级步兵（<b>二步禁手</b>）\n· 步兵/香车不能打入最后一行，桂马不能打入最后两行\n· 不能用打入的步兵直接将死对方（<b>打步诘</b>）',
        task: '试一试：把驹台中的棋子打入棋盘（第五列已有己方步兵，试试在那打入步兵看提示）。',
        setup() {
            game.state = tutPos(
                [
                    [8, 4, '王', 1],
                    [5, 4, '步', 1],
                    [0, 8, '王', 2]
                ],
                { 步: 1, 银: 1 }
            );
        },
        check(m) {
            return !!m.drop;
        },
        doneText: '打入完成！持駒是将棋最独特的规则。',
        failText: '请使用驹台中的棋子完成打入。'
    },
    {
        id: 'mate',
        title: '第 7 步 · 胜负判定演示',
        interactive: true,
        text: '给对方的王<b>将军（王手）</b>后，若对方无法用任何方式解除王手，即为<b>将死</b>，你获得胜利！\n\n现在对方的玉已经无路可逃——把飞车移到<b>最上面一行</b>，完成将死！',
        task: '试一试：移动飞车到顶行，将死对方的玉。',
        setup() {
            game.state = tutPos([
                [8, 4, '王', 1],
                [1, 3, '飞', 1],
                [2, 7, '金', 1],
                [0, 8, '王', 2]
            ]);
        },
        check(m, info) {
            return !!info.gameOver && info.winner === 1;
        },
        doneText: '将死！你完成了教程的全部内容 🎉',
        failText: '还没形成将死。提示：飞车直走到最上面一行。'
    }
];

const tut = {
    idx: 0,
    sub: 0,
    seen: new Set(),
    completed: new Array(TSTEPS.length).fill(false),
    finished: false,
    backup: null,
    reverting: false
};

function setTutSub(d) {
    tut.sub = (d + TUT_PIECE_ORDER.length) % TUT_PIECE_ORDER.length;
    tut.seen.add(tut.sub);
    const t = TUT_PIECE_ORDER[tut.sub];
    const piece = { t, o: 1, p: false };
    const moves = [];
    const pat = movePattern(t, false, 1);
    const r = 4,
        c = 4;
    if (pat.steps)
        for (const [dr, dc] of pat.steps) {
            const nr = r + dr,
                nc = c + dc;
            if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) moves.push(nr * 9 + nc);
        }
    if (pat.slides)
        for (const [dr, dc] of pat.slides) {
            let nr = r + dr,
                nc = c + dc;
            while (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
                moves.push(nr * 9 + nc);
                nr += dr;
                nc += dc;
            }
        }
    game.demo = { piece, moves };
    game.state = new GameState();
    game.state.set(8, 4, { t: '王', o: 1, p: false });
    game.state.set(0, 4, { t: '王', o: 2, p: false });
    if (tut.seen.size >= 8) tut.completed[1] = true;
    render();
    updateTutorialPanel();
}

function loadTutorialStep(i) {
    tut.idx = i;
    tut.backup = null;
    tut.reverting = false;
    const st = TSTEPS[i];
    game.searchToken++;
    game.selected = null;
    game.over = null;
    game.thinking = false;
    game.hint = false;
    game.demo = null;
    game.showZones = !!st.zones;
    game.undoStack = [];
    game.keys = [];
    game.keyCounts = {};
    game.anim = null;
    game.moveLog = [];
    renderLog();
    game.mode = 'tutorial';
    st.setup();
    recordKey();
    refreshTurn();
    render();
    updateTutorialPanel();
}

function startTutorial() {
    tut.idx = 0;
    tut.sub = 0;
    tut.seen = new Set();
    tut.completed = new Array(TSTEPS.length).fill(false);
    tut.finished = false;
    document.getElementById('tutorialPanel').style.display = '';
    loadTutorialStep(0);
    toast('已进入新手教程', 'ok');
}

function exitTutorial() {
    document.getElementById('tutorialPanel').style.display = 'none';
    game.mode = 'ai';
    game.demo = null;
    game.showZones = false;
    newGame();
    toast('已切换到人机对战模式', 'ok');
}

function tutorialAfterMove(m, info) {
    const st = TSTEPS[tut.idx];
    if (!st.check) {
        updateTutorialPanel();
        return;
    }
    const ok = st.check(m, {
        captured: info.captured,
        promoted: info.promoted,
        gameOver: !!game.over,
        winner: game.over ? game.over.winner : null
    });
    if (ok) {
        tut.completed[tut.idx] = true;
        toast('✓ ' + (st.doneText || '练习完成！'), 'ok');
        updateTutorialPanel();
    } else {
        tut.reverting = true;
        updateTutorialPanel();
        setTimeout(function () {
            if (game.mode !== 'tutorial' || tut.idx !== TSTEPS.indexOf(st)) return;
            if (tut.backup) restoreSnapshot(tut.backup);
            tut.reverting = false;
            toast(st.failText || '再试一次');
            updateTutorialPanel();
        }, 850);
    }
}

function updateTutorialPanel() {
    const st = TSTEPS[tut.idx];
    const prog = document.getElementById('tutProgress');
    const dots = document.getElementById('tutDots');
    const title = document.getElementById('tutTitle');
    const text = document.getElementById('tutText');
    const task = document.getElementById('tutTask');
    const subNav = document.getElementById('tutSubNav');
    prog.textContent = '第 ' + (tut.idx + 1) + '/' + TSTEPS.length + ' 步';
    let dh = '';
    for (let i = 0; i < TSTEPS.length; i++) {
        dh +=
            '<span class="dot' +
            (i === tut.idx ? ' cur' : tut.completed[i] || i < tut.idx ? ' done' : '') +
            '"></span>';
    }
    dots.innerHTML = dh;
    if (tut.finished) {
        title.textContent = '🎉 教程完成！';
        text.innerHTML =
            '恭喜你完成了将棋新手教程！<br>你已经掌握：<br>· 棋盘与自阵/敌阵<br>· 8 种棋子的走法<br>· 吃子、升级、打入<br>· 王手与将死<br><br>接下来去和 AI 下一局吧！';
        task.className = '';
        task.style.display = 'none';
        subNav.style.display = 'none';
        document.getElementById('tutPrev').disabled = false;
        document.getElementById('tutReset').style.display = 'none';
        const next = document.getElementById('tutNext');
        next.textContent = '进入人机对战';
        next.disabled = false;
        return;
    }
    title.textContent = st.title;
    text.innerHTML = typeof st.text === 'function' ? st.text() : st.text;
    const done = !st.interactive || tut.completed[tut.idx];
    task.style.display = '';
    task.className = done && st.interactive ? 'done' : '';
    task.innerHTML =
        (done && st.interactive ? '✓ 已完成：' : '任务：') + (typeof st.task === 'function' ? st.task() : st.task);
    subNav.style.display = st.demo ? 'flex' : 'none';
    if (st.demo) {
        document.getElementById('tutSubLabel').textContent = TUT_PIECE_ORDER[tut.sub] + '（' + (tut.sub + 1) + '/8）';
        document.getElementById('tutSubPrev').disabled = tut.sub === 0;
        document.getElementById('tutSubNext').disabled = false;
    }
    document.getElementById('tutPrev').disabled = tut.idx === 0;
    document.getElementById('tutReset').style.display = st.interactive ? '' : 'none';
    const next = document.getElementById('tutNext');
    next.textContent = '下一步';
    next.disabled = tut.reverting;
}

if (typeof window !== 'undefined') {
    window.PIECE_DESC = PIECE_DESC;
    window.TUT_PIECE_ORDER = TUT_PIECE_ORDER;
    window.TSTEPS = TSTEPS;
    window.tut = tut;
    window.setTutSub = setTutSub;
    window.loadTutorialStep = loadTutorialStep;
    window.startTutorial = startTutorial;
    window.exitTutorial = exitTutorial;
    window.tutorialAfterMove = tutorialAfterMove;
    window.updateTutorialPanel = updateTutorialPanel;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PIECE_DESC,
        TUT_PIECE_ORDER,
        TSTEPS,
        tut,
        setTutSub,
        loadTutorialStep,
        startTutorial,
        exitTutorial,
        tutorialAfterMove,
        updateTutorialPanel
    };
}
