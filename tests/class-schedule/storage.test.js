const { describe, it, expect, beforeEach, afterEach } = require('../test-utils.js');
const { SafeStorage } = require('../../shared/js/storage.js');
const {
    STORAGE_KEY,
    WEEK_KEY,
    SEMESTER_DATE_KEY,
    TIME_SLOTS_KEY,
    VIEW_MODE_KEY,
    DEFAULT_TIME_SLOTS,
    makeDefaultSlot,
    cloneSlots,
    loadTimeSlots,
    saveTimeSlots,
    expandTimeSlotsTo,
    getRenderSlots,
    loadSchedule,
    saveSchedule,
    loadCurrentWeek,
    saveCurrentWeek,
    loadSemesterStart,
    saveSemesterStart,
    loadViewMode,
    saveViewMode,
    clearSchedule,
    hasSchedule
} = require('../../class-schedule/js/storage.js');

describe('Class Schedule Storage Module', () => {
    let mockStorage = {};

    beforeEach(() => {
        mockStorage = {};
        global.localStorage = {
            getItem: (key) => (key in mockStorage ? mockStorage[key] : null),
            setItem: (key, val) => {
                if (key === 'THROW_QUOTA') {
                    const err = new Error('Quota exceeded');
                    err.name = 'QuotaExceededError';
                    throw err;
                }
                mockStorage[key] = String(val);
            },
            removeItem: (key) => {
                delete mockStorage[key];
            },
            clear: () => {
                mockStorage = {};
            }
        };
        global.SafeStorage = SafeStorage;
    });

    afterEach(() => {
        delete global.localStorage;
        delete global.SafeStorage;
    });

    it('exports valid storage keys and constants', () => {
        expect(typeof STORAGE_KEY).toBe('string');
        expect(typeof WEEK_KEY).toBe('string');
        expect(typeof SEMESTER_DATE_KEY).toBe('string');
        expect(typeof TIME_SLOTS_KEY).toBe('string');
        expect(typeof VIEW_MODE_KEY).toBe('string');
    });

    describe('makeDefaultSlot & cloneSlots', () => {
        it('makes a default slot with empty start/end', () => {
            const slot = makeDefaultSlot(7);
            expect(slot).toEqual({ label: '第7节', start: '', end: '' });
        });

        it('clones slots properly without modifying original', () => {
            const original = [{ label: '节1', start: '08:00', end: '09:00' }];
            const cloned = cloneSlots(original);
            cloned[0].label = '修改后';
            expect(original[0].label).toBe('节1');
        });
    });

    describe('loadTimeSlots & saveTimeSlots', () => {
        it('returns default slots when storage is empty or invalid', () => {
            const slots = loadTimeSlots();
            expect(slots.length).toBe(DEFAULT_TIME_SLOTS.length);
            expect(slots[0].label).toBe(DEFAULT_TIME_SLOTS[0].label);

            mockStorage[TIME_SLOTS_KEY] = 'invalid-json';
            expect(loadTimeSlots().length).toBe(DEFAULT_TIME_SLOTS.length);

            mockStorage[TIME_SLOTS_KEY] = JSON.stringify('not-an-array');
            expect(loadTimeSlots().length).toBe(DEFAULT_TIME_SLOTS.length);
        });

        it('saves and loads customized slots accurately', () => {
            const custom = [
                { label: '早读', start: '07:30', end: '08:00' },
                { label: '第一节', start: '08:10', end: '08:55' }
            ];
            const ok = saveTimeSlots(custom);
            expect(ok).toBe(true);

            const loaded = loadTimeSlots();
            expect(loaded.length).toBe(2);
            expect(loaded[0].label).toBe('早读');
            expect(loaded[1].start).toBe('08:10');
        });

        it('expands slots to required number', () => {
            const slots = expandTimeSlotsTo(8);
            expect(slots.length).toBe(8);
            expect(slots[7].label).toBe('第8节');
        });

        it('calculates render slots taking into account schedule maxSlot and courses', () => {
            const schedule = { courses: [{ timeSlot: 9 }] };
            const renderSlots = getRenderSlots(schedule);
            expect(renderSlots.length >= 10).toBe(true);
        });
    });

    describe('Schedule data persistence (saveSchedule, loadSchedule, clearSchedule, hasSchedule)', () => {
        it('returns null when no schedule saved or corrupt', () => {
            expect(loadSchedule()).toBeNull();
            expect(hasSchedule()).toBe(false);

            mockStorage[STORAGE_KEY] = 'not-json';
            expect(loadSchedule()).toBeNull();
        });

        it('saves and loads valid schedule successfully', () => {
            const data = {
                semester: '2026-2027学年第一学期',
                className: '计科2201',
                courses: [{ name: '计算机网络', teacher: '李老师', dayOfWeek: 1, timeSlot: 1, weeks: [1, 2, 3] }]
            };
            const ok = saveSchedule(data);
            expect(ok).toBe(true);
            expect(hasSchedule()).toBe(true);

            const loaded = loadSchedule();
            expect(loaded.semester).toBe('2026-2027学年第一学期');
            expect(loaded.courses.length).toBe(1);
        });

        it('clears schedule properly', () => {
            saveSchedule({ courses: [{ name: '测试' }] });
            saveCurrentWeek(3);
            saveSemesterStart('2026-09-01');

            clearSchedule();
            expect(hasSchedule()).toBe(false);
            expect(loadSchedule()).toBeNull();
            expect(loadSemesterStart()).toBeNull();
        });
    });

    describe('Current week & Semester & View Mode preferences', () => {
        it('handles current week with bounds checking', () => {
            expect(loadCurrentWeek()).toBe(1);

            saveCurrentWeek(5);
            expect(loadCurrentWeek()).toBe(5);

            saveCurrentWeek(0); // 非法值回退 1
            expect(loadCurrentWeek()).toBe(1);

            saveCurrentWeek(99); // 超出上限回退 1
            expect(loadCurrentWeek()).toBe(1);
        });

        it('saves and loads semester start date', () => {
            expect(loadSemesterStart()).toBeNull();
            saveSemesterStart('2026-09-07');
            expect(loadSemesterStart()).toBe('2026-09-07');
        });

        it('manages view mode (grid vs day)', () => {
            expect(loadViewMode()).toBe('grid');
            saveViewMode('day');
            expect(loadViewMode()).toBe('day');
            saveViewMode('invalid');
            expect(loadViewMode()).toBe('grid');
        });
    });
});
