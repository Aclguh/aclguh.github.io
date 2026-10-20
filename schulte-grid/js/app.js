/* ============================================
   舒尔特方格 - Schulte Grid
   纯前端小游戏：按升序点击数字，计时挑战
   数据（最佳成绩 / 历史记录）存储在 localStorage
   ============================================ */

const BEST_KEY = 'schulte_best';
const HISTORY_KEY = 'schulte_history';
const PREF_KEY = 'schulte_mark';
const { SIZES, CELL_FONT, MAX_HISTORY, formatTime, formatDateTime, shuffled, updateBestRecord, appendHistory } =
    typeof SchulteGame !== 'undefined' ? SchulteGame : {};

// --- State ---
let size = 5;
let numbers = [];
let nextNumber = 1;
let errors = 0;
let running = false;
let startTime = 0;
let timerId = null;
let markDone = true;

// --- DOM refs ---
const grid = document.getElementById('grid');
const overlay = document.getElementById('gridOverlay');
const sizePicker = document.getElementById('sizePicker');
const startBtn = document.getElementById('startBtn');
const clearBtn = document.getElementById('clearBtn');
const bestGrid = document.getElementById('bestGrid');
const historyWrap = document.getElementById('historyWrap');
const statNext = document.getElementById('statNext');
const statTime = document.getElementById('statTime');
const statErrors = document.getElementById('statErrors');
const markToggle = document.getElementById('markToggle');

const total = () => size * size;

/* ============================================
   Data Layer (基于 SafeStorage 安全封装)
   ============================================ */
function loadBest() {
    return typeof SafeStorage !== 'undefined' ? SafeStorage.get(BEST_KEY, {}) : {};
}

function saveBest(obj) {
    if (typeof SafeStorage !== 'undefined') SafeStorage.set(BEST_KEY, obj);
}

function loadHistory() {
    return typeof SafeStorage !== 'undefined' ? SafeStorage.get(HISTORY_KEY, []) : [];
}

function saveHistory(arr) {
    if (typeof SafeStorage !== 'undefined') SafeStorage.set(HISTORY_KEY, arr);
}

/* ============================================
   Helpers
   ============================================ */
