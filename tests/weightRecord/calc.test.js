const { describe, it, expect } = require('../test-utils.js');
const WeightCalc = require('../../weightRecord/js/calc.js');

describe('WeightRecord Calc & Data Module', () => {
    describe('calcBMI', () => {
        it('calculates correct BMI and classification categories', () => {
            // 偏瘦
            const under = WeightCalc.calcBMI(45, 170);
            expect(under.bmi).toBe(15.6);
            expect(under.category).toBe('underweight');
            expect(under.label).toBe('偏瘦');

            // 正常
            const normal = WeightCalc.calcBMI(65, 175);
            expect(normal.bmi).toBe(21.2);
            expect(normal.category).toBe('normal');
            expect(normal.label).toBe('正常');

            // 超重
            const over = WeightCalc.calcBMI(75, 170);
            expect(over.bmi).toBe(26.0);
            expect(over.category).toBe('overweight');
            expect(over.label).toBe('超重');

            // 肥胖
            const obese = WeightCalc.calcBMI(90, 170);
            expect(obese.bmi).toBe(31.1);
            expect(obese.category).toBe('obese');
            expect(obese.label).toBe('肥胖');
        });

        it('returns null on invalid or missing inputs', () => {
            expect(WeightCalc.calcBMI(0, 170)).toBeNull();
            expect(WeightCalc.calcBMI(60, 0)).toBeNull();
            expect(WeightCalc.calcBMI(-50, 170)).toBeNull();
            expect(WeightCalc.calcBMI(null, null)).toBeNull();
        });
    });

    describe('calculateStats', () => {
        it('returns null fields for empty record set', () => {
            const stats = WeightCalc.calculateStats([]);
            expect(stats.count).toBe(0);
            expect(stats.current).toBeNull();
            expect(stats.min).toBeNull();
            expect(stats.max).toBeNull();
            expect(stats.avg).toBeNull();
            expect(stats.totalDiff).toBeNull();
        });

        it('calculates min, max, avg, and total difference correctly', () => {
            const records = [
                { date: '2026-01-01', weight: 70.0 },
                { date: '2026-01-05', weight: 68.5 },
                { date: '2026-01-10', weight: 72.0 },
                { date: '2026-01-15', weight: 67.5 }
            ];

            const stats = WeightCalc.calculateStats(records);
            expect(stats.count).toBe(4);
            expect(stats.min).toBe(67.5);
            expect(stats.max).toBe(72.0);
            expect(stats.current).toBe(67.5);
            expect(stats.totalDiff).toBe(-2.5);
            expect(stats.avg).toBe(69.5);
        });
    });

    describe('aggregateKLineData', () => {
        it('aggregates daily records into month OHLC candles', () => {
            const records = [
                { date: '2026-01-02', weight: 70.0 },
                { date: '2026-01-10', weight: 72.5 },
                { date: '2026-01-20', weight: 69.0 },
                { date: '2026-01-30', weight: 71.0 },
                { date: '2026-02-05', weight: 70.5 }
            ];

            const kline = WeightCalc.aggregateKLineData(records, 'month');
            expect(kline.length).toBe(2);

            const jan = kline[0];
            expect(jan.label).toBe('2026-01');
            expect(jan.open).toBe(70.0);
            expect(jan.high).toBe(72.5);
            expect(jan.low).toBe(69.0);
            expect(jan.close).toBe(71.0);
            expect(jan.count).toBe(4);
        });
    });

    describe('parseWeightCSV', () => {
        it('parses valid comma and tab-separated CSV lines with headers', () => {
            const csv = `日期,体重(kg)\n2026-01-01,65.5\n2026-01-02,65.2\n2026-01-03,64.8`;
            const result = WeightCalc.parseWeightCSV(csv);
            expect(result.records.length).toBe(3);
            expect(result.records[0].date).toBe('2026-01-01');
            expect(result.records[0].weight).toBe(65.5);
            expect(result.skipped).toBe(0);
        });

        it('handles UTF-8 BOM and skips invalid ranges/dates', () => {
            const bomCsv =
                '\uFEFFdate\tweight\n2026-05-01\t60.0\ninvalid-date\t60.0\n2026-05-02\t15.0\n2026-05-03\t70.0';
            const result = WeightCalc.parseWeightCSV(bomCsv);
            expect(result.records.length).toBe(2);
            expect(result.skipped).toBe(2);
            expect(result.records[0].weight).toBe(60.0);
            expect(result.records[1].weight).toBe(70.0);
        });
    });
});
