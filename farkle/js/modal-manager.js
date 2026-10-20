/**
 * =====================================================================
 * 天国骰子 - 弹层交互管理器 (Modal Manager)
 * 负责玩法选择、徽章选择、默认骰子设置、出战骰子挑选与规则说明弹层
 * =====================================================================
 */
(function (global) {
    'use strict';

    const $ = (id) => (typeof document !== 'undefined' ? document.getElementById(id) : null);

    let diceModalState = {
        mode: 'pre-game', // 'pre-game' | 'edit-default'
        onConfirm: null,
        selected: [],
        filterCat: 'all'
    };

    let allowedTiers =
        typeof TARGET_TIERS !== 'undefined' && TARGET_TIERS[8000] ? TARGET_TIERS[8000] : ['tin', 'silver', 'gold'];

    /* ── 骰子搭配概览（主面板） ─────── */
    function renderSetupLoadout() {
        const statusEl = $('setup-loadout-status');
        const chipsEl = $('setup-loadout-chips');
        if (!statusEl || !chipsEl || typeof state === 'undefined') return;

        const isDefault = !!state.useDefaultDice;
        statusEl.textContent = isDefault ? '默认搭配 · 开启' : '局前自选 · 关闭';
        statusEl.className = 'loadout-status-pill' + (isDefault ? '' : ' off');

        chipsEl.innerHTML = '';
        const dice =
            state.defaultDice && state.defaultDice.length === 6
                ? state.defaultDice
                : ['ordinary', 'ordinary', 'ordinary', 'ordinary', 'ordinary', 'ordinary'];
        const counts = {};
        dice.forEach((id) => {
            counts[id] = (counts[id] || 0) + 1;
        });
        Object.keys(counts).forEach((id) => {
            const def = typeof getDieDef === 'function' ? getDieDef(id) : { name: id, desc: '' };
            const count = counts[id];
            const chip = document.createElement('span');
            chip.className = 'loadout-chip-item' + (id !== 'ordinary' ? ' special' : '');
            chip.textContent = count > 1 ? `${def.name} ×${count}` : def.name;
            chip.title = `${def.name}：${def.desc}`;
            chipsEl.appendChild(chip);
        });
    }

    /* ── 设置弹层 ───────────────────── */
    function updateSettingToggleDesc() {
        const desc = $('setting-toggle-desc');
        if (!desc || typeof state === 'undefined') return;
        if (state.useDefaultDice) {
            desc.innerHTML =
                '<strong>开启状态：</strong>直接使用下方配置的 6 颗默认骰子，点击开始后无需每次挑骰子，直接进入游戏。';
        } else {
            desc.innerHTML =
                '<strong>关闭状态：</strong>每次选完徽章或无徽章后，进入选骰界面挑选 6 颗骰子后方可进入游戏。';
        }
    }

    function renderSettingsSlots() {
        const container = $('settings-slots-container');
        if (!container || typeof state === 'undefined') return;
        container.innerHTML = '';
        const dice =
            state.defaultDice && state.defaultDice.length === 6
                ? state.defaultDice
                : ['ordinary', 'ordinary', 'ordinary', 'ordinary', 'ordinary', 'ordinary'];
        dice.forEach((id, idx) => {
            const def = typeof getDieDef === 'function' ? getDieDef(id) : { name: id, tag: '骰子' };
            const chip = document.createElement('div');
            chip.className = 'slot-chip' + (id !== 'ordinary' ? ' special' : '');
            chip.innerHTML = `
                <span class="slot-idx">#${idx + 1}</span>
                <span class="slot-name">${def.name}</span>
                <span class="slot-tag">${def.tag || '骰子'}</span>
            `;
            chip.title = `点击自定义默认搭配：当前为 ${def.name}`;
            chip.addEventListener('click', () => {
                const settingsModal = $('settings-modal');
                if (settingsModal) settingsModal.classList.add('hidden');
                openDiceSelectModal('edit-default', (newDice) => {
                    state.defaultDice = [...newDice];
                    if (typeof saveStoredDefaultDice === 'function') saveStoredDefaultDice(state.defaultDice);
                    renderSettingsSlots();
                    renderSetupLoadout();
                    openSettingsModal();
                });
            });
            container.appendChild(chip);
        });
    }

    function openSettingsModal() {
        if (typeof state === 'undefined') return;
        if (typeof loadStoredUseDefault === 'function') state.useDefaultDice = loadStoredUseDefault();
        if (typeof loadStoredDefaultDice === 'function') state.defaultDice = loadStoredDefaultDice();
        const toggle = $('setting-default-dice-toggle');
        if (toggle) toggle.checked = state.useDefaultDice;
        updateSettingToggleDesc();
        renderSettingsSlots();
        const modal = $('settings-modal');
        if (modal) modal.classList.remove('hidden');
    }

    function closeSettingsModal() {
        const modal = $('settings-modal');
        if (modal) modal.classList.add('hidden');
        renderSetupLoadout();
    }

    /* ── 骰子选择弹层 ────────────────── */
    function openDiceSelectModal(mode, onConfirm) {
        diceModalState.mode = mode;
        diceModalState.onConfirm = onConfirm;
        diceModalState.filterCat = 'all';
        diceModalState.selected =
            typeof state !== 'undefined'
                ? [...state.defaultDice]
                : ['ordinary', 'ordinary', 'ordinary', 'ordinary', 'ordinary', 'ordinary'];

        const titleEl = $('dice-modal-title');
        if (titleEl) {
            if (mode === 'edit-default') {
                titleEl.textContent = '配置默认出战骰子（选择 6 颗）';
            } else {
                const badge = typeof state !== 'undefined' ? state.badges.me : null;
                titleEl.textContent = badge
                    ? `挑选 6 颗出战骰子（${badge.name} · ${state.target}分局）`
                    : '挑选 6 颗出战骰子（经典无徽章局 · 1500分）';
            }
        }
        const confirmTextEl = $('btn-confirm-dice-text');
        if (confirmTextEl) {
            confirmTextEl.textContent = mode === 'edit-default' ? '保存为默认搭配' : '确认并出战';
        }

        renderDiceSelectSlots();
        renderDiceCatalog('all');
        const modal = $('dice-select-modal');
        if (modal) modal.classList.remove('hidden');
    }

    function closeDiceSelectModal() {
        const modal = $('dice-select-modal');
        if (modal) modal.classList.add('hidden');
    }

    function renderDiceSelectSlots() {
        const slotsEl = $('dice-select-slots');
        if (!slotsEl) return;
        slotsEl.innerHTML = '';
        const sel = diceModalState.selected;
        for (let i = 0; i < 6; i++) {
            const id = sel[i];
            const chip = document.createElement('div');
            if (id) {
                const def = typeof getDieDef === 'function' ? getDieDef(id) : { name: id, tag: '骰子' };
                chip.className = 'slot-chip' + (id !== 'ordinary' ? ' special' : '');
                chip.innerHTML = `
                    <button type="button" class="slot-remove-btn" title="移除此骰子">×</button>
                    <span class="slot-idx">#${i + 1}</span>
                    <span class="slot-name">${def.name}</span>
                    <span class="slot-tag">${def.tag || '骰子'}</span>
                `;
                chip.title = `${def.name}（点击移除）`;
                chip.addEventListener('click', (e) => {
                    e.stopPropagation();
                    sel.splice(i, 1);
                    renderDiceSelectSlots();
                });
            } else {
                chip.className = 'slot-chip empty';
                chip.innerHTML = `
                    <span class="slot-idx">#${i + 1}</span>
                    <span class="slot-name">+ 槽位</span>
                    <span class="slot-tag">空置</span>
                `;
            }
            slotsEl.appendChild(chip);
        }

        const countEl = $('dice-selected-count');
        if (countEl) countEl.textContent = sel.length;
        const confirmBtn = $('btn-confirm-dice');
        if (confirmBtn) confirmBtn.disabled = sel.length !== 6;
    }

    function renderDiceCatalog(cat) {
        const grid = $('dice-cards-grid');
        if (!grid || typeof DICE_LIST === 'undefined') return;
        diceModalState.filterCat = cat;
        grid.innerHTML = '';

        const tabs = $('dice-catalog-tabs');
        if (tabs) {
            [...tabs.children].forEach((tab) => {
                tab.classList.toggle('active', tab.dataset.cat === cat);
            });
        }

        let filtered = DICE_LIST;
        if (cat === 'fair') {
            filtered = DICE_LIST.filter((d) => d.category === 'fair');
        } else if (cat === 'weighted-1') {
            filtered = DICE_LIST.filter(
                (d) => d.category === 'weighted' && d.weights[0] / d.weights.reduce((a, b) => a + b, 0) >= 0.25
            );
        } else if (cat === 'weighted-high') {
            filtered = DICE_LIST.filter(
                (d) =>
                    d.category === 'weighted' &&
                    ['painted', 'ci', 'fer', 'lu', 'shrinking', 'lousy-gambler', 'grimy', 'greasy', 'even'].includes(
                        d.id
                    )
            );
        } else if (cat === 'weighted-mid') {
            filtered = DICE_LIST.filter(
                (d) =>
                    d.category === 'weighted' &&
                    !['painted', 'ci', 'fer', 'lu', 'shrinking', 'lousy-gambler', 'grimy', 'greasy', 'even'].includes(
                        d.id
                    ) &&
                    d.weights[0] / d.weights.reduce((a, b) => a + b, 0) < 0.25
            );
        } else if (cat === 'special') {
            filtered = DICE_LIST.filter((d) => d.category === 'special');
        }

        filtered.forEach((def) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'dice-card' + (def.id !== 'ordinary' ? ' special' : '');
            const probs = typeof formatProbText === 'function' ? formatProbText(def.weights) : '';
            card.innerHTML = `
                <div class="dc-head">
                    <span class="dc-name">${def.name}</span>
                    <span class="dc-tag">${def.tag || '骰子'}</span>
                </div>
                <div class="dc-desc">${def.desc}</div>
                <div class="dc-probs">${probs}</div>
            `;
            card.addEventListener('click', () => {
                if (diceModalState.selected.length >= 6) return;
                diceModalState.selected.push(def.id);
                renderDiceSelectSlots();
            });
            grid.appendChild(card);
        });
    }

    function handleDiceModalBack() {
        closeDiceSelectModal();
        if (diceModalState.mode === 'edit-default') {
            openSettingsModal();
        } else {
            if (typeof state !== 'undefined' && state.badges.me) {
                const bm = $('badge-modal');
                if (bm) bm.classList.remove('hidden');
            } else {
                openStartModal('mode');
            }
        }
    }

    /* ── 开局方式弹层 ────────────────── */
    function openStartModal(step) {
        const atTarget = step === 'target';
        const modeStep = $('start-step-mode');
        const targetStep = $('start-step-target');
        const titleEl = $('start-modal-title');
        const modal = $('start-modal');

        if (modeStep) modeStep.classList.toggle('hidden', atTarget);
        if (targetStep) targetStep.classList.toggle('hidden', !atTarget);
        if (titleEl) titleEl.textContent = atTarget ? '选择目标分' : '选择玩法';
        if (modal) modal.classList.remove('hidden');
    }

    /* ── 徽章选择弹层 ────────────────── */
    function renderBadgeList(tiers) {
        const allowed =
            tiers && tiers.length
                ? tiers
                : typeof TARGET_TIERS !== 'undefined'
                  ? TARGET_TIERS[8000]
                  : ['tin', 'silver', 'gold'];
        const tierTitle = { tin: '锡制徽章', silver: '银制徽章', gold: '黄金徽章' };
        const scope =
            allowed.length === 3
                ? '可佩戴全部阶位（锡 / 银 / 金）的徽章'
                : `仅可佩戴${allowed.map((t) => (typeof TIER_CN !== 'undefined' ? TIER_CN[t] : t)).join('、')}制徽章`;

        const introEl = $('badge-intro');
        if (introEl && typeof state !== 'undefined') {
            introEl.innerHTML =
                `还原《天国：拯救2》徽章玩法：开局前双方各佩戴一枚徽章。本局目标 <b>${state.target}</b> 分，${scope}；` +
                `对手的徽章在相同阶位内随机获得；<b>防御徽章</b>会抵消对手同阶及更低阶徽章的效果。`;
        }

        const listEl = $('badge-list');
        if (!listEl || typeof BADGES === 'undefined') return;
        listEl.innerHTML = '';
        allowed.forEach((tier) => {
            const head = document.createElement('div');
            head.className = 'badge-tier-head';
            head.innerHTML = `<i class="tier-dot ${tier}"></i>${tierTitle[tier]}`;
            listEl.appendChild(head);
            const grid = document.createElement('div');
            grid.className = 'badge-grid';
            BADGES.filter((b) => b.tier === tier).forEach((def) => {
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'badge-card';
                card.innerHTML = `<span class="b-name">${def.name}</span><span class="b-desc">${def.desc}</span>`;
                card.addEventListener('click', () => {
                    if (typeof state !== 'undefined') {
                        state.badges.me = typeof makeBadge === 'function' ? makeBadge(def.id) : null;
                        state.badges.ai = typeof randomAiBadge === 'function' ? randomAiBadge(allowed) : null;
                    }
                    const bm = $('badge-modal');
                    if (bm) bm.classList.add('hidden');
                    if (typeof state !== 'undefined' && state.useDefaultDice) {
                        if (typeof global.startGame === 'function') global.startGame(state.defaultDice);
                    } else {
                        openDiceSelectModal('pre-game', (chosenDice) => {
                            if (typeof global.startGame === 'function') global.startGame(chosenDice);
                        });
                    }
                });
                grid.appendChild(card);
            });
            listEl.appendChild(grid);
        });
    }

    /* ── 初始化所有弹层事件 ───────────── */
    function initModalEvents(callbacks = {}) {
        const btnStart = $('btn-start');
        if (btnStart) btnStart.addEventListener('click', () => openStartModal('mode'));

        const modeStep = $('start-step-mode');
        if (modeStep) {
            modeStep.addEventListener('click', (e) => {
                const btn = e.target.closest('button[data-mode]');
                if (!btn) return;
                if (btn.dataset.mode === 'badge') {
                    openStartModal('target');
                } else if (btn.dataset.mode === 'none') {
                    const sm = $('start-modal');
                    if (sm) sm.classList.add('hidden');
                    if (typeof state !== 'undefined') {
                        state.target = 1500;
                        state.badges = { me: null, ai: null };
                        if (state.useDefaultDice) {
                            if (typeof callbacks.startGame === 'function') callbacks.startGame(state.defaultDice);
                        } else {
                            openDiceSelectModal('pre-game', (chosenDice) => {
                                if (typeof callbacks.startGame === 'function') callbacks.startGame(chosenDice);
                            });
                        }
                    }
                } else {
                    const sm = $('start-modal');
                    if (sm) sm.classList.add('hidden');
                }
            });
        }

        const targetStep = $('start-step-target');
        if (targetStep) {
            targetStep.addEventListener('click', (e) => {
                const btn = e.target.closest('button[data-target]');
                if (!btn) return;
                if (btn.dataset.target === 'back') {
                    openStartModal('mode');
                    return;
                }
                if (typeof state !== 'undefined') {
                    state.target = Number(btn.dataset.target);
                    allowedTiers =
                        typeof TARGET_TIERS !== 'undefined' && TARGET_TIERS[state.target]
                            ? TARGET_TIERS[state.target]
                            : TARGET_TIERS[8000];
                    renderBadgeList(allowedTiers);
                }
                const sm = $('start-modal');
                if (sm) sm.classList.add('hidden');
                const bm = $('badge-modal');
                if (bm) bm.classList.remove('hidden');
            });
        }

        const btnCloseBadge = $('btn-close-badge');
        if (btnCloseBadge) {
            btnCloseBadge.addEventListener('click', () => {
                const bm = $('badge-modal');
                if (bm) bm.classList.add('hidden');
                openStartModal('target');
            });
        }

        // 设置弹层
        const btnSettings = $('btn-settings');
        if (btnSettings) btnSettings.addEventListener('click', openSettingsModal);
        const btnQuickConfig = $('btn-quick-config-dice');
        if (btnQuickConfig) btnQuickConfig.addEventListener('click', openSettingsModal);
        const btnCloseSettings = $('btn-close-settings');
        if (btnCloseSettings) btnCloseSettings.addEventListener('click', closeSettingsModal);
        const btnSaveSettings = $('btn-save-settings');
        if (btnSaveSettings) btnSaveSettings.addEventListener('click', closeSettingsModal);

        const settingsModal = $('settings-modal');
        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target === settingsModal) closeSettingsModal();
            });
        }

        const toggle = $('setting-default-dice-toggle');
        if (toggle) {
            toggle.addEventListener('change', (e) => {
                if (typeof state !== 'undefined') {
                    state.useDefaultDice = !!e.target.checked;
                    if (typeof saveStoredUseDefault === 'function') saveStoredUseDefault(state.useDefaultDice);
                }
                updateSettingToggleDesc();
                renderSetupLoadout();
            });
        }

        const btnResetDice = $('btn-reset-default-dice');
        if (btnResetDice) {
            btnResetDice.addEventListener('click', () => {
                if (typeof state !== 'undefined') {
                    state.defaultDice = ['ordinary', 'ordinary', 'ordinary', 'ordinary', 'ordinary', 'ordinary'];
                    if (typeof saveStoredDefaultDice === 'function') saveStoredDefaultDice(state.defaultDice);
                }
                renderSettingsSlots();
                renderSetupLoadout();
            });
        }

        const btnEditDice = $('btn-edit-default-dice');
        if (btnEditDice) {
            btnEditDice.addEventListener('click', () => {
                if (settingsModal) settingsModal.classList.add('hidden');
                openDiceSelectModal('edit-default', (newDice) => {
                    if (typeof state !== 'undefined') {
                        state.defaultDice = [...newDice];
                        if (typeof saveStoredDefaultDice === 'function') saveStoredDefaultDice(state.defaultDice);
                    }
                    renderSettingsSlots();
                    renderSetupLoadout();
                    openSettingsModal();
                });
            });
        }

        // 选骰弹层
        const btnFillOrdinary = $('btn-fill-ordinary');
        if (btnFillOrdinary) {
            btnFillOrdinary.addEventListener('click', () => {
                diceModalState.selected = ['ordinary', 'ordinary', 'ordinary', 'ordinary', 'ordinary', 'ordinary'];
                renderDiceSelectSlots();
            });
        }

        const btnClearDice = $('btn-clear-dice');
        if (btnClearDice) {
            btnClearDice.addEventListener('click', () => {
                diceModalState.selected = [];
                renderDiceSelectSlots();
            });
        }

        const catalogTabs = $('dice-catalog-tabs');
        if (catalogTabs) {
            catalogTabs.addEventListener('click', (e) => {
                const tab = e.target.closest('button[data-cat]');
                if (!tab) return;
                renderDiceCatalog(tab.dataset.cat);
            });
        }

        const btnCloseDiceSelect = $('btn-close-dice-select');
        if (btnCloseDiceSelect) btnCloseDiceSelect.addEventListener('click', handleDiceModalBack);
        const btnDiceBack = $('btn-dice-back');
        if (btnDiceBack) btnDiceBack.addEventListener('click', handleDiceModalBack);

        const diceSelectModal = $('dice-select-modal');
        if (diceSelectModal) {
            diceSelectModal.addEventListener('click', (e) => {
                if (e.target === diceSelectModal) handleDiceModalBack();
            });
        }

        const btnConfirmDice = $('btn-confirm-dice');
        if (btnConfirmDice) {
            btnConfirmDice.addEventListener('click', () => {
                if (diceModalState.selected.length !== 6) return;
                const chosen = [...diceModalState.selected];
                closeDiceSelectModal();
                if (diceModalState.onConfirm) {
                    diceModalState.onConfirm(chosen);
                }
            });
        }

        // 规则弹层
        const btnRules = $('btn-rules');
        const btnCloseRules = $('btn-close-rules');
        const rulesModal = $('rules-modal');
        if (btnRules && rulesModal) btnRules.addEventListener('click', () => rulesModal.classList.remove('hidden'));
        if (btnCloseRules && rulesModal)
            btnCloseRules.addEventListener('click', () => rulesModal.classList.add('hidden'));
        if (rulesModal) {
            rulesModal.addEventListener('click', (e) => {
                if (e.target === rulesModal) rulesModal.classList.add('hidden');
            });
        }

        // 规则弹层中的徽章一览
        const rulesBadgeList = $('rules-badge-list');
        if (rulesBadgeList && typeof BADGES !== 'undefined') {
            const tbl = document.createElement('table');
            tbl.className = 'score-table';
            tbl.innerHTML =
                '<thead><tr><th>徽章</th><th>效果</th></tr></thead><tbody>' +
                BADGES.map((b) => `<tr><td>${b.name}</td><td>${b.desc}</td></tr>`).join('') +
                '</tbody>';
            rulesBadgeList.appendChild(tbl);
        }
    }

    global.FarkleModalManager = {
        renderSetupLoadout,
        openStartModal,
        openSettingsModal,
        closeSettingsModal,
        openDiceSelectModal,
        closeDiceSelectModal,
        renderBadgeList,
        initModalEvents
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = global.FarkleModalManager;
    }
})(typeof window !== 'undefined' ? window : this);