let toastTimer;
function showToast(msg, type = 'info') {
    if (typeof Toast !== 'undefined') {
        Toast.show(msg, type);
        return;
    }
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

/* ============================================
   Render: Grid
   ============================================ */
function renderGrid() {
    grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    grid.style.setProperty('--cell-font', CELL_FONT[size]);
    grid.innerHTML = numbers
        .map((n) => `<button class="cell" type="button" data-value="${n}" aria-label="数字 ${n}">${n}</button>`)
        .join('');
    applyMarkMode();
}

/* ============================================
   Mark preference（是否高亮已点数字）
   ============================================ */
function applyMarkMode() {
    grid.classList.toggle('mark-on', markDone);
}

function loadMarkPref() {
    const v = typeof SafeStorage !== 'undefined' ? SafeStorage.getItem(PREF_KEY) : null;
    markDone = v == null ? true : v === '1';
    if (markToggle) markToggle.checked = markDone;
    applyMarkMode();
}

/* ============================================
   Render: Overlay
   ============================================ */
function showIdleOverlay() {
    overlay.classList.remove('hidden');
    overlay.innerHTML = `
        <div class="overlay-title">舒尔特方格</div>
        <p class="overlay-desc">从 1 开始，按升序尽快点击全部数字。当前规格 ${size}×${size}，共 ${total()} 个数字。</p>
        <div class="overlay-actions">
            <button class="btn btn-primary" type="button" data-action="start">
                <span class="btn-icon" aria-hidden="true"><svg><use href="#i-play"/></svg></span>开始训练
            </button>
        </div>`;
}

function showResultOverlay(time, errs, isRecord, best) {
    overlay.classList.remove('hidden');
    overlay.innerHTML = `
        <div class="overlay-icon success" aria-hidden="true">
            <svg><use href="${isRecord ? '#i-trophy' : '#i-check'}"/></svg>
        </div>
        <div class="overlay-title">${isRecord ? '新纪录！' : '完成！'}</div>
        <div class="overlay-time">${formatTime(time)}<small>秒</small></div>
        ${
            isRecord
                ? `<span class="record-badge"><svg><use href="#i-sparkles"/></svg>刷新了 ${size}×${size} 最佳成绩</span>`
                : `<span class="overlay-desc">最佳 ${formatTime(best)} 秒 · 再接再厉</span>`
        }
        <div class="overlay-meta">
            <span>规格 <b>${size}×${size}</b></span>
            <span>点错 <b>${errs}</b></span>
        </div>
        <div class="overlay-actions">
            <button class="btn btn-primary" type="button" data-action="again">
                <span class="btn-icon" aria-hidden="true"><svg><use href="#i-refresh"/></svg></span>再来一局
            </button>
            <button class="btn btn-ghost" type="button" data-action="back">返回</button>
        </div>`;
}

function hideOverlay() {
    overlay.classList.add('hidden');
}

/* ============================================
   Render: Records
   ============================================ */
function renderBestGrid() {
    const best = loadBest();
    bestGrid.innerHTML = SIZES.map((s) => {
        const val = best[s] != null ? formatTime(best[s]) : '—';
        return `
            <div class="stat-item${s === size ? ' current' : ''}">
                <div class="stat-value">${val}</div>
                <div class="stat-label">${s}×${s} 最佳 (秒)</div>
            </div>`;
    }).join('');
}

function renderHistory() {
    const hist = loadHistory();
    const best = loadBest();

    if (hist.length === 0) {
        historyWrap.innerHTML = `
            <div class="empty">
                <div class="empty-icon" aria-hidden="true"><svg><use href="#i-list"/></svg></div>
                <p>暂无记录，完成一局训练即可看到成绩</p>
            </div>`;
        return;
    }

    let html = `<table><thead><tr>
        <th>规格</th><th>用时 (秒)</th><th>点错</th><th>时间</th>
    </tr></thead><tbody>`;

    for (const r of hist) {
        const isBest = best[r.size] != null && Math.abs(r.time - best[r.size]) < 1e-9;
        html += `<tr>
            <td class="col-size">${r.size}×${r.size}</td>
            <td class="col-time">${formatTime(r.time)}${isBest ? '<span class="badge-best">最佳</span>' : ''}</td>
            <td>${r.errors}</td>
            <td class="col-date">${formatDateTime(r.date)}</td>
        </tr>`;
    }

    html += '</tbody></table>';
    historyWrap.innerHTML = html;
}

/* ============================================
   Render: Live stats
   ============================================ */
function updateLive() {
    statNext.textContent = running ? nextNumber : '—';
    statErrors.textContent = errors;
    const elapsed = running ? (performance.now() - startTime) / 1000 : 0;
    statTime.textContent = formatTime(elapsed);
}

function updateStartBtn() {
    startBtn.innerHTML = running
        ? '<span class="btn-icon" aria-hidden="true"><svg><use href="#i-refresh"/></svg></span>重新开始'
        : '<span class="btn-icon" aria-hidden="true"><svg><use href="#i-play"/></svg></span>开始训练';
}

/* ============================================
   Game flow
   ============================================ */
function stopTimer() {
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
    }
}

function selectSize(n) {
    stopTimer();
    running = false;
    size = n;

    [...sizePicker.querySelectorAll('.size-pill')].forEach((p) => {
        p.classList.toggle('active', Number(p.dataset.size) === n);
    });

    // 预览态：按顺序展示 1..N²，覆盖遮罩
    numbers = Array.from({ length: total() }, (_, i) => i + 1);
    grid.classList.add('idle');
    renderGrid();

    nextNumber = 1;
    errors = 0;
    updateLive();
    updateStartBtn();
    renderBestGrid();
    showIdleOverlay();
}

