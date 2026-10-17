const { describe, it, expect } = require('../test-utils.js');
const { filterWeapons } = require('../../ark_end/all_weapons/js/app.js');

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

    describe('边界与异常处理', () => {
        it('输入非数组数据时安全返回空数组', () => {
            expect(filterWeapons(null, 'standard', {}).length).toBe(0);
            expect(filterWeapons(undefined, 'advanced', {}).length).toBe(0);
        });
    });
});
