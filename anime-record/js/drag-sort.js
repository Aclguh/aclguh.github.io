/**
 * 长按拖动排序模块
 * 在「默认排序」下长按卡片约 0.45 秒进入拖动模式，拖到目标位置释放即保存新顺序。
 * 选用其他排序方式时，长按会先切回默认排序（否则释放后又会按排序规则回弹）。
 */

(function () {
    'use strict';

    // 长按触发时长（毫秒）
    const LONG_PRESS_MS = 450;
    // 长按计时期间允许的位移，超出视为滑动 / 普通点击
    const MOVE_TOLERANCE = 10;
    // 拖动中卡片的放大幅度
    const DRAG_SCALE = 1.045;
    // 视口上下边缘自动滚动的触发区高度（px）
    const EDGE_ZONE = 96;
    // 贴住边缘时的最大滚动速度（像素/秒），越靠近边缘越快
    const EDGE_MAX_SPEED = 1000;

    // 首次使用提示（只提示一次）
    const HINT_KEY = 'anime-record-drag-hint-seen';

    /** 拖动状态机 */
    const state = {
        pending: false,      // 长按计时中
        active: false,       // 拖动模式已激活
        pointerId: null,
        card: null,          // 当前拖动的卡片元素
        startX: 0,           // 按下时的指针位置
        startY: 0,
        grabX: 0,            // 指针相对卡片左上角的抓取偏移
        grabY: 0,
        pointerX: 0,         // 最新的指针位置（视口坐标）
        pointerY: 0,
        rafId: 0,
        lastTickAt: 0,       // 上一帧时间戳，用于按帧间隔折算滚动距离
        savedScrollBehavior: null, // 拖动前 html 的内联 scroll-behavior，结束时还原
        timer: 0,
        suppressClick: false // 拖动结束后的首次 click 需要吞掉，避免误触按钮
    };

    let gridEl = null;

    /**
     * 对外接口（app.js 调用）
     */
    const DragSort = {
        init,
        showFirstVisitHint,
        isActive: () => state.active,
        cancelIfActive
    };

    /* ============================================
       初始化与事件绑定
       ============================================ */

    /**
     * 初始化（DOM 就绪后调用）
     */
    function init() {
        gridEl = document.getElementById('anime-grid');
        if (!gridEl) return;

        gridEl.addEventListener('pointerdown', onPointerDown);
        // 捕获阶段拦截拖动结束后的那次 click，避免误触删除 / +1 集等按钮
        gridEl.addEventListener('click', onGridClick, true);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerCancel);
        window.addEventListener('contextmenu', onContextMenu);
        window.addEventListener('blur', cancelIfActive);
        // 拖动激活后阻止页面滚动；长按计时阶段不拦截，保证正常滑动
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('keydown', onKeyDown);
    }

    /* ============================================
       指针事件入口
       ============================================ */

    function onPointerDown(e) {
        if (state.pending || state.active) return;
        if (!e.isPrimary) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        const card = e.target.closest('.anime-card');
        if (!card) return;
        // 按钮（编辑 / 删除 / +1 集）与表单控件上不启动拖动
        if (e.target.closest('button, a, input, select, textarea')) return;

        state.pending = true;
        state.pointerId = e.pointerId;
        state.card = card;
        state.startX = e.clientX;
        state.startY = e.clientY;

        state.timer = window.setTimeout(activate, LONG_PRESS_MS);
    }

    function onPointerMove(e) {
        if (state.pending && e.pointerId === state.pointerId) {
            // 位移超出容差：判定为滑动 / 点击，取消长按（不阻止滚动）
            const dx = e.clientX - state.startX;
            const dy = e.clientY - state.startY;
            if (dx * dx + dy * dy > MOVE_TOLERANCE * MOVE_TOLERANCE) {
                cancelPending();
            }
            return;
        }
        if (!state.active || e.pointerId !== state.pointerId) return;

        state.pointerX = e.clientX;
        state.pointerY = e.clientY;
        scheduleTick();
    }

    function onPointerUp(e) {
        if (state.pending && e.pointerId === state.pointerId) {
            cancelPending();
            return;
        }
        if (!state.active || e.pointerId !== state.pointerId) return;
        finish(true);
    }

    function onPointerCancel(e) {
        if (e.pointerId !== state.pointerId) return;
        // 指针被系统接管（如来滚动）：放弃本次拖动，恢复原顺序
        if (state.active) finish(false);
        else cancelPending();
    }

    function onContextMenu(e) {
        if (state.pending || state.active) e.preventDefault();
    }

    function onTouchMove(e) {
        if (state.active && e.cancelable) e.preventDefault();
    }

    function onKeyDown(e) {
        if (e.key === 'Escape' && (state.active || state.pending)) {
            cancelIfActive();
        }
    }

    /**
     * 捕获阶段拦截 click：拖动结束后浏览器补发的 click 一律吞掉
     * （拖到别的卡片的删除 / +1 集按钮上释放时会误触）
     */
    function onGridClick(e) {
        if (!state.suppressClick) return;
        state.suppressClick = false;
        e.preventDefault();
        e.stopImmediatePropagation();
    }

    /* ============================================
       长按 → 激活
       ============================================ */

    function activate() {
        if (!state.pending) return;
        state.pending = false;

        const pressed = state.card;
        if (!pressed || !pressed.isConnected) return;

        // 非默认排序下先切回默认排序，否则释放后会按排序规则回弹
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect && sortSelect.value !== '') {
            sortSelect.value = '';
            refreshCards();
            showToast('已切换到默认排序，移动卡片即可调整顺序', 'info');

            // 刷新后卡片节点被重建，按 id 重新获取
            const next = findCard(pressed.dataset.id);
            if (!next) {
                state.card = null;
                state.pointerId = null;
                return;
            }
            state.card = next;
        }

        const card = state.card;
        state.active = true;
        state.lastTickAt = 0;
        state.pointerX = state.startX;
        state.pointerY = state.startY;

        // html 上的 scroll-behavior: smooth 会让逐帧滚动（scrollTop 赋值 /
        // scrollBy）变成不断重启的平滑动画，拖动期间临时改为即时滚动
        const scroller = document.scrollingElement || document.documentElement;
        state.savedScrollBehavior = scroller.style.scrollBehavior || '';
        scroller.style.scrollBehavior = 'auto';

        const rect = card.getBoundingClientRect();
        state.grabX = state.startX - rect.left;
        state.grabY = state.startY - rect.top;

        gridEl.classList.add('drag-active');
        document.body.classList.add('drag-sorting');
        card.classList.add('dragging');
        // 卡片自带 transform 过渡会让拖动跟手延迟，拖动期间临时关闭
        card.style.transition = 'none';

        vibrate();
        applyDragTransform();
        scheduleTick();
    }

    /* ============================================
       每帧更新：位置 / 边缘滚动 / 落点
       ============================================ */

    function scheduleTick() {
        if (state.rafId) return;
        state.rafId = requestAnimationFrame(tick);
    }

    function tick(now) {
        state.rafId = 0;
        if (!state.active) return;

        // 帧间隔（秒），首帧或被节流时兜底 16ms；用于滚动速度与刷新率无关
        const dt = state.lastTickAt ? Math.min((now - state.lastTickAt) / 1000, 0.064) : 0.016;
        state.lastTickAt = now;

        updateAutoScroll(dt);
        // 先更新落点（可能改变卡片所在槽位），再把卡片摆到指针处
        updateDropTarget();
        applyDragTransform();
        scheduleTick();
    }

    /**
     * 让卡片跟随指针（相对其所在槽位做位移，槽位随重排变化）
     */
    function applyDragTransform() {
        const card = state.card;
        if (!card) return;

        const gridRect = gridEl.getBoundingClientRect();
        const slotLeft = gridRect.left + gridEl.clientLeft + card.offsetLeft;
        const slotTop = gridRect.top + gridEl.clientTop + card.offsetTop;
        const dx = state.pointerX - state.grabX - slotLeft;
        const dy = state.pointerY - state.grabY - slotTop;

        card.style.transform = `translate(${dx}px, ${dy}px) scale(${DRAG_SCALE})`;
    }

    /**
     * 拖到视口上下边缘时自动滚动页面：越贴近边缘滚得越快（二次曲线），
     * 离开边缘或拖动结束即停
     */
    function updateAutoScroll(dt) {
        const y = state.pointerY;
        const viewport = window.innerHeight;

        let speed = 0;
        if (y < EDGE_ZONE) {
            const t = 1 - y / EDGE_ZONE;
            speed = -EDGE_MAX_SPEED * t * t;
        } else if (y > viewport - EDGE_ZONE) {
            const t = 1 - (viewport - y) / EDGE_ZONE;
            speed = EDGE_MAX_SPEED * t * t;
        }
        if (!speed) return;

        const scroller = document.scrollingElement || document.documentElement;
        const maxScroll = layoutScrollMax();
        scroller.scrollTop = Math.max(0, Math.min(scroller.scrollTop + speed * dt, maxScroll));

        // 向下拖且已滚到布局最底部仍不松手：加载下一页卡片，让排序可以越过分页边界
        if (speed > 0 && scroller.scrollTop >= maxScroll - 1) {
            const loadMore = document.getElementById('load-more');
            if (loadMore && !loadMore.classList.contains('hidden')) loadMoreCards();
        }
    }

    /**
     * 文档的布局滚动上限。
     * 被拖动卡片的 transform 盒子会计入 scrollHeight（悬在文档底端之外时
     * 让“底端”随滚动不断外扩，永远追不到），因此改用各卡片的 offsetTop
     * 布局坐标自行计算真实底端。
     */
    function layoutScrollMax() {
        // 卡片底端（网格内坐标）→ 文档坐标
        const gridTop = gridEl.offsetTop;
        let bottomDoc = gridTop;
        for (const el of gridEl.querySelectorAll('.anime-card')) {
            bottomDoc = Math.max(bottomDoc, gridTop + el.offsetTop + el.offsetHeight);
        }
        // 网格下方可能还有「加载更多」区域（offsetTop 已是文档坐标）
        const loadMore = document.getElementById('load-more');
        if (loadMore && !loadMore.classList.contains('hidden')) {
            bottomDoc = Math.max(bottomDoc, loadMore.offsetTop + loadMore.offsetHeight);
        }

        const scroller = document.scrollingElement || document.documentElement;
        const main = document.querySelector('.main-container');
        const padBottom = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
        return Math.max(0, bottomDoc + padBottom - scroller.clientHeight);
    }

    /**
     * 计算落点并实时重排：其他卡片让位，被拖动卡片回到其槽位上方
     */
    function updateDropTarget() {
        const card = state.card;
        if (!card) return;

        const cards = [...gridEl.children].filter(el => el.classList.contains('anime-card'));
        const currentIndex = cards.indexOf(card);
        if (currentIndex === -1) return;

        // 阅读顺序（从左到右、从上到下）中第一个「中心在指针之前」的卡片
        const ref = cards.find(el => el !== card && isBeforePointer(el, gridEl.getBoundingClientRect()));

        // 已在目标位置则不动作，避免无谓重排造成抖动
        if (ref) {
            if (cards[currentIndex + 1] === ref) return;
        } else if (currentIndex === cards.length - 1) {
            return;
        }

        flipReorder(() => {
            if (ref) gridEl.insertBefore(card, ref);
            else gridEl.appendChild(card);
        });
    }

    /**
     * 判断卡片中心是否在指针之前（决定插入位置）
     */
    function isBeforePointer(el, gridRect) {
        const left = gridRect.left + gridEl.clientLeft + el.offsetLeft;
        const top = gridRect.top + gridEl.clientTop + el.offsetTop;
        const right = left + el.offsetWidth;
        const bottom = top + el.offsetHeight;

        const px = state.pointerX;
        const py = state.pointerY;
        if (py < top) return true;
        if (py > bottom) return false;
        return px < (left + right) / 2;
    }

    /**
     * FLIP 动画：先记录各卡片布局位置，DOM 重排后再用 transform 从旧位置过渡到新位置
     * （测量用 offsetLeft/offsetTop 布局坐标，不受 transform 影响）
     */
    function flipReorder(mutate) {
        const others = [...gridEl.children].filter(el => el !== state.card);
        const before = others.map(el => [el, el.offsetLeft, el.offsetTop]);

        mutate();

        for (const [el, left, top] of before) {
            const dx = left - el.offsetLeft;
            const dy = top - el.offsetTop;
            if (!dx && !dy) continue;

            el.style.transition = 'none';
            el.style.transform = `translate(${dx}px, ${dy}px)`;
            void el.offsetWidth; // 强制回流，让起始位置立即生效
            el.style.transition = 'transform var(--t)';
            el.style.transform = '';
        }
    }

    /* ============================================
       结束 / 取消
       ============================================ */

    function finish(commit) {
        if (!state.active) return;
        state.active = false;
        state.lastTickAt = 0;
        stopTick();

        // 还原页面的 scroll-behavior
        if (state.savedScrollBehavior !== null) {
            const scroller = document.scrollingElement || document.documentElement;
            scroller.style.scrollBehavior = state.savedScrollBehavior;
            state.savedScrollBehavior = null;
        }

        const card = state.card;
        if (card) {
            card.classList.remove('dragging');
            card.style.transition = '';
            // 过渡回槽位（恢复卡片自身的 transition）
            card.style.transform = '';
        }

        gridEl.classList.remove('drag-active');
        document.body.classList.remove('drag-sorting');

        if (commit) {
            state.suppressClick = true;
            // 兜底：万一 pointerup 之后没有 click 补发，及时放开拦截
            window.setTimeout(() => { state.suppressClick = false; }, 400);
            persistCurrentOrder();
        } else {
            refreshCards();
        }

        state.card = null;
        state.pointerId = null;
    }

    function cancelPending() {
        if (!state.pending) return;
        clearTimeout(state.timer);
        state.timer = 0;
        state.pending = false;
        state.card = null;
        state.pointerId = null;
    }

    function cancelIfActive() {
        if (state.active) finish(false);
        else cancelPending();
    }

    function stopTick() {
        if (!state.rafId) return;
        cancelAnimationFrame(state.rafId);
        state.rafId = 0;
    }

    /* ============================================
       持久化
       ============================================ */

    /**
     * 把当前可见卡片的顺序写回存储。
     * 只调整可见记录的相对顺序，其他记录保持原位。
     */
    function persistCurrentOrder() {
        const visibleIds = [...gridEl.querySelectorAll('.anime-card')].map(el => el.dataset.id);
        const records = loadRecords();

        const moved = [];
        const movedIds = new Set();
        for (const id of visibleIds) {
            if (movedIds.has(id)) continue;
            const record = records.find(r => r.id === id);
            if (record) {
                moved.push(record);
                movedIds.add(id);
            }
        }
        if (moved.length < 2) return;

        let cursor = 0;
        const next = records.map(r => (movedIds.has(r.id) ? moved[cursor++] : r));
        if (!saveRecords(next)) {
            showToast('保存顺序失败', 'error');
            refreshCards();
        }
    }

    /* ============================================
       其他
       ============================================ */

    function findCard(id) {
        return [...gridEl.children].find(el => el.classList.contains('anime-card') && el.dataset.id === id) || null;
    }

    function vibrate() {
        try {
            if (navigator.vibrate) navigator.vibrate(15);
        } catch (e) { /* 不支持振动的设备忽略 */ }
    }

    /**
     * 首次使用提示（有记录才提示，且只提示一次）
     */
    function showFirstVisitHint() {
        try {
            if (localStorage.getItem(HINT_KEY)) return;
            if (loadRecords().length < 2) return;
            localStorage.setItem(HINT_KEY, '1');
            window.setTimeout(() => showToast('小提示：长按卡片即可拖动排序', 'info', 3200), 900);
        } catch (e) { /* 忽略存储异常 */ }
    }

    window.DragSort = DragSort;
})();