function startGame() {
    stopTimer();
    numbers = shuffled(total());
    nextNumber = 1;
    errors = 0;
    running = true;

    grid.classList.remove('idle');
    renderGrid();
    hideOverlay();

    startTime = performance.now();
    timerId = setInterval(updateLive, 50);
    updateStartBtn();
    updateLive();
}

function onCellClick(cell, value) {
    if (!running || cell.classList.contains('done')) return;

    if (value === nextNumber) {
        cell.classList.add('done');
        if (!markDone) {
            // 未开启标记时，用短暂动画提示点中，动画结束后恢复未点击样式
            cell.classList.remove('correct');
            void cell.offsetWidth; // 重新触发动画
            cell.classList.add('correct');
            setTimeout(() => cell.classList.remove('correct'), 420);
        }
        nextNumber++;
        if (nextNumber > total()) {
            finishGame();
        } else {
            statNext.textContent = nextNumber;
        }
    } else {
        errors++;
        statErrors.textContent = errors;
        cell.classList.remove('shake');
        void cell.offsetWidth; // 重新触发动画
        cell.classList.add('shake');
        setTimeout(() => cell.classList.remove('shake'), 360);
    }
}

function finishGame() {
    running = false;
    stopTimer();

    const time = (performance.now() - startTime) / 1000;
    const best = loadBest();
    const prev = best[size];
    const isRecord = prev == null || time < prev - 1e-9;

    if (isRecord) {
        best[size] = time;
        saveBest(best);
    }

    const hist = loadHistory();
    hist.unshift({ size, time, errors, date: Date.now() });
    if (hist.length > MAX_HISTORY) hist.length = MAX_HISTORY;
    saveHistory(hist);

    statNext.textContent = '✓';
    statTime.textContent = formatTime(time);
    statErrors.textContent = errors;

    renderBestGrid();
    renderHistory();
    updateStartBtn();
    showResultOverlay(time, errors, isRecord, best[size]);
}

async function clearData() {
    let ok;
    if (typeof Modal !== 'undefined' && Modal.confirm) {
        ok = await Modal.confirm({
            title: '清空成绩记录',
            message: '确定要清空全部最佳成绩与历史记录吗？此操作不可恢复。',
            danger: true
        });
    } else {
        ok = confirm('确定要清空全部最佳成绩与历史记录吗？此操作不可恢复。');
    }
    if (!ok) return;

    if (typeof SafeStorage !== 'undefined') {
        SafeStorage.remove(BEST_KEY);
        SafeStorage.remove(HISTORY_KEY);
    }
    renderBestGrid();
    renderHistory();
    showToast('记录已清空', 'success');
}

/* ============================================
   Events & Init (浏览器环境)
   ============================================ */
if (typeof window !== 'undefined' && grid) {
    grid.addEventListener('click', (e) => {
        const cell = e.target.closest('.cell');
        if (cell) onCellClick(cell, Number(cell.dataset.value));
    });

    overlay.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        if (action === 'start' || action === 'again') startGame();
        else if (action === 'back') selectSize(size);
    });

    sizePicker.addEventListener('click', (e) => {
        const pill = e.target.closest('.size-pill');
        if (pill) selectSize(Number(pill.dataset.size));
    });

    startBtn.addEventListener('click', startGame);
    clearBtn.addEventListener('click', clearData);

    markToggle.addEventListener('change', () => {
        markDone = markToggle.checked;
        if (typeof SafeStorage !== 'undefined') SafeStorage.setItem(PREF_KEY, markDone ? '1' : '0');
        applyMarkMode();
        showToast(markDone ? '已开启「标记已点数字」' : '已关闭「标记已点数字」');
    });

    loadMarkPref();
    selectSize(5);
    renderHistory();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        shuffled,
        updateBestRecord,
        appendHistory,
        SIZES
    };
}
