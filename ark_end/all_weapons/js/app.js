// 武器数据由 shared/data/weapons.js 统一提供

// 当前模式：'standard' 或 'advanced'
let currentMode = 'standard';

// 标准模式筛选状态（单选）
let standardFilters = {
    basic: '',
    additional: '',
    skill: ''
};

// 高级模式筛选状态（基础属性多选，其他单选）
let advancedFilters = {
    basic: [], // 数组，最多3个
    additional: '',
    skill: ''
};

// 提取唯一值
const uniqueValues = {
    basic: [...new Set(weaponsData.map(w => w.basic))],
    additional: [...new Set(weaponsData.map(w => w.additional))],
    skill: [...new Set(weaponsData.map(w => w.skill))]
};

// 初始化
window.onload = () => {
    initStandardFilters();
    initAdvancedFilters();
    applyFilters();
};

// 初始化标准模式筛选器（单选，支持取消）
function initStandardFilters() {
    createSingleFilter('basicFilterStandard', uniqueValues.basic, 'basic', 'standard');
    createSingleFilter('additionalFilterStandard', uniqueValues.additional, 'additional', 'standard');
    createSingleFilter('skillFilterStandard', uniqueValues.skill, 'skill', 'standard');
}

// 创建单选筛选器（带全部按钮，支持点击取消）
function createSingleFilter(containerId, values, filterType, mode) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    // 添加"全部"按钮
    const allBtn = document.createElement('button');
    allBtn.className = 'filter-btn active';
    allBtn.textContent = '全部';
    allBtn.onclick = () => selectSingleFilter(mode, filterType, '', allBtn);
    container.appendChild(allBtn);

    // 添加属性按钮
    values.forEach(value => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.textContent = value;
        btn.onclick = () => selectSingleFilter(mode, filterType, value, btn);
        container.appendChild(btn);
    });
}

// 单选筛选逻辑（点击已选可取消）
function selectSingleFilter(mode, type, value, btnElement) {
    const container = btnElement.parentElement;
    const buttons = container.querySelectorAll('.filter-btn');
    const isAllBtn = btnElement.textContent === '全部';

    // 判断是否点击的是已选中的按钮（且不是"全部"按钮）
    const isAlreadySelected = btnElement.classList.contains('active') && !isAllBtn;

    if (isAlreadySelected) {
        // 取消选择，回到全部
        buttons.forEach(b => b.classList.remove('active'));
        buttons[0].classList.add('active'); // 第一个按钮是"全部"

        if (mode === 'standard') {
            standardFilters[type] = '';
        }
    } else {
        // 选择新的（切换到新按钮）
        buttons.forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');

        if (mode === 'standard') {
            standardFilters[type] = value;
        }
    }

    applyFilters();
}

// 初始化高级模式筛选器（基础属性多选，其他单选）
function initAdvancedFilters() {
    // 基础属性 - 多选（无"全部"按钮）
    const basicContainer = document.getElementById('basicFilterAdvanced');
    basicContainer.innerHTML = '';
    uniqueValues.basic.forEach(value => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn multi';
        btn.textContent = value;
        btn.onclick = () => toggleBasicMulti(value, btn);
        basicContainer.appendChild(btn);
    });

    // 附加属性 - 单选（有全部）
    createSingleFilterAdvanced('additionalFilterAdvanced', uniqueValues.additional, 'additional');

    // 技能属性 - 单选（有全部）
    createSingleFilterAdvanced('skillFilterAdvanced', uniqueValues.skill, 'skill');
}

// 创建高级模式的单选筛选器（附加和技能属性）
function createSingleFilterAdvanced(containerId, values, filterType) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = 'filter-btn active';
    allBtn.textContent = '全部（不限）';
    allBtn.onclick = () => selectAdvancedSingle(filterType, '', allBtn);
    container.appendChild(allBtn);

    values.forEach(value => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.textContent = value;
        btn.onclick = () => selectAdvancedSingle(filterType, value, btn);
        container.appendChild(btn);
    });
}

// 基础属性多选切换
function toggleBasicMulti(value, btnElement) {
    const index = advancedFilters.basic.indexOf(value);

    if (index > -1) {
        // 已选中，取消选择
        advancedFilters.basic.splice(index, 1);
        btnElement.classList.remove('active');
    } else {
        // 未选中，检查是否已达上限
        if (advancedFilters.basic.length >= 3) {
            alert('最多只能选择3个基础属性！请先取消已选的某个属性。');
            return;
        }
        advancedFilters.basic.push(value);
        btnElement.classList.add('active');
    }

    updateBasicCount();
    applyFilters();
}

// 更新基础属性计数显示
function updateBasicCount() {
    const countEl = document.getElementById('basicCount');
    const count = advancedFilters.basic.length;
    countEl.textContent = `已选: ${count}/3`;

    if (count >= 3) {
        countEl.classList.add('warning');
        // 禁用未选中的按钮
        document.querySelectorAll('#basicFilterAdvanced .filter-btn').forEach(btn => {
            if (!btn.classList.contains('active')) {
                btn.classList.add('disabled');
            }
        });
    } else {
        countEl.classList.remove('warning');
        // 解除禁用
        document.querySelectorAll('#basicFilterAdvanced .filter-btn').forEach(btn => {
            btn.classList.remove('disabled');
        });
    }
}

