const { describe, it, expect, beforeEach, afterEach } = require('../test-utils.js');
const { cleanGistId, formatSyncTime, mergeSyncRecords } = require('../../anime-record/js/sync.js');

describe('Anime Record Sync Module', () => {
    describe('cleanGistId', () => {
        it('should extract id from raw id string', () => {
            expect(cleanGistId('a1b2c3d4e5f67890abcdef1234567890')).toBe('a1b2c3d4e5f67890abcdef1234567890');
        });

        it('should extract id from full gist url with username', () => {
            const url = 'https://gist.github.com/Aclguh/a1b2c3d4e5f67890abcdef1234567890';
            expect(cleanGistId(url)).toBe('a1b2c3d4e5f67890abcdef1234567890');
        });

        it('should extract id from full gist url without username and with trailing slash', () => {
            const url = 'https://gist.github.com/a1b2c3d4e5f67890abcdef1234567890/';
            expect(cleanGistId(url)).toBe('a1b2c3d4e5f67890abcdef1234567890');
        });

        it('should handle empty or whitespace string', () => {
            expect(cleanGistId('')).toBe('');
            expect(cleanGistId('   ')).toBe('');
        });
    });

    describe('formatSyncTime', () => {
        it('should return 从未同步 for empty or null', () => {
            expect(formatSyncTime('')).toBe('从未同步');
            expect(formatSyncTime(null)).toBe('从未同步');
        });

        it('should format valid ISO string properly', () => {
            const time = new Date('2026-10-06T11:30:00Z').toISOString();
            const formatted = formatSyncTime(time);
            expect(formatted).toContain('2026-');
        });
    });

    describe('mergeSyncRecords', () => {
        it('第1防线：本地为空而云端有数据时，必须完全采纳云端，禁止用空白覆盖云端', () => {
            const local = [];
            const remote = [
                { id: '1', titleZh: '葬送的芙莉莲', episodesWatched: 12, updatedAt: '2026-10-06T10:00:00Z' },
                { id: '2', titleZh: '迷宫饭', episodesWatched: 24, updatedAt: '2026-10-06T10:00:00Z' }
            ];

            const result = mergeSyncRecords(local, remote);
            expect(result.mergedRecords.length).toBe(2);
            expect(result.mergedRecords[0].titleZh).toBe('葬送的芙莉莲');
            expect(result.mergedRecords[1].titleZh).toBe('迷宫饭');
            expect(result.stats.pulled).toBe(2);
            expect(result.stats.pushed).toBe(0);
        });

        it('本地有数据而云端为空时（初始推送），保留本地数据', () => {
            const local = [{ id: '1', titleZh: '鬼灭之刃', episodesWatched: 5, updatedAt: '2026-10-06T10:00:00Z' }];
            const remote = [];

            const result = mergeSyncRecords(local, remote);
            expect(result.mergedRecords.length).toBe(1);
            expect(result.mergedRecords[0].titleZh).toBe('鬼灭之刃');
            expect(result.stats.pushed).toBe(1);
            expect(result.stats.pulled).toBe(0);
        });

        it('多设备冲突时，以更新时间戳（updatedAt）较晚的为准', () => {
            // 设备 A (本地) 上看完了第 8 集，时间为 10:00
            const local = [{ id: '1', titleZh: '葬送的芙莉莲', episodesWatched: 8, updatedAt: '2026-10-06T10:00:00Z' }];
            // 设备 B (云端) 上看完了第 12 集，时间为 12:00
            const remote = [
                { id: '1', titleZh: '葬送的芙莉莲', episodesWatched: 12, updatedAt: '2026-10-06T12:00:00Z' }
            ];

            const result = mergeSyncRecords(local, remote);
            expect(result.mergedRecords.length).toBe(1);
            expect(result.mergedRecords[0].episodesWatched).toBe(12);
            expect(result.stats.pulled).toBe(1);
        });

        it('本地时间戳更新时，保留本地记录并标记需推送到云端', () => {
            const local = [
                { id: '1', titleZh: '葬送的芙莉莲', episodesWatched: 15, updatedAt: '2026-10-06T15:00:00Z' }
            ];
            const remote = [
                { id: '1', titleZh: '葬送的芙莉莲', episodesWatched: 12, updatedAt: '2026-10-06T12:00:00Z' }
            ];

            const result = mergeSyncRecords(local, remote);
            expect(result.mergedRecords.length).toBe(1);
            expect(result.mergedRecords[0].episodesWatched).toBe(15);
            expect(result.stats.pushed).toBe(1);
        });

        it('双向并集：合并各自新增的不同番剧', () => {
            const local = [{ id: '1', titleZh: '番剧A', episodesWatched: 1, updatedAt: '2026-10-06T10:00:00Z' }];
            const remote = [{ id: '2', titleZh: '番剧B', episodesWatched: 2, updatedAt: '2026-10-06T10:00:00Z' }];

            const result = mergeSyncRecords(local, remote);
            expect(result.mergedRecords.length).toBe(2);
            const titles = result.mergedRecords.map((r) => r.titleZh);
            expect(titles).toContain('番剧A');
            expect(titles).toContain('番剧B');
        });

        it('墓碑机制：被删除的番剧不会因为另一设备存在而被复活', () => {
            // 设备 A 删除了番剧 1（产生墓碑，时间 11:00）
            const localTombstones = { 1: '2026-10-06T11:00:00Z' };
            const local = [];
            // 设备 B 未同步，仍保留番剧 1（更新时间 10:00）
            const remote = [
                { id: '1', titleZh: '已删番剧', episodesWatched: 3, updatedAt: '2026-10-06T10:00:00Z' },
                { id: '2', titleZh: '保留番剧', episodesWatched: 5, updatedAt: '2026-10-06T10:00:00Z' }
            ];

            const result = mergeSyncRecords(local, remote, localTombstones, {});
            expect(result.mergedRecords.length).toBe(1);
            expect(result.mergedRecords[0].titleZh).toBe('保留番剧');
        });

        it('墓碑清除：如果在删除后又重新更新或重新添加，则应保留最新记录', () => {
            const localTombstones = { 1: '2026-10-06T10:00:00Z' };
            const local = [];
            // 在 12:00 重新编辑或更新了该番剧
            const remote = [{ id: '1', titleZh: '重新追番', episodesWatched: 1, updatedAt: '2026-10-06T12:00:00Z' }];

            const result = mergeSyncRecords(local, remote, localTombstones, {});
            expect(result.mergedRecords.length).toBe(1);
            expect(result.mergedRecords[0].titleZh).toBe('重新追番');
        });

        it('断崖跌落保护：当云端有多部番剧且合并后出现大幅锐减时，应中断抛出异常', () => {
            const local = [{ id: '1', titleZh: '独苗番剧', episodesWatched: 1, updatedAt: '2026-10-06T12:00:00Z' }];
            // 云端有 10 部番剧
            const remote = [];
            const tombstones = {};
            for (let i = 1; i <= 10; i++) {
                remote.push({
                    id: String(i),
                    titleZh: `番剧${i}`,
                    episodesWatched: i,
                    updatedAt: '2026-10-06T09:00:00Z'
                });
                // 模拟极端错误批量墓碑删除了其中大部分
                if (i > 1) {
                    tombstones[String(i)] = '2026-10-06T11:00:00Z';
                }
            }

            expect(() => {
                mergeSyncRecords(local, remote, tombstones, {});
            }).toThrow();
        });
    });

    describe('SyncService 配置持久化与会话隔离', () => {
        let storageMap = {};
        let sessionMap = {};

        beforeEach(() => {
            storageMap = {};
            sessionMap = {};
            global.localStorage = {
                getItem: (k) => (k in storageMap ? storageMap[k] : null),
                setItem: (k, v) => {
                    storageMap[k] = String(v);
                },
                removeItem: (k) => {
                    delete storageMap[k];
                }
            };
            global.sessionStorage = {
                getItem: (k) => (k in sessionMap ? sessionMap[k] : null),
                setItem: (k, v) => {
                    sessionMap[k] = String(v);
                },
                removeItem: (k) => {
                    delete sessionMap[k];
                }
            };
        });

        afterEach(() => {
            delete global.localStorage;
            delete global.sessionStorage;
        });

        it('普通模式下 Token 保存至 localStorage', () => {
            const { SyncService, SYNC_KEYS } = require('../../anime-record/js/sync.js');
            SyncService.saveConfig({
                token: 'ghp_test123',
                gistId: 'gist_abc',
                autoSync: true,
                sessionOnly: false
            });

            const cfg = SyncService.getConfig();
            expect(cfg.token).toBe('ghp_test123');
            expect(cfg.gistId).toBe('gist_abc');
            expect(cfg.autoSync).toBe(true);
            expect(cfg.sessionOnly).toBe(false);
            expect(storageMap[SYNC_KEYS.TOKEN]).toBe('ghp_test123');
        });

        it('sessionOnly 为 true 时，Token 仅存保存在 sessionStorage 并清除 localStorage', () => {
            const { SyncService, SYNC_KEYS } = require('../../anime-record/js/sync.js');
            SyncService.saveConfig({
                token: 'ghp_secret_session',
                gistId: 'gist_xyz',
                sessionOnly: true
            });

            const cfg = SyncService.getConfig();
            expect(cfg.token).toBe('ghp_secret_session');
            expect(sessionMap[SYNC_KEYS.SESSION_TOKEN]).toBe('ghp_secret_session');
            expect(storageMap[SYNC_KEYS.TOKEN]).toBe(undefined);
        });
    });
});
