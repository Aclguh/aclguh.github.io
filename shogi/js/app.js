'use strict';
/* =====================================================================
 * 将棋 - Shogi 界面渲染与控制器
 * 包含：Canvas 棋盘绘制、驹台 DOM 管理、教程系统、用户交互与对局流程
 * ===================================================================== */

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const VIEW = { size: 540, margin: 24, cell: (540 - 48) / 9 };

function layoutCanvas() {
    const col = document.getElementById('board-col');
    const w = Math.min(col.clientWidth || 540, 560);
    const size = Math.max(300, Math.floor(w));
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    VIEW.size = size;
    VIEW.margin = Math.round(size * 0.05);
    VIEW.cell = (size - VIEW.margin * 2) / 9;
    render();
}
function cellXY(r, c) {
    return { x: VIEW.margin + c * VIEW.cell, y: VIEW.margin + r * VIEW.cell };
}
function hitCell(px, py) {
    const c = Math.floor((px - VIEW.margin) / VIEW.cell);
    const r = Math.floor((py - VIEW.margin) / VIEW.cell);
    if (r < 0 || r > 8 || c < 0 || c > 8) return null;
    return { r, c };
}

/* 棋子显示名：先手王显示"王"，后手显示"玉"；升级显示升级名（红色小字） */
function displayName(p) {
    if (p.p) return { text: PROMOTED_NAME[p.t], red: true, small: true };
    if (p.t === '王') return { text: p.o === 1 ? '王' : '玉', red: p.o === 2, small: false };
    return { text: p.t, red: p.o === 2, small: false };
}

/* 钟形（五角形）棋子路径 */
function piecePath(w, h) {
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(w / 2, -h * 0.16);
    ctx.lineTo(w / 2, h / 2);
    ctx.lineTo(-w / 2, h / 2);
    ctx.lineTo(-w / 2, -h * 0.16);
    ctx.closePath();
}
function drawPiece(p, cx, cy, scale) {
    const cell = VIEW.cell;
    const w = cell * 0.74 * (scale || 1),
        h = cell * 0.84 * (scale || 1);
    ctx.save();
    ctx.translate(cx, cy);
    if (p.o === 2) ctx.rotate(Math.PI); // 后手棋子倒转
    ctx.shadowColor = 'rgba(0,0,0,.3)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1.5;
    piecePath(w, h);
    const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    if (p.o === 1) {
        g.addColorStop(0, '#fae9c6');
        g.addColorStop(1, '#e8c893');
    } else {
        g.addColorStop(0, '#fdf3d9');
        g.addColorStop(1, '#f0d6a4');
    }
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = '#7a4f22';
    ctx.stroke();
    const dn = displayName(p);
    ctx.fillStyle = dn.red ? (p.p ? '#d2193b' : '#a63a2c') : '#2f2418';
    ctx.font =
        'bold ' +
        Math.round(cell * (dn.small ? 0.3 : 0.44)) +
        'px "Noto Serif SC","Noto Serif CJK SC","SimSun","Microsoft YaHei",serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(dn.text, 0, cell * 0.02);
    ctx.restore();
}

const KANJI_RANKS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

/* 棋盘坐标名（如 5三）：与棋盘顶部/左侧标注一致 */
function squareName(r, c) {
    return String(9 - c) + KANJI_RANKS[r];
}
/* 日志用棋子简称 */
function pieceChar(p) {
    if (p.t === '王') return p.o === 1 ? '王' : '玉';
    return p.p ? PROMOTED_NAME[p.t] : p.t;
}
/* 对局记录渲染：先手黑 / 后手红 */
function renderLog() {
    const el = document.getElementById('moveLog');
    if (!el) return;
    if (!game.moveLog.length) {
        el.innerHTML = '<span class="log-empty">尚无走子</span>';
        return;
    }
    let h = '';
    for (let i = 0; i < game.moveLog.length; i++) {
        const e = game.moveLog[i];
        h += '<div class="mv p' + e.side + '"><span class="no">' + (i + 1) + '.</span>' + e.text + '</div>';
    }
    el.innerHTML = h;
    el.scrollTop = el.scrollHeight; // 自动滚动到最新
}

