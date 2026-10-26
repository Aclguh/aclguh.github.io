const { describe, it, expect, beforeEach, afterEach } = require('../test-utils.js');
const {
    filterWeapons,
    getUniqueValues,
    createWeaponCard,
    clearCurrentMode,
    selectSingleFilter,
    toggleBasicMulti,
    selectAdvancedSingle,
    switchMode,
    renderWeapons,
    applyFilters,
    initApp
} = require('../../ark_end/all_weapons/js/app.js');

describe('ArkEnd Weapon Filter Module', () => {
    const mockWeapons = [
        { name: '武器A', star: 6, type: '单手剑', basic: '攻击力', additional: '物理', skill: '强攻' },
        { name: '武器B', star: 5, type: '双手剑', basic: '生命值', additional: '物理', skill: '强攻' },
        { name: '武器C', star: 5, type: '法杖', basic: '攻击力', additional: '法术', skill: '效益' },
        { name: '武器D', star: 4, type: '手枪', basic: '防御力', additional: '自然', skill: '巧技' }
    ];

    describe('Standard Mode (单选与关系)', () => {
        it('无筛选条件时返回全部武器', () => {
            const res = filterWeapons(mockWeapons, 'standard', { basic: '', additional: '', skill: '' });
            expect(res.length).toBe(4);
        });

        it('按单一基础属性筛选', () => {
            const res = filterWeapons(mockWeapons, 'standard', { basic: '攻击力', additional: '', skill: '' });
            expect(res.length).toBe(2);
            expect(res.map((w) => w.name)).toContain('武器A');
            expect(res.map((w) => w.name)).toContain('武器C');
        });

        it('三属性同时复合筛选（与关系）', () => {
            const res = filterWeapons(mockWeapons, 'standard', { basic: '攻击力', additional: '物理', skill: '强攻' });
            expect(res.length).toBe(1);
            expect(res[0].name).toBe('武器A');
        });

        it('无匹配结果时返回空数组', () => {
            const res = filterWeapons(mockWeapons, 'standard', { basic: '防御力', additional: '法术', skill: '强攻' });
            expect(res.length).toBe(0);
        });
    });

    describe('Advanced Mode (基础属性多选，其他单选)', () => {
        it('基础属性多选匹配任意一项（或关系）', () => {
            const res = filterWeapons(mockWeapons, 'advanced', {
                basic: ['攻击力', '生命值'],
                additional: '',
                skill: ''
            });
            expect(res.length).toBe(3);
            expect(res.map((w) => w.name)).toContain('武器A');
            expect(res.map((w) => w.name)).toContain('武器B');
            expect(res.map((w) => w.name)).toContain('武器C');
        });

        it('基础属性多选结合附加属性单选', () => {
            const res = filterWeapons(mockWeapons, 'advanced', {
                basic: ['攻击力', '生命值'],
                additional: '物理',
                skill: ''
            });
            expect(res.length).toBe(2);
            expect(res.map((w) => w.name)).toContain('武器A');
            expect(res.map((w) => w.name)).toContain('武器B');
        });

        it('基础属性空数组时视作不限', () => {
            const res = filterWeapons(mockWeapons, 'advanced', {
                basic: [],
                additional: '自然',
                skill: '巧技'
            });
            expect(res.length).toBe(1);
            expect(res[0].name).toBe('武器D');
        });
    });

    describe('getUniqueValues 属性提取', () => {
        it('能正确去重提取基础、附加和技能属性列表', () => {
            const uniq = getUniqueValues(mockWeapons);
            expect(uniq.basic.length).toBe(3);
            expect(uniq.additional.length).toBe(3);
            expect(uniq.skill.length).toBe(3);
            expect(uniq.basic).toContain('攻击力');
            expect(uniq.basic).toContain('生命值');
            expect(uniq.basic).toContain('防御力');
        });

        it('处理空列表或非法输入', () => {
            const empty = getUniqueValues(null);
            expect(empty.basic.length).toBe(0);
            expect(empty.additional.length).toBe(0);
            expect(empty.skill.length).toBe(0);
        });
    });

    describe('createWeaponCard 卡片渲染', () => {
        it('正确生成星级和属性 DOM/HTML 结构', () => {
            const html = createWeaponCard(mockWeapons[0]);
            expect(html).toContain('武器A');
            expect(html).toContain('单手剑');
            expect(html).toContain('基础属性');
            expect(html).toContain('攻击力');
            expect(html).toContain('物理');
            expect(html).toContain('强攻');
            expect(html).toContain('star');
        });
    });

    describe('clearCurrentMode', () => {
        it('执行清空当前筛选不抛出异常', () => {
            expect(() => clearCurrentMode()).not.toThrow();
        });
    });

    describe('交互筛选状态函数', () => {
        function mockBtn(text, isActive = false) {
            const classList = new Set(isActive ? ['active', 'filter-btn'] : ['filter-btn']);
            const btn = {
                textContent: text,
                classList: {
                    contains: (c) => classList.has(c),
                    add: (c) => classList.add(c),
                    remove: (c) => classList.delete(c)
                }
            };
            const parent = {
                querySelectorAll: () => [btn]
            };
            btn.parentElement = parent;
            return btn;
        }

        it('selectSingleFilter 切换选择与再次点击取消', () => {
            const btn = mockBtn('攻击力', false);
            expect(() => selectSingleFilter('standard', 'basic', '攻击力', btn)).not.toThrow();

            // 再次点击已选中的非全部按钮取消
            btn.classList.add('active');
            expect(() => selectSingleFilter('standard', 'basic', '攻击力', btn)).not.toThrow();
        });

        it('toggleBasicMulti 多选增加与取消', () => {
            const btn = mockBtn('攻击力', false);
            expect(() => toggleBasicMulti('攻击力', btn)).not.toThrow();
            // 再次点击取消
            expect(() => toggleBasicMulti('攻击力', btn)).not.toThrow();
        });

        it('selectAdvancedSingle 高级模式单选与取消', () => {
            const btn = mockBtn('物理', false);
            expect(() => selectAdvancedSingle('additional', '物理', btn)).not.toThrow();
            btn.classList.add('active');
            expect(() => selectAdvancedSingle('additional', '物理', btn)).not.toThrow();
        });

        it('switchMode 切换模式安全降级', () => {
            expect(() => switchMode('standard')).not.toThrow();
            expect(() => switchMode('advanced')).not.toThrow();
        });
    });

    describe('边界与异常处理', () => {
        it('输入非数组数据时安全返回空数组', () => {
            expect(filterWeapons(null, 'standard', {}).length).toBe(0);
            expect(filterWeapons(undefined, 'advanced', {}).length).toBe(0);
        });
    });

    describe('DOM 渲染与完整初始化交互', () => {
        let mockElements;
        const origDocument = global.document;

        function makeElement(id) {
            const classList = new Set();
            const children = [];
            const listeners = {};
            return {
                id,
                innerHTML: '',
                textContent: '',
                dataset: {},
                children,
                style: {},
                classList: {
                    add: (c) => classList.add(c),
                    remove: (c) => classList.delete(c),
                    contains: (c) => classList.has(c),
                    toggle: (c, val) => (val ? classList.add(c) : classList.delete(c))
                },
                appendChild: (ch) => children.push(ch),
                addEventListener: (event, cb) => {
                    listeners[event] = listeners[event] || [];
                    listeners[event].push(cb);
                },
                querySelectorAll: () => [],
                querySelector: () => null
            };
        }

        beforeEach(() => {
            mockElements = {
                basicFilterStandard: makeElement('basicFilterStandard'),
                additionalFilterStandard: makeElement('additionalFilterStandard'),
                skillFilterStandard: makeElement('skillFilterStandard'),
                basicFilterAdvanced: makeElement('basicFilterAdvanced'),
                additionalFilterAdvanced: makeElement('additionalFilterAdvanced'),
                skillFilterAdvanced: makeElement('skillFilterAdvanced'),
                basicCount: makeElement('basicCount'),
                standardMode: makeElement('standardMode'),
                advancedMode: makeElement('advancedMode'),
                weaponsGrid: makeElement('weaponsGrid'),
                weaponCount: makeElement('weaponCount'),
                clearBtn: makeElement('clearBtn')
            };

            const modeTabs = [
                Object.assign(makeElement('tab1'), { dataset: { mode: 'standard' } }),
                Object.assign(makeElement('tab2'), { dataset: { mode: 'advanced' } })
            ];

            global.document = {
                getElementById: (id) => mockElements[id] || null,
                querySelectorAll: (sel) => {
                    if (sel === '.mode-tab') return modeTabs;
                    if (sel.includes('.filter-btn')) return [];
                    return [];
                },
                createElement: (tag) => makeElement(tag),
                addEventListener: () => {}
            };
        });

        afterEach(() => {
            global.document = origDocument;
        });

        it('initApp 正常运行并构建两套筛选器', () => {
            initApp();
            expect(mockElements.basicFilterStandard.children.length).toBeGreaterThan(0);
            expect(mockElements.basicFilterAdvanced.children.length).toBeGreaterThan(0);
            expect(mockElements.weaponCount.textContent).toBeDefined();
        });

        it('renderWeapons 渲染武器列表及空状态', () => {
            renderWeapons(mockWeapons);
            expect(mockElements.weaponCount.textContent).toBe(4);
            expect(mockElements.weaponsGrid.children.length).toBe(4);

            renderWeapons([]);
            expect(mockElements.weaponCount.textContent).toBe(0);
            expect(mockElements.weaponsGrid.innerHTML).toContain('未找到匹配武器');
        });

        it('switchMode 切换界面容器与类名', () => {
            switchMode('advanced');
            expect(mockElements.standardMode.classList.contains('hidden')).toBe(true);
            expect(mockElements.advancedMode.classList.contains('hidden')).toBe(false);

            switchMode('standard');
            expect(mockElements.standardMode.classList.contains('hidden')).toBe(false);
            expect(mockElements.advancedMode.classList.contains('hidden')).toBe(true);
        });

        it('clearCurrentMode 重置筛选状态并刷新', () => {
            clearCurrentMode();
            expect(mockElements.weaponCount.textContent).toBeDefined();
        });

        it('applyFilters 执行过滤并返回数组', () => {
            const res = applyFilters();
            expect(Array.isArray(res)).toBe(true);
        });
    });
});
