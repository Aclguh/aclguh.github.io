const { describe, it, expect, beforeEach, afterEach } = require('../test-utils.js');
const { SafeStorage } = require('../../shared/js/storage.js');
const WeightStorage = require('../../weightRecord/js/storage.js');

describe('WeightStorage Module', () => {
    let mockStore = {};

    beforeEach(() => {
        mockStore = {};
        global.localStorage = {
            getItem: (k) => (k in mockStore ? mockStore[k] : null),
            setItem: (k, v) => {
                mockStore[k] = String(v);
            },
            removeItem: (k) => {
                delete mockStore[k];
            },
            clear: () => {
                mockStore = {};
            }
        };
        global.SafeStorage = SafeStorage;
    });

    afterEach(() => {
        delete global.localStorage;
        delete global.SafeStorage;
    });

    describe('records persistence', () => {
        it('returns empty array when no records stored', () => {
            const records = WeightStorage.loadRecords();
            expect(records).toEqual([]);
        });

        it('saves and loads records accurately', () => {
            const sample = [
                { id: '1', date: '2026-10-10', weight: 65.5 },
                { id: '2', date: '2026-10-11', weight: 65.2 }
            ];
            const ok = WeightStorage.saveRecords(sample);
            expect(ok).toBe(true);

            const loaded = WeightStorage.loadRecords();
            expect(loaded).toEqual(sample);
        });

        it('clears all records properly', () => {
            WeightStorage.saveRecords([{ id: '1', date: '2026-10-10', weight: 65.5 }]);
            expect(WeightStorage.loadRecords().length).toBe(1);

            WeightStorage.clearRecords();
            expect(WeightStorage.loadRecords()).toEqual([]);
        });
    });

    describe('settings persistence and defaults', () => {
        it('loads hover guides with default true', () => {
            expect(WeightStorage.loadHoverGuides()).toBe(true);
            WeightStorage.saveHoverGuides(false);
            expect(WeightStorage.loadHoverGuides()).toBe(false);
            WeightStorage.saveHoverGuides(true);
            expect(WeightStorage.loadHoverGuides()).toBe(true);
        });

        it('loads tooltip opacity with default 94 and validates bounds', () => {
            expect(WeightStorage.loadTooltipOpacity()).toBe(94);
            WeightStorage.saveTooltipOpacity(50);
            expect(WeightStorage.loadTooltipOpacity()).toBe(50);
            WeightStorage.saveTooltipOpacity(999); // out of range
            expect(WeightStorage.loadTooltipOpacity()).toBe(94);
        });

        it('loads BMI settings accurately', () => {
            expect(WeightStorage.loadBmiEnabled()).toBe(false);
            WeightStorage.saveBmiEnabled(true);
            expect(WeightStorage.loadBmiEnabled()).toBe(true);

            expect(WeightStorage.loadBmiHeight()).toBe(null);
            WeightStorage.saveBmiHeight(175.5);
            expect(WeightStorage.loadBmiHeight()).toBe(175.5);
            WeightStorage.saveBmiHeight(null);
            expect(WeightStorage.loadBmiHeight()).toBe(null);
        });

        it('defaults line color to "default" and rejects invalid values like "gradient"', () => {
            expect(WeightStorage.loadLineColor()).toBe('default');
            WeightStorage.saveLineColor('clear');
            expect(WeightStorage.loadLineColor()).toBe('clear');
            WeightStorage.saveLineColor('red');
            expect(WeightStorage.loadLineColor()).toBe('red');

            // Corrupt or outdated value
            mockStore['weight_line_color'] = 'gradient';
            expect(WeightStorage.loadLineColor()).toBe('default');
        });

        it('defaults line style to "smooth" and supports sharp and kline', () => {
            expect(WeightStorage.loadLineStyle()).toBe('smooth');
            WeightStorage.saveLineStyle('kline');
            expect(WeightStorage.loadLineStyle()).toBe('kline');

            mockStore['weight_line_style'] = 'unknown_style';
            expect(WeightStorage.loadLineStyle()).toBe('smooth');
        });

        it('defaults date axis to "real" and rejects invalid values like "recorded"', () => {
            expect(WeightStorage.loadDateAxis()).toBe('real');
            WeightStorage.saveDateAxis('equal');
            expect(WeightStorage.loadDateAxis()).toBe('equal');

            // Corrupt or outdated value
            mockStore['weight_date_axis'] = 'recorded';
            expect(WeightStorage.loadDateAxis()).toBe('real');
        });
    });

    describe('fallback when SafeStorage is unavailable', () => {
        beforeEach(() => {
            delete global.SafeStorage;
        });

        it('still loads and saves records using raw localStorage fallback', () => {
            const data = [{ id: 'fb', date: '2026-10-18', weight: 70.0 }];
            mockStore['weight_records'] = JSON.stringify(data);

            const loaded = WeightStorage.loadRecords();
            expect(loaded).toEqual(data);

            data.push({ id: 'fb2', date: '2026-10-19', weight: 69.8 });
            const saved = WeightStorage.saveRecords(data);
            expect(saved).toBe(true);
            expect(JSON.parse(mockStore['weight_records'])).toEqual(data);
        });

        it('still manages settings using raw localStorage fallback', () => {
            expect(WeightStorage.loadLineColor()).toBe('default');
            WeightStorage.saveLineColor('blue');
            expect(mockStore['weight_line_color']).toBe('blue');
            expect(WeightStorage.loadLineColor()).toBe('blue');

            expect(WeightStorage.loadDateAxis()).toBe('real');
            WeightStorage.saveDateAxis('equal');
            expect(mockStore['weight_date_axis']).toBe('equal');
            expect(WeightStorage.loadDateAxis()).toBe('equal');
        });
    });
});