/* 主渲染函数 */
function render() {
    const s = game.state;
    const cell = VIEW.cell,
        M = VIEW.margin;
    ctx.clearRect(0, 0, VIEW.size, VIEW.size);

    /* 木质背景 */
    const bg = ctx.createLinearGradient(0, 0, VIEW.size, VIEW.size);
    bg.addColorStop(0, '#f0d5a3');
    bg.addColorStop(0.5, '#e9c48f');
    bg.addColorStop(1, '#dfb87e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VIEW.size, VIEW.size);
    // 木纹
    ctx.strokeStyle = 'rgba(139,90,43,0.06)';
    ctx.lineWidth = 1;
    for (let y = 8; y < VIEW.size; y += 14) {
        ctx.beginPath();
        ctx.moveTo(0, y + Math.sin(y * 0.7) * 2);
        ctx.bezierCurveTo(VIEW.size * 0.3, y + 4, VIEW.size * 0.6, y - 4, VIEW.size, y + 2);
        ctx.stroke();
    }

    /* 敌阵/自阵淡色提示（教程第1步加强显示） */
    const zoneAlpha = game.showZones ? 0.16 : 0.05;
    ctx.fillStyle = 'rgba(200,60,60,' + zoneAlpha + ')';
    ctx.fillRect(M, M, cell * 9, cell * 3);
    ctx.fillStyle = 'rgba(60,150,80,' + zoneAlpha + ')';
    ctx.fillRect(M, M + cell * 6, cell * 9, cell * 3);

    /* 网格线 */
    ctx.strokeStyle = '#6b4a2a';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 9; i++) {
        ctx.beginPath();
        ctx.moveTo(M + i * cell, M);
        ctx.lineTo(M + i * cell, M + 9 * cell);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(M, M + i * cell);
        ctx.lineTo(M + 9 * cell, M + i * cell);
        ctx.stroke();
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#543517';
    ctx.strokeRect(M, M, cell * 9, cell * 9);

    /* 坐标：顶部 9~1（从左到右），左侧 一~九 */
    ctx.fillStyle = '#7a5230';
    ctx.font = Math.max(9, Math.round(cell * 0.19)) + 'px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let c = 0; c < 9; c++) ctx.fillText(String(9 - c), M + c * cell + cell / 2, M / 2);
    for (let r = 0; r < 9; r++) ctx.fillText(KANJI_RANKS[r], M / 2, M + r * cell + cell / 2);

    if (!s) {
        renderKomadai();
        renderStatus();
        return;
    }

    /* 最后一步走法：黄色高亮 */
    if (game.lastMove) {
        ctx.fillStyle = 'rgba(255,208,0,0.35)';
        if (game.lastMove.from >= 0) {
            const a = cellXY(Math.floor(game.lastMove.from / 9), game.lastMove.from % 9);
            ctx.fillRect(a.x + 1, a.y + 1, cell - 2, cell - 2);
        }
        const bxy = cellXY(Math.floor(game.lastMove.to / 9), game.lastMove.to % 9);
        ctx.fillRect(bxy.x + 1, bxy.y + 1, cell - 2, cell - 2);
    }

    /* 提示模式：所有可动棋子蓝色虚线框 */
    if (game.hint && game.legal && game.legal.length) {
        ctx.save();
        ctx.strokeStyle = '#1565c0';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        const seen = new Set();
        for (const m of game.legal) {
            if (m.from < 0 || seen.has(m.from)) continue;
            seen.add(m.from);
            const a = cellXY(Math.floor(m.from / 9), m.from % 9);
            ctx.strokeRect(a.x + 3, a.y + 3, cell - 6, cell - 6);
        }
        ctx.restore();
    }

    /* 教程演示绿点（棋子走法演示） */
    if (game.demo) {
        for (const i of game.demo.moves) {
            const a = cellXY(Math.floor(i / 9), i % 9);
            ctx.fillStyle = 'rgba(46,125,50,0.8)';
            ctx.beginPath();
            ctx.arc(a.x + cell / 2, a.y + cell / 2, cell * 0.14, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /* 棋子（动画中的目标格棋子单独绘制） */
    for (let i = 0; i < 81; i++) {
        const p = s.board[i];
        if (!p) continue;
        if (game.anim && i === game.anim.toIdx) continue;
        const a = cellXY(Math.floor(i / 9), i % 9);
        drawPiece(p, a.x + cell / 2, a.y + cell / 2, 1);
    }

    /* 教程演示棋子（画在最上层） */
    if (game.demo) {
        const a = cellXY(4, 4);
        drawPiece(game.demo.piece, a.x + cell / 2, a.y + cell / 2, 1);
    }

    /* 移动动画与选中标记（完整走法范围：绿点/灰点/红底边） */
    drawAnim();
    drawSelectionMarks(s);

    /* 王手：被将的王红色警示 */
    if (!game.over && isInCheck(s, s.turn)) {
        const k = s.findKing(s.turn);
        if (k >= 0) {
            const a = cellXY(Math.floor(k / 9), k % 9);
            ctx.strokeStyle = 'rgba(220,40,40,0.9)';
            ctx.lineWidth = 4;
            ctx.strokeRect(a.x + 2, a.y + 2, cell - 4, cell - 4);
            ctx.fillStyle = 'rgba(220,40,40,0.22)';
            ctx.fillRect(a.x + 2, a.y + 2, cell - 4, cell - 4);
        }
    }

    /* 对局结束遮罩提示 */
    if (game.over) {
        ctx.fillStyle = 'rgba(20,12,5,0.45)';
        ctx.fillRect(0, 0, VIEW.size, VIEW.size);
        ctx.fillStyle = '#f6ecd6';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold ' + Math.round(VIEW.size * 0.055) + 'px "Noto Serif SC","Microsoft YaHei",serif';
        const msg =
            game.over.winner === 0
                ? '平 局'
                : game.mode === 'ai'
                  ? game.over.winner === 1
                      ? '你赢了！'
                      : '你输了'
                  : game.over.winner === 1
                    ? '将死！'
                    : '对局结束';
        ctx.fillText(msg, VIEW.size / 2, VIEW.size / 2 - VIEW.size * 0.02);
        ctx.font = Math.round(VIEW.size * 0.028) + 'px serif';
        ctx.fillText(game.over.reason || '', VIEW.size / 2, VIEW.size / 2 + VIEW.size * 0.045);
    }

    renderKomadai();
    renderStatus();
}

/* ---------- 移动动画 ---------- */
function animTick() {
    const a = game.anim;
    if (!a) return;
    a.t = Math.min(1, (performance.now() - a.start) / a.dur);
    render();
    if (a.t < 1) {
        requestAnimationFrame(animTick);
    } else {
        game.anim = null;
        render();
        if (a.onDone) a.onDone();
    }
}
function drawAnim() {
    const a = game.anim;
    if (!a) return;
    const cell = VIEW.cell;
    const x = 1 - Math.pow(1 - a.t, 3); // easeOutCubic 缓动
    const to = cellXY(Math.floor(a.toIdx / 9), a.toIdx % 9);
    if (a.drop) {
        // 打入：缩放 + 渐显
        ctx.save();
        ctx.globalAlpha = 0.3 + 0.7 * x;
        drawPiece(a.piece, to.x + cell / 2, to.y + cell / 2, 0.45 + 0.55 * x);
        ctx.restore();
        return;
    }
    const from = cellXY(Math.floor(a.fromIdx / 9), a.fromIdx % 9);
    if (a.captured) {
        // 被吃棋子渐隐
        ctx.save();
        ctx.globalAlpha = (1 - x) * 0.85;
        drawPiece(a.captured, to.x + cell / 2, to.y + cell / 2, 1);
        ctx.restore();
    }
    drawPiece(a.piece, from.x + cell / 2 + (to.x - from.x) * x, from.y + cell / 2 + (to.y - from.y) * x, 1);
}

/* ---------- 选中标记：完整走法范围 ---------- */
function drawSelectionMarks(s) {
    const sel = game.selected;
    if (!sel || game.over) return;
    const cell = VIEW.cell;
    if (sel.kind === 'hand') {
        for (const m of game.legal || []) {
            if (m.drop !== sel.type) continue;
            const a = cellXY(Math.floor(m.to / 9), m.to % 9);
            ctx.fillStyle = 'rgba(46,125,50,0.82)';
            ctx.beginPath();
            ctx.arc(a.x + cell / 2, a.y + cell / 2, cell * 0.14, 0, Math.PI * 2);
            ctx.fill();
        }
        return;
    }
    const isPreview = sel.kind === 'preview';
    const fromIdx = sel.idx;
    const p = s.board[fromIdx];
    if (!p) return;
    const legalSet = new Set(
        (isPreview ? sel.moves : (game.legal || []).filter((m) => m.from === fromIdx)).map((m) => m.to)
    );
    const pat = movePattern(p.t, p.p, p.o);
    const r = Math.floor(fromIdx / 9),
        c = fromIdx % 9;
    const shape = [];
    if (pat.steps)
        for (const d of pat.steps) {
            const nr = r + d[0],
                nc = c + d[1];
            if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) shape.push(nr * 9 + nc);
        }
    if (pat.slides)
        for (const d of pat.slides) {
            let nr = r + d[0],
                nc = c + d[1];
            while (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
                shape.push(nr * 9 + nc);
                nr += d[0];
                nc += d[1];
            }
        }
    const captures = [];
    const seen = new Set();
    for (const to of shape) {
        if (seen.has(to)) continue;
        seen.add(to);
        const a = cellXY(Math.floor(to / 9), to % 9);
        const q = s.board[to];
        if (legalSet.has(to)) {
            if (q) captures.push(to);
            else {
                ctx.fillStyle = 'rgba(46,125,50,0.82)';
                ctx.beginPath();
                ctx.arc(a.x + cell / 2, a.y + cell / 2, cell * 0.15, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            ctx.fillStyle = 'rgba(80,80,80,0.42)';
            ctx.beginPath();
            ctx.arc(a.x + cell / 2, a.y + cell / 2, cell * 0.1, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.save();
    ctx.fillStyle = '#d32f2f';
    ctx.shadowColor = 'rgba(211,47,47,0.8)';
    ctx.shadowBlur = 6;
    for (const to of captures) {
        const a = cellXY(Math.floor(to / 9), to % 9);
        roundBar(a.x + cell * 0.1, a.y + cell - 6, cell * 0.8, 4.5);
    }
    ctx.restore();
    const a2 = cellXY(Math.floor(fromIdx / 9), fromIdx % 9);
    ctx.strokeStyle = isPreview ? '#5c6bc0' : '#ff8f00';
    ctx.lineWidth = 3.5;
    if (isPreview) ctx.setLineDash([6, 4]);
    ctx.strokeRect(a2.x + 2, a2.y + 2, cell - 4, cell - 4);
    ctx.setLineDash([]);
}
function roundBar(x, y, w, h) {
    const rr = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
    ctx.fill();
}

/* 驹台渲染（DOM） */
function renderKomadai() {
    const s = game.state;
    const build = (el, owner, _clickable) => {
        let html = '';
        if (s) {
            for (const t of HAND_TYPES) {
                const n = s.hands[owner][t];
                if (n > 0) {
                    const selCls =
                        game.selected &&
                        game.selected.kind === 'hand' &&
                        game.selected.owner === owner &&
                        game.selected.type === t
                            ? ' sel'
                            : '';
                    const enemy = owner === 2 ? ' enemy' : '';
                    html +=
                        '<span class="chipbox' +
                        (owner === 2 ? ' enemybox' : '') +
                        '" data-owner="' +
                        owner +
                        '" data-type="' +
                        t +
                        '">' +
                        '<span class="chip' +
                        enemy +
                        selCls +
                        '">' +
                        t +
                        '</span>' +
                        (n > 1 ? '<span class="cnt">×' + n + '</span>' : '') +
                        '</span>';
                }
            }
        }
        el.innerHTML = html || '<span class="empty-tip">' + (owner === 2 ? '后手' : '先手') + '驹台（无持駒）</span>';
    };
    build(document.getElementById('k1'), 1, true);
    build(document.getElementById('k2'), 2, false);
}

/* 状态栏渲染 */
function renderStatus() {
    const s = game.state;
    const tb = document.getElementById('turnBadge');
    const cb = document.getElementById('checkBadge');
    const kb = document.getElementById('thinkBadge');
    cb.style.display = 'none';
    kb.style.display = 'none';
    if (!s) {
        return;
    }
    if (game.over) {
        tb.textContent = '对局结束';
        tb.className = '';
    } else if (game.thinking) {
        tb.textContent = 'AI（后手 ☚）思考中';
        tb.className = 'p2';
        kb.style.display = 'inline-block';
    } else if (game.mode === 'tutorial') {
        tb.textContent = '教程模式：按指引操作';
        tb.className = 'p1';
    } else {
        tb.textContent = s.turn === 1 ? '你的回合（先手 ☗）' : 'AI（后手 ☚）回合';
        tb.className = s.turn === 1 ? 'p1' : 'p2';
    }
    if (!game.over && isInCheck(s, s.turn)) cb.style.display = 'inline-block';
    renderButtons();
}

function renderButtons() {
    const inTut = game.mode === 'tutorial';
    document.getElementById('btnUndo').disabled =
        inTut || game.thinking || !!game.anim || game.undoStack.length === 0 || game.modalOpen;
    document.getElementById('btnRestart').disabled = game.thinking;
    document.getElementById('btnHint').disabled = !!game.over;
    document.getElementById('btnHint').classList.toggle('on', !!game.hint);
    document.getElementById('selLevel').disabled = inTut;
    document.getElementById('btnMode').textContent = inTut ? '切换到人机对战' : '切换到新手教程';
    document.getElementById('btnMode').disabled = game.thinking;
}

/* =====================================================================
 * 游戏控制器
 * ===================================================================== */

const game = {
    state: null,
    mode: 'ai',
    level: 'medium',
    selected: null,
    legal: [],
    lastMove: null,
    undoStack: [],
    keys: [],
    keyCounts: {},
    over: null,
    thinking: false,
    modalOpen: false,
    hint: false,
    demo: null,
    showZones: false,
    searchToken: 0,
    anim: null,
    moveLog: []
};

function makeSnapshot() {
    return {
        snap: serializeState(game.state),
        lastMove: game.lastMove ? { ...game.lastMove } : null,
        keys: game.keys.slice(),
        keyCounts: { ...game.keyCounts },
        over: game.over,
        logLen: game.moveLog.length
    };
}
function restoreSnapshot(e) {
    game.state = deserializeState(e.snap);
    game.lastMove = e.lastMove;
    game.keys = e.keys;
    game.keyCounts = e.keyCounts;
    game.over = e.over;
    game.selected = null;
    game.thinking = false;
    game.anim = null;
    game.moveLog.length = e.logLen || 0;
    renderLog();
    refreshTurn();
    render();
}
function refreshTurn() {
    game.legal = generateLegalMoves(game.state, game.state.turn, true);
}
function recordKey() {
    const k = stateKey(game.state);
    game.keys.push(k);
    game.keyCounts[k] = (game.keyCounts[k] || 0) + 1;
    return game.keyCounts[k];
}

function newGame() {
    game.searchToken++;
    game.state = initialState();
    game.selected = null;
    game.lastMove = null;
    game.over = null;
    game.thinking = false;
    game.hint = false;
    game.undoStack = [];
    game.keys = [];
    game.keyCounts = {};
    game.demo = null;
    game.showZones = false;
    game.anim = null;
    game.moveLog = [];
    renderLog();
    recordKey();
    refreshTurn();
    render();
}

function applyRealMove(m, opts) {
    opts = opts || {};
    const s = game.state;
    game.selected = null;
    const side = s.turn;
    const moverPiece = m.drop ? { t: m.drop, o: side, p: false } : { ...s.board[m.from] };
    const capturedPiece = m.drop ? null : s.board[m.to];
    const toName = squareName(Math.floor(m.to / 9), m.to % 9);
    s.makeMove(m);
    game.lastMove = { from: m.from, to: m.to };
    const rep = recordKey();
    if (rep >= 4 && !game.over) {
        game.over = { winner: 0, reason: '千日手：同一局面出现四次，判为平局' };
    }
    let text = side === 1 ? '☗' : '☚';
    if (m.drop) {
        text += m.drop + ' 打入' + toName;
    } else {
        text += pieceChar(moverPiece) + ' ' + squareName(Math.floor(m.from / 9), m.from % 9) + '→' + toName;
        if (capturedPiece) text += ' 吃' + pieceChar(capturedPiece);
        if (m.promote) text += ' 成';
    }
    game.moveLog.push({ side, text });
    renderLog();
    if (opts.animate !== false) {
        game.anim = {
            fromIdx: m.from,
            toIdx: m.to,
            piece: moverPiece,
            captured: capturedPiece ? { ...capturedPiece } : null,
            drop: !!m.drop,
            start: performance.now(),
            dur: m.drop ? 240 : 230,
            t: 0,
            onDone: null
        };
        requestAnimationFrame(animTick);
    }
    render();
    return { captured: capturedPiece ? capturedPiece.t : null, promoted: !m.drop && m.promote };
}

function postMoveFlow(m, info) {
    refreshTurn();
    if (!game.over && game.legal.length === 0) {
        const loser = game.state.turn;
        game.over = {
            winner: 3 - loser,
            reason: isInCheck(game.state, loser) ? '将死（王手无法解除）' : '无合法走法'
        };
    }
    if (!game.over && isInCheck(game.state, game.state.turn)) {
        toast('王手！', 'err');
    }
    render();
    if (game.over) {
        setTimeout(showGameOverModal, 600);
        if (game.mode === 'tutorial') {
            tutorialAfterMove(m, info);
        }
        return;
    }
    if (game.mode === 'tutorial') {
        tutorialAfterMove(m, info);
    } else if (game.state.turn === 2) {
        if (game.anim) game.anim.onDone = scheduleAI;
        else scheduleAI();
    }
}

function commitPlayerMove(m) {
    if (game.mode === 'tutorial') tut.backup = makeSnapshot();
    else game.undoStack.push(makeSnapshot());
    if (game.undoStack.length > 300) game.undoStack.shift();
    const info = applyRealMove(m);
    postMoveFlow(m, info);
}

function resolvePromotionAndCommit(m) {
    if (m.promotable && !m.forced) {
        const p = game.state.board[m.from];
        const dn = displayName(p);
        const pname = PROMOTED_NAME[p.t];
        let extra;
        if (p.t === '飞' || p.t === '角')
            extra = p.t === '飞' ? '升级后保留飞车走法，另可斜向走1格。' : '升级后保留角行走法，另可前后左右走1格。';
        else extra = '升级后走法与金将相同。';
        showModal(
            '是否升级？',
            '「' + (dn.small ? dn.text : dn.text) + '」进入敌阵，可以升级为「' + pname + '」。\n' + extra,
            [
                {
                    label: '是（升级）',
                    primary: true,
                    cb: function () {
                        m.promote = true;
                        hideModal();
                        commitPlayerMove(m);
                    }
                },
                {
                    label: '否（保持）',
                    cb: function () {
                        m.promote = false;
                        hideModal();
                        commitPlayerMove(m);
                    }
                }
            ]
        );
    } else {
        if (m.forced) {
            const p = game.state.board[m.from];
            toast(FULL_NAME[p.t] + '到达最后一行，必须升级（已自动升级为' + PROMOTED_NAME[p.t] + '）', 'ok');
        }
        commitPlayerMove(m);
    }
}

let aiWorker = null;

function initAiWorker() {
    if (typeof Worker !== 'undefined') {
        try {
            aiWorker = new Worker('js/ai-worker.js');
            aiWorker.onmessage = function (e) {
                const data = e.data || {};
                if (data.token !== game.searchToken || game.over) {
                    game.thinking = false;
                    return;
                }
                game.thinking = false;
                if (!data.success || !data.res || !data.res.move) {
                    render();
                    return;
                }
                const m = data.res.move;
                applyRealMove(m);
                postMoveFlow(m, { captured: null, promoted: !m.drop && m.promote, ai: true });
            };
            aiWorker.onerror = function (err) {
                console.warn('AI Worker error, fallback to main thread:', err);
                aiWorker = null;
            };
        } catch (err) {
            console.warn('Worker creation failed, fallback to main thread:', err);
            aiWorker = null;
        }
    }
}

function scheduleAI() {
    game.thinking = true;
    const token = game.searchToken;
    render();

    if (aiWorker) {
        try {
            aiWorker.postMessage({
                type: 'calculate',
                token: token,
                serializedState: serializeState(game.state),
                level: game.level
            });
            return;
        } catch (e) {
            console.warn('Worker postMessage failed, falling back to main thread', e);
        }
    }

    setTimeout(function () {
        if (token !== game.searchToken || game.over) {
            game.thinking = false;
            return;
        }
        const res = aiChooseMove(game.state, game.level);
        game.thinking = false;
        if (!res || !res.move) {
            render();
            return;
        }
        const m = res.move;
        applyRealMove(m);
        postMoveFlow(m, { captured: null, promoted: !m.drop && m.promote, ai: true });
    }, 160);
}

function canAct() {
    if (!game.state || game.over || game.modalOpen) return false;
    if (game.thinking) return false;
    if (game.anim) return false;
    if (game.demo) return false;
    if (game.mode === 'tutorial') return game.state.turn === 1;
    return game.state.turn === 1;
}
function deselect() {
    game.selected = null;
    render();
}

function onCellClick(r, c) {
    const s = game.state;
    if (!s) return;
    if (game.modalOpen) return;
    if (game.over) {
        toast('对局已结束，可点击「重新开始」');
        return;
    }
    if (game.demo) {
        toast('演示模式：请使用右侧教程面板切换棋子');
        return;
    }
    if (game.anim) return;
    const idx = r * 9 + c;
    const p = s.board[idx];
    const isMyTurn = s.turn === 1 && !game.thinking;
    if (!isMyTurn && !(p && p.o === 2)) {
        if (game.thinking) toast('AI思考中，请稍候…');
        else toast('请等待 AI 走棋');
        return;
    }
    const sel = game.selected;
    if (isMyTurn && sel && sel.kind !== 'preview') {
        if (sel.kind === 'board') {
            if (sel.idx === idx) {
                deselect();
                return;
            }
            if (p && p.o === 1) {
                selectBoard(idx);
                return;
            }
            const cands = game.legal.filter((m) => m.from === sel.idx && m.to === idx);
            if (cands.length) {
                resolvePromotionAndCommit(cands[0]);
                return;
            }
            if (p && p.o === 2) {
                previewEnemy(idx);
                return;
            }
            deselect();
            return;
        }
        if (sel.kind === 'hand') {
            if (!p) {
                const cands = game.legal.filter((m) => m.drop === sel.type && m.to === idx);
                if (cands.length) {
                    commitPlayerMove(cands[0]);
                    return;
                }
                const why = dropRejectionReason(s, s.turn, sel.type, r, c);
                toast(why || '此处不能打入');
                deselect();
                return;
            }
            if (p.o === 1) {
                selectBoard(idx);
                return;
            }
            if (p.o === 2) {
                previewEnemy(idx);
                return;
            }
            return;
        }
    }
    if (p && p.o === 1 && isMyTurn) {
        selectBoard(idx);
        return;
    }
    if (p && p.o === 2) {
        previewEnemy(idx);
        return;
    }
    if (sel) deselect();
}
function selectBoard(idx) {
    game.selected = { kind: 'board', idx };
    render();
}
function previewEnemy(idx) {
    if (game.selected && game.selected.kind === 'preview' && game.selected.idx === idx) {
        deselect();
        return;
    }
    const legal = generateLegalMoves(game.state, 2, true).filter((m) => m.from === idx);
    game.selected = { kind: 'preview', idx, moves: legal };
    render();
}
function onHandClick(owner, type) {
    if (owner !== 1) return;
    if (!canAct()) {
        if (game.thinking) toast('AI思考中，请稍候…');
        return;
    }
    if (game.state.hands[1][type] <= 0) return;
    if (game.selected && game.selected.kind === 'hand' && game.selected.type === type) {
        deselect();
        return;
    }
    game.selected = { kind: 'hand', owner: 1, type };
    render();
}

function undoMove() {
    if (game.mode !== 'ai' || game.thinking || game.modalOpen) return;
    if (!game.undoStack.length) return;
    game.searchToken++;
    let e = null;
    while (game.undoStack.length) {
        e = game.undoStack.pop();
        if (e.snap.turn === 1) break;
    }
    if (e) {
        restoreSnapshot(e);
        toast('已悔棋', 'ok');
    }
}

let toastTimer = null;
function toast(msg, type) {
    if (typeof Toast !== 'undefined' && Toast.show) {
        Toast.show(msg, type || 'info');
        return;
    }
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'show' + (type ? ' ' + type : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
        el.className = '';
    }, 2400);
}
function showModal(title, bodyHTML, buttons) {
    game.modalOpen = true;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHTML.replace(/\n/g, '<br>');
    const box = document.getElementById('modalBtns');
    box.innerHTML = '';
    for (const b of buttons) {
        const btn = document.createElement('button');
        btn.className = 'btn' + (b.primary ? ' primary' : '');
        btn.textContent = b.label;
        btn.onclick = b.cb;
        box.appendChild(btn);
    }
    document.getElementById('overlay').classList.add('show');
}
function hideModal() {
    game.modalOpen = false;
    document.getElementById('overlay').classList.remove('show');
    render();
}
function showGameOverModal() {
    const o = game.over;
    if (!o) return;
    let title, body;
    if (o.winner === 0) {
        title = '平局';
        body = o.reason;
    } else if (game.mode === 'ai') {
        title = o.winner === 1 ? '🎉 你赢了！' : '你输了';
        body = o.winner === 1 ? '你成功将死了对方的玉，恭喜获胜！' : '你的王被' + (o.reason || '') + '了，再接再厉！';
    } else {
        title = o.winner === 1 ? '将死成功！' : '对局结束';
        body = o.reason || '';
    }
    showModal(title, body, [
        {
            label: '再来一局',
            primary: true,
            cb: function () {
                hideModal();
                if (game.mode === 'tutorial') {
                    loadTutorialStep(tut.idx);
                } else newGame();
            }
        },
        {
            label: '查看棋盘',
            cb: function () {
                hideModal();
            }
        }
    ]);
}

/* =====================================================================
 * 新手教程（已独立解耦至 js/tutorial.js）
 * ===================================================================== */

/* =====================================================================
 * 初始化与事件绑定
 * ===================================================================== */

function bindEvents() {
    canvas.addEventListener('click', function (e) {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (VIEW.size / rect.width);
        const y = (e.clientY - rect.top) * (VIEW.size / rect.height);
        const cell = hitCell(x, y);
        if (cell) onCellClick(cell.r, cell.c);
        else if (game.selected) deselect();
    });
    canvas.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        if (game.selected) deselect();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            if (game.modalOpen) return;
            if (game.selected) deselect();
        }
    });

    for (const id of ['k1', 'k2']) {
        document.getElementById(id).addEventListener('click', function (e) {
            const box = e.target.closest('.chipbox');
            if (!box) return;
            onHandClick(parseInt(box.dataset.owner, 10), box.dataset.type);
        });
    }

    document.getElementById('btnRestart').addEventListener('click', function () {
        if (game.thinking) return;
        if (game.mode === 'tutorial') {
            loadTutorialStep(tut.idx);
            toast('已重置本步', 'ok');
        } else {
            newGame();
            toast('新对局开始，你执先手', 'ok');
        }
    });
    document.getElementById('btnUndo').addEventListener('click', undoMove);
    document.getElementById('btnMode').addEventListener('click', function () {
        if (game.thinking) return;
        if (game.mode === 'ai') startTutorial();
        else exitTutorial();
    });
    document.getElementById('btnHint').addEventListener('click', function () {
        game.hint = !game.hint;
        render();
        if (game.hint) toast('提示已开启：蓝框棋子均有合法走法');
    });
    document.getElementById('selLevel').addEventListener('change', function (e) {
        game.level = e.target.value;
        const names = { easy: '简单', medium: '中等', hard: '困难' };
        toast('难度已切换为「' + names[game.level] + '」', 'ok');
    });

    document.getElementById('tutPrev').addEventListener('click', function () {
        if (tut.idx > 0) loadTutorialStep(tut.idx - 1);
    });
    document.getElementById('tutNext').addEventListener('click', function () {
        if (tut.finished) {
            exitTutorial();
            return;
        }
        const st = TSTEPS[tut.idx];
        const done = !st.interactive || tut.completed[tut.idx];
        if (!done) {
            toast('请先完成本步练习（或点击「重置本步」重来）');
            return;
        }
        if (tut.idx === TSTEPS.length - 1) {
            tut.finished = true;
            updateTutorialPanel();
            return;
        }
        loadTutorialStep(tut.idx + 1);
    });
    document.getElementById('tutReset').addEventListener('click', function () {
        loadTutorialStep(tut.idx);
        toast('已重置本步', 'ok');
    });
    document.getElementById('tutSubPrev').addEventListener('click', function () {
        setTutSub(tut.sub - 1);
    });
    document.getElementById('tutSubNext').addEventListener('click', function () {
        setTutSub(tut.sub + 1);
        if (tut.seen.size >= 8) tut.completed[1] = true;
        updateTutorialPanel();
    });

    let resizeTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(layoutCanvas, 120);
    });
}

function init() {
    initAiWorker();
    bindEvents();
    layoutCanvas();
    newGame();
    toast('欢迎来到将棋！你执先手（下方），点击棋子开始', 'ok');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
