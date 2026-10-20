/**
 * =====================================================================
 * 天国骰子 - 桌面与骰子动画表现层模块 (UI Board)
 * 负责骰子 3D 物理运动、碰撞回弹散发、停放排布、悬浮提示与日志横幅
 * =====================================================================
 */
(function (global) {
    'use strict';

    const $ = (id) => (typeof document !== 'undefined' ? document.getElementById(id) : null);

    const rollDie = () => 1 + Math.floor(Math.random() * 6);
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));

    /* ── 场地几何 ───────────────────── */
    const dieSize = () => (typeof window !== 'undefined' && window.innerWidth <= 600 ? 46 : 56);
    const parkW = () => (typeof window !== 'undefined' && window.innerWidth <= 600 ? 165 : 250);
    const parkScale = () =>
        Math.min(
            typeof window !== 'undefined' && window.innerWidth <= 600 ? 0.5 : 0.6,
            (parkW() - 33) / (6 * dieSize())
        );

    /* ── 提示横幅与日志 ─────────────── */
    function setBanner(text, cls) {
        const banner = $('table-banner');
        if (!banner) return;
        banner.textContent = text;
        banner.className = 'table-banner' + (cls ? ' ' + cls : '');
    }

    function log(text, cls) {
        const logBox = $('log');
        if (!logBox) return;
        const line = document.createElement('div');
        line.className = 'log-line' + (cls ? ' ' + cls : '');
        line.innerHTML = text;
        logBox.appendChild(line);
        logBox.scrollTop = logBox.scrollHeight;
    }

    /* ── 骰子悬浮提示 Tooltip ───────── */
    const DIE_TOOLTIP_DELAY_MS = 500;
    let dieTooltipTimer = null;
    let pendingTooltipData = null;

    function scheduleDieTooltip(die, el, who, e) {
        cancelDieTooltipTimer();
        pendingTooltipData = { die, el, who, e };
        dieTooltipTimer = setTimeout(() => {
            if (pendingTooltipData) {
                showDieTooltip(
                    pendingTooltipData.die,
                    pendingTooltipData.el,
                    pendingTooltipData.who,
                    pendingTooltipData.e
                );
                pendingTooltipData = null;
            }
        }, DIE_TOOLTIP_DELAY_MS);
    }

    function cancelDieTooltipTimer() {
        if (dieTooltipTimer) {
            clearTimeout(dieTooltipTimer);
            dieTooltipTimer = null;
        }
        pendingTooltipData = null;
    }

    function showDieTooltip(die, el, who, e) {
        const tt = $('die-tooltip');
        if (!tt) return;
        const def =
            die && die.dieDef
                ? die.dieDef
                : typeof getDieDef === 'function'
                  ? getDieDef('ordinary')
                  : { name: '普通骰', desc: '各面概率均等', weights: [1, 1, 1, 1, 1, 1] };
        const ttName = $('tt-name');
        const ttTag = $('tt-tag');
        const ttOwner = $('tt-owner');
        const ttDesc = $('tt-desc');
        const ttProbsGrid = $('tt-probs-grid');

        if (ttName) ttName.textContent = def.name;
        if (ttTag) ttTag.textContent = def.tag || '骰子';
        if (ttOwner) ttOwner.textContent = who === 'me' ? '你的骰子' : '对手的骰子';
        if (ttDesc) ttDesc.textContent = def.desc;

        if (ttProbsGrid && typeof calcProbs === 'function') {
            const probs = calcProbs(def.weights);
            ttProbsGrid.innerHTML = '';
            probs.forEach((p, idx) => {
                const col = document.createElement('div');
                col.className = 'tt-prob-col';
                const face = idx + 1;
                const hi = p >= 25;
                const lo = p < 10;
                col.innerHTML = `
                    <span class="tt-prob-face">${face}点</span>
                    <span class="tt-prob-val ${hi ? 'hi' : lo ? 'lo' : ''}">${p}%</span>
                `;
                ttProbsGrid.appendChild(col);
            });
        }

        tt.classList.remove('hidden');
        positionDieTooltip(el, e);
    }

    function positionDieTooltip(el, e) {
        const tt = $('die-tooltip');
        if (!tt || tt.classList.contains('hidden')) return;
        const rect = el.getBoundingClientRect();
        const ttW = tt.offsetWidth || 260;
        const ttH = tt.offsetHeight || 130;

        let left = rect.left + rect.width / 2;
        let top = rect.top - 8;

        if (left - ttW / 2 < 10) left = ttW / 2 + 10;
        if (left + ttW / 2 > window.innerWidth - 10) left = window.innerWidth - 10 - ttW / 2;
        if (top - ttH < 10) {
            top = rect.bottom + 8;
            tt.style.transform = 'translate(-50%, 0)';
        } else {
            tt.style.transform = 'translate(-50%, -100%)';
        }

        tt.style.left = left + 'px';
        tt.style.top = top + 'px';
    }

    function hideDieTooltip() {
        cancelDieTooltipTimer();
        const tt = $('die-tooltip');
        if (!tt) return;
        tt.classList.add('hidden');
    }

    /* ── 单个玩家面板 ───────────────── */
    class Panel {
        constructor(rootId, key, flipped) {
            this.root = $(rootId);
            this.key = key;
            this.flipped = flipped;
            this.field = this.root ? this.root.querySelector('.table-field') : null;
            this.diceLayer = this.root ? this.root.querySelector('.dice-layer') : null;
            this.parkLayer = this.root ? this.root.querySelector('.park-layer') : null;
            this.dice = [];
            this.parked = [];
            this.rounds = [];
            this.dicePool = [];
            if (this.field) {
                this.ring = document.createElement('div');
                this.ring.className = 'roll-ring';
                this.field.appendChild(this.ring);
            }
        }

        layoutPark() {
            if (!this.field) return [];
            const s = dieSize(),
                sc = parkScale();
            const W = this.field.clientWidth,
                H = this.field.clientHeight;
            const vis = s * sc;
            const step = Math.round(vis + 5);
            const firstX = this.flipped ? W - 8 - s : 8;
            const dir = this.flipped ? -1 : 1;
            let curY = this.flipped ? H - 24 - s : 24;
            const out = [];
            this.rounds.forEach((count) => {
                for (let k = 0; k < count; k++) {
                    out.push({ x: firstX + dir * k * step, y: curY });
                }
                curY += this.flipped ? -step : step;
            });
            return out;
        }

        dieEl(id) {
            return this.diceLayer ? this.diceLayer.querySelector(`[data-id="${id}"]`) : null;
        }

        renderActive(selectable) {
            if (!this.diceLayer) return;
            this.diceLayer.innerHTML = '';
            this.dice.forEach((d) => {
                const el = makeDieEl(d, this.key);
                if (d.selected) el.classList.add('selected', this.key);
                el.addEventListener('click', () => {
                    if (typeof global.onDieClickDispatcher === 'function') {
                        global.onDieClickDispatcher(d, this);
                        return;
                    }
                    if (typeof state !== 'undefined' && state.targeting && this.key === 'me') {
                        if (typeof onTargetClick === 'function') onTargetClick(d);
                        return;
                    }
                    if (typeof toggleSelect === 'function') toggleSelect(d.id, this);
                });
                if (selectable) el.classList.add('selectable');
                this.diceLayer.appendChild(el);
            });
        }

        clear() {
            this.dice = [];
            this.parked = [];
            this.rounds = [];
            if (this.diceLayer) this.diceLayer.innerHTML = '';
            if (this.parkLayer) this.parkLayer.innerHTML = '';
            if (this.field) this.field.classList.remove('rolling');
        }
    }

    /* ── 投掷区几何（空心圆范围 / 环） ── */
    function rollGeom(panel) {
        const s = dieSize(),
            pw = parkW();
        const W = panel.field.clientWidth,
            H = panel.field.clientHeight;
        const xMin = (panel.flipped ? 6 : pw + 6) + s / 2;
        const xMax = (panel.flipped ? W - pw - 6 : W - 6) - s / 2;
        const yMin = 12 + s / 2;
        const yMax = H - 8 - s / 2;
        const cx = (xMin + xMax) / 2,
            cy = (yMin + yMax) / 2;
        const R = Math.max(s * 1.9, Math.min(xMax - xMin, yMax - yMin) * 0.48);
        return {
            s,
            xMin,
            xMax,
            yMin,
            yMax,
            cx,
            cy,
            R,
            lim: R - s * 0.72
        };
    }

    function layoutPositions(panel, n) {
        const g = rollGeom(panel);
        const minD = g.s * 1.06;

        const relax = (pts, iters) => {
            for (let it = 0; it < iters; it++) {
                let moved = false;
                for (let i = 0; i < n; i++) {
                    for (let j = i + 1; j < n; j++) {
                        let dx = pts[j].x - pts[i].x,
                            dy = pts[j].y - pts[i].y;
                        let d = Math.hypot(dx, dy);
                        if (d < 1e-4) {
                            dx = 1;
                            dy = 0;
                            d = 1;
                        }
                        if (d < minD) {
                            const push = (minD - d) / 2;
                            dx /= d;
                            dy /= d;
                            pts[i].x -= dx * push;
                            pts[i].y -= dy * push;
                            pts[j].x += dx * push;
                            pts[j].y += dy * push;
                            moved = true;
                        }
                    }
                }
                pts.forEach((p) => {
                    const dx = p.x - g.cx,
                        dy = p.y - g.cy;
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
        const minPair = (pts) => {
            let m = Infinity;
            for (let i = 0; i < pts.length; i++) {
                for (let j = i + 1; j < pts.length; j++) {
                    m = Math.min(m, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
                }
            }
            return m;
        };
        const inCircle = (p) => Math.hypot(p.x - g.cx, p.y - g.cy) <= g.lim + 0.5;

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
            return radial.map((p) => ({ x: p.x - g.s / 2, y: p.y - g.s / 2 }));
        }

        const boxW = g.lim * 2,
            boxH = g.lim * 2;
        let best = null;
        for (let cols = 1; cols <= n; cols++) {
            const rows = Math.ceil(n / cols);
            const cellW = boxW / cols,
                cellH = boxH / rows;
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
                const off = ((best.cols - m) * best.cellW) / 2;
                pts.push({
                    x: g.cx - boxW / 2 + off + (c + 0.5) * best.cellW + (Math.random() - 0.5) * best.cellW * 0.3,
                    y: g.cy - boxH / 2 + (r + 0.5) * best.cellH + (Math.random() - 0.5) * best.cellH * 0.3
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
        return pts.map((p) => ({ x: p.x - g.s / 2, y: p.y - g.s / 2 }));
    }

    const ROLL_MS = 950;

    function flashRing(panel) {
        if (!panel.ring) return;
        const now = performance.now();
        if (now - (panel.lastRingPulse || 0) < 90) return;
        panel.lastRingPulse = now;
        panel.ring.classList.add('pulse');
        setTimeout(() => panel.ring.classList.remove('pulse'), 110);
    }

    function rollAnimation(panel, values) {
        return new Promise((resolve) => {
            const g = rollGeom(panel);
            const n = panel.dice.length;
            const finals = layoutPositions(panel, n);
            const speedPerMs = g.R * 0.005;

            panel.ring.style.left = g.cx - g.R + 'px';
            panel.ring.style.top = g.cy - g.R + 'px';
            panel.ring.style.width = panel.ring.style.height = g.R * 2 + 'px';
            panel.field.classList.add('rolling');

            const st = panel.dice.map((d, i) => {
                const a = (Math.PI * 2 * i) / n + Math.random() * 0.8;
                const rr = g.R * (0.15 + Math.random() * 0.5);
                const x = g.cx + Math.cos(a) * rr;
                const y = g.cy + Math.sin(a) * rr;
                const rot = Math.round(Math.random() * 360);
                const dir = Math.random() * Math.PI * 2;
                d.x = x - g.s / 2;
                d.y = y - g.s / 2;
                d.rot = rot;
                return {
                    d,
                    x,
                    y,
                    el: null,
                    vx: Math.cos(dir) * speedPerMs,
                    vy: Math.sin(dir) * speedPerMs,
                    rot,
                    vr: (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.35)
                };
            });
            panel.renderActive(false);
            st.forEach((o) => {
                o.el = panel.dieEl(o.d.id);
            });

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
                        o.el.style.transform = `translate3d(${o.d.x}px, ${o.d.y}px, 0) rotate(${o.rot}deg) scale(1)`;
                    }
                }
            };

            const finish = () => {
                done = true;
                cancelAnimationFrame(rafId);
                clearInterval(hiddenTimer);
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
                        if (d.isJoker) el.classList.add('is-joker');
                        else el.classList.remove('is-joker');
                        placeDie(el, d);
                    }
                });
                setTimeout(resolve, maxDur + 60);
            };

            const step = (now) => {
                const dt = Math.min(now - last, 64);
                last = now;
                if (dt <= 0) return;
                for (const o of st) {
                    o.x += o.vx * dt;
                    o.y += o.vy * dt;
                    o.rot += o.vr * dt;
                }
                for (const o of st) {
                    const dx = o.x - g.cx,
                        dy = o.y - g.cy;
                    const dist = Math.hypot(dx, dy) || 0.01;
                    if (dist > g.lim) {
                        const nx = dx / dist,
                            ny = dy / dist;
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
                    [...panel.diceLayer.children].forEach((el) => {
                        el.dataset.value = rollDie();
                    });
                }
                if (now - t0 > ROLL_MS) finish();
            };

            const rafLoop = (now) => {
                if (done) return;
                step(now);
                if (!done) rafId = requestAnimationFrame(rafLoop);
            };
            rafId = requestAnimationFrame(rafLoop);
            const hiddenTimer = setInterval(() => {
                if (done) return;
                const now = performance.now();
                if (now - last > 120) step(now);
            }, 100);
        });
    }

    function makeDieEl(die, who) {
        const el = document.createElement('div');
        el.className = 'die';
        el.dataset.id = die.id;
        el.dataset.value = die.value;
        const def =
            die.dieDef ||
            (typeof getDieDef === 'function' ? getDieDef('ordinary') : { id: 'ordinary', name: '普通骰', desc: '' });
        el.dataset.dieId = def.id;
        if (die.isJoker) el.classList.add('is-joker');
        if (def.color) el.style.borderColor = def.color;
        el.setAttribute('aria-label', `${def.name}：${def.desc}`);
        el.style.setProperty('--rot', '0deg');
        for (let i = 1; i <= 9; i++) {
            const pip = document.createElement('span');
            pip.className = 'pip p' + i;
            el.appendChild(pip);
        }
        placeDie(el, die);

        el.addEventListener('mouseenter', (e) => scheduleDieTooltip(die, el, who, e));
        el.addEventListener('mouseleave', hideDieTooltip);
        el.addEventListener('mousedown', hideDieTooltip);
        el.addEventListener('mousemove', (e) => {
            if (pendingTooltipData) {
                pendingTooltipData.e = e;
            } else {
                positionDieTooltip(el, e);
            }
        });

        return el;
    }

    function placeDie(el, die) {
        el.style.setProperty('--rot', die.rot + 'deg');
        el.style.transform = `translate3d(${die.x}px, ${die.y}px, 0) rotate(${die.rot}deg) scale(${die.scale || 1})`;
    }

    function parkDice(panel, dice) {
        if (!dice.length) return;
        panel.rounds.push(dice.length);
        const pos = panel.layoutPark();
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
                el.style.transitionDuration = '';
                el.classList.remove('selected', 'selectable');
                el.classList.add('parked');
                panel.parkLayer.appendChild(el);
                placeDie(el, d);
            }
        });
        panel.dice = panel.dice.filter((d) => !d.parked);
    }

    async function rerollDice(panel, dice) {
        hideDieTooltip();
        const elsDice = dice.map((d) => panel.dieEl(d.id)).filter(Boolean);
        elsDice.forEach((el) => {
            el.classList.remove('selected', 'targetable', 'picked');
            el.classList.add('rerolling');
        });
        const flicker = setInterval(() => {
            elsDice.forEach((el) => {
                el.dataset.value = rollDie();
            });
        }, 90);
        await delay(620);
        clearInterval(flicker);
        dice.forEach((d) => {
            if (!d.dieDef && typeof getDieDef === 'function') d.dieDef = getDieDef('ordinary');
            if (typeof rollDieDef === 'function' && d.dieDef) {
                d.value = rollDieDef(d.dieDef);
            } else {
                d.value = rollDie();
            }
            d.isJoker = d.dieDef && d.dieDef.special === 'joker' && d.value === 1;
            d.rot = Math.round(Math.random() * 56 - 28);
            const el = panel.dieEl(d.id);
            if (el) {
                el.dataset.value = d.value;
                if (d.isJoker) el.classList.add('is-joker');
                else el.classList.remove('is-joker');
                placeDie(el, d);
            }
        });
        await delay(340);
        elsDice.forEach((el) => el.classList.remove('rerolling'));
    }

    global.FarkleUIBoard = {
        Panel,
        dieSize,
        parkW,
        parkScale,
        rollGeom,
        layoutPositions,
        rollAnimation,
        flashRing,
        makeDieEl,
        placeDie,
        parkDice,
        rerollDice,
        setBanner,
        log,
        showDieTooltip,
        hideDieTooltip,
        scheduleDieTooltip,
        cancelDieTooltipTimer
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = global.FarkleUIBoard;
    }
})(typeof window !== 'undefined' ? window : this);