// 高级模式单选（附加/技能属性）
function selectAdvancedSingle(type, value, btnElement) {
    const container = btnElement.parentElement;
    const buttons = container.querySelectorAll('.filter-btn');
    const isAllBtn = btnElement.textContent.includes('全部');
    const isAlreadySelected = btnElement.classList.contains('active') && !isAllBtn;

    if (isAlreadySelected) {
        // 取消选择，回到全部
        buttons.forEach(b => b.classList.remove('active'));
        buttons[0].classList.add('active');
        advancedFilters[type] = '';
    } else {
        buttons.forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
        advancedFilters[type] = value;
    }

    applyFilters();
}

// 模式切换
function switchMode(mode) {
    currentMode = mode;

    // 更新标签样式
    document.querySelectorAll('.mode-tab').forEach((tab, index) => {
        if ((mode === 'standard' && index === 0) || (mode === 'advanced' && index === 1)) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // 显示/隐藏对应面板
    if (mode === 'standard') {
        document.getElementById('standardMode').classList.remove('hidden');
        document.getElementById('advancedMode').classList.add('hidden');
    } else {
        document.getElementById('standardMode').classList.add('hidden');
        document.getElementById('advancedMode').classList.remove('hidden');
    }

    applyFilters();
}

// 应用筛选
function applyFilters() {
    let filtered;

    if (currentMode === 'standard') {
        // 标准模式：所有条件都是单选，且条件之间是"与"关系
        filtered = weaponsData.filter(weapon => {
            const matchBasic = !standardFilters.basic || weapon.basic === standardFilters.basic;
            const matchAdditional = !standardFilters.additional || weapon.additional === standardFilters.additional;
            const matchSkill = !standardFilters.skill || weapon.skill === standardFilters.skill;
            return matchBasic && matchAdditional && matchSkill;
        });
    } else {
        // 高级模式：基础属性多选（或关系），其他单选（与关系）
        filtered = weaponsData.filter(weapon => {
            const matchBasic = advancedFilters.basic.length === 0 || advancedFilters.basic.includes(weapon.basic);
            const matchAdditional = !advancedFilters.additional || weapon.additional === advancedFilters.additional;
            const matchSkill = !advancedFilters.skill || weapon.skill === advancedFilters.skill;
            return matchBasic && matchAdditional && matchSkill;
        });
    }

    renderWeapons(filtered);
}

// 渲染武器卡片
function renderWeapons(weapons) {
    const grid = document.getElementById('weaponsGrid');
    const count = document.getElementById('weaponCount');

    count.textContent = weapons.length;
    grid.innerHTML = '';

    if (weapons.length === 0) {
        grid.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">🔍</div>
                <h3>未找到匹配武器</h3>
                <p>请尝试调整筛选条件</p>
            </div>
        `;
        return;
    }

    weapons.forEach((weapon, index) => {
        const card = createWeaponCard(weapon);
        card.style.animationDelay = `${index * 0.05}s`;
        card.classList.add('fade-in');
        grid.appendChild(card);
    });
}

function createWeaponCard(weapon) {
    const card = document.createElement('div');
    card.className = 'weapon-card';

    const stars = '★'.repeat(weapon.star) + '☆'.repeat(6 - weapon.star);
    const starHtml = stars.split('').map(s =>
        `<span class="star ${s === '☆' ? 'empty' : ''}">${s}</span>`
    ).join('');

    card.innerHTML = `
        <div class="weapon-header">
            <div>
                <div class="weapon-name">${weapon.name}</div>
                <span class="weapon-type">${weapon.type}</span>
            </div>
            <div class="star-rating">${starHtml}</div>
        </div>
        <div class="weapon-attrs">
            <div class="attr-row attr-basic">
                <span class="attr-label">基础属性</span>
                <span class="attr-value">${weapon.basic}</span>
            </div>
            <div class="attr-row attr-additional">
                <span class="attr-label">附加属性</span>
                <span class="attr-value">${weapon.additional}</span>
            </div>
            <div class="attr-row attr-skill">
                <span class="attr-label">技能属性</span>
                <span class="attr-value">${weapon.skill}</span>
            </div>
        </div>
    `;

    return card;
}

// 清空当前模式的筛选
function clearCurrentMode() {
    if (currentMode === 'standard') {
        standardFilters = { basic: '', additional: '', skill: '' };
        // 重置UI
        document.querySelectorAll('#standardMode .filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.textContent === '全部') btn.classList.add('active');
        });
    } else {
        advancedFilters = { basic: [], additional: '', skill: '' };
        // 重置UI
        document.querySelectorAll('#advancedMode .filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.textContent === '全部' || btn.textContent.includes('全部（不限）')) {
                btn.classList.add('active');
            }
        });
        updateBasicCount();
    }
    applyFilters();
}
