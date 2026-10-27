const { describe, it, expect } = require('../test-utils.js');
const { DATA_VERSION, createEmptyRecord, generateId } = require('../../anime-record/js/models.js');

// 注入测试所需全局上下文
let toastMessage = '';
let toastType = '';
let storedRecords = [];
let downloadedData = null;
let downloadedFilename = '';

global.DATA_VERSION = DATA_VERSION;
global.createEmptyRecord = createEmptyRecord;
global.generateId = generateId;
global.loadRecords = () => [...storedRecords];
global.saveRecords = (recs) => {
    storedRecords = [...recs];
};
global.showToast = (msg, type) => {
    toastMessage = msg;
    toastType = type;
};
globalThis.__mockDownloadJSON = (data, filename) => {
    downloadedData = data;
    downloadedFilename = filename;
};

const importExport = require('../../anime-record/js/import-export.js');

describe('Anime Record: import-export module', () => {
    it('formatDateFilename 应正确将 Date 转为 YYYYMMDD 格式', () => {
        const d = new Date(2026, 9, 27); // 10月27日 (月份从0开始)
        expect(importExport.formatDateFilename(d)).toBe('20261027');
    });

    it('exportTemplate 应生成符合规范的模板对象并触发下载', () => {
        downloadedData = null;
        const res = importExport.exportTemplate();

        expect(res).not.toBeNull();
        expect(downloadedData).not.toBeNull();
        expect(res.version).toBe(DATA_VERSION);
        expect(Array.isArray(res.records)).toBe(true);
        expect(res.records.length).toBeGreaterThan(0);
        expect(downloadedFilename).toBe('anime-record-template.json');
        expect(toastType).toBe('success');
    });

    it('exportData 应打包当前所有记录并生成带日期的备份文件名', () => {
        storedRecords = [
            { id: '1', titleZh: '测试番剧A', status: 'watching' },
            { id: '2', titleZh: '测试番剧B', status: 'watched' }
        ];
        downloadedData = null;

        const res = importExport.exportData();

        expect(res).not.toBeNull();
        expect(res.totalRecords).toBe(2);
        expect(res.records.length).toBe(2);
        expect(res.version).toBe(DATA_VERSION);
        expect(downloadedFilename).toContain('anime-record-backup-');
        expect(toastMessage).toContain('已导出 2 条记录');
    });

    it('handleImportFile 应拦截缺少 records 数组的非法 JSON', async () => {
        const mockFile = {
            text: async () => JSON.stringify({ invalid: true })
        };

        toastMessage = '';
        toastType = '';

        try {
            await importExport.handleImportFile(mockFile);
        } catch (e) {
            expect(e.message).toContain('缺少 records 数组');
        }
    });

    it('handleImportFile 应正确处理空 records 数组', async () => {
        const mockFile = {
            text: async () => JSON.stringify({ records: [] })
        };

        toastMessage = '';
        await importExport.handleImportFile(mockFile);
        expect(toastMessage).toContain('导入文件中没有记录');
    });

    it('handleImportFile 应过滤掉 _description 模板指引并识别有效条目', async () => {
        const mockFile = {
            text: async () =>
                JSON.stringify({
                    records: [
                        { _description: '模板说明' },
                        { _instructions: ['步骤1'] },
                        { titleZh: '' } // 空标题
                    ]
                })
        };

        toastMessage = '';
        await importExport.handleImportFile(mockFile);
        expect(toastMessage).toContain('没有有效的番剧记录');
    });
});
