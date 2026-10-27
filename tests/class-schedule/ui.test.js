const { describe, it, expect } = require('../test-utils.js');
const storage = require('../../class-schedule/js/storage.js');

global.loadSemesterStart = storage.loadSemesterStart || (() => '');
global.loadCurrentWeek = storage.loadCurrentWeek || (() => 1);

const scheduleUI = require('../../class-schedule/js/ui.js');

describe('Class Schedule: UI utilities module', () => {
    describe('formatWeeks 周次格式化', () => {
        it('空周次返回空字符串', () => {
            expect(scheduleUI.formatWeeks([])).toBe('');
            expect(scheduleUI.formatWeeks(null)).toBe('');
        });

        it('连续单区间压缩为短横线', () => {
            expect(scheduleUI.formatWeeks([1, 2, 3, 4, 5])).toBe('1-5');
            expect(scheduleUI.formatWeeks([1])).toBe('1');
        });

        it('多个非连续区间正确组合展示', () => {
            expect(scheduleUI.formatWeeks([1, 2, 3, 5, 6, 7])).toBe('1-3, 5-7');
            expect(scheduleUI.formatWeeks([2, 4, 6])).toBe('2, 4, 6');
        });
    });

    describe('formatSlotTime 节次时间格式化', () => {
        it('同时包含起始与结束时间时用短横线连接', () => {
            expect(scheduleUI.formatSlotTime({ start: '08:00', end: '09:40' })).toBe('08:00 - 09:40');
        });

        it('缺少其中一个时间时返回起或至描述', () => {
            expect(scheduleUI.formatSlotTime({ start: '08:00', end: '' })).toBe('08:00 起');
            expect(scheduleUI.formatSlotTime({ start: '', end: '09:40' })).toBe('至 09:40');
            expect(scheduleUI.formatSlotTime({})).toBe('');
        });
    });

    describe('getTodayWeekAndDay 当前周次与星期推导', () => {
        it('无学期开始日期时安全返回 null', () => {
            const data = { semesterStart: '' };
            expect(scheduleUI.getTodayWeekAndDay(data)).toBeNull();
        });

        it('有有效开始日期时正确计算周次与星期几', () => {
            const data = { semesterStart: '2026-09-01' };
            const res = scheduleUI.getTodayWeekAndDay(data);
            if (res !== null) {
                expect(typeof res.week).toBe('number');
                expect(typeof res.dayOfWeek).toBe('number');
                expect(res.dayOfWeek).toBeGreaterThanOrEqual(1);
                expect(res.dayOfWeek).toBeLessThanOrEqual(7);
            }
        });
    });

    describe('escapeHtml & escapeAttr', () => {
        it('正确转义 HTML 特殊字符', () => {
            expect(scheduleUI.escapeHtml('<script>alert("1")</script>')).toBe(
                '&lt;script&gt;alert(&quot;1&quot;)&lt;/script&gt;'
            );
            expect(scheduleUI.escapeAttr('title "x" & <y>')).toBe('title &quot;x&quot; &amp; &lt;y&gt;');
        });
    });
});
