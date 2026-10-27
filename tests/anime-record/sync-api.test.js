const { describe, it, expect, beforeEach, afterEach } = require('../test-utils.js');
const { requestGitHub, SyncService, GIST_DATA_FILENAME } = require('../../anime-record/js/sync.js');

describe('Anime Record Sync API Module (Mocked)', () => {
    const originalFetch = globalThis.fetch;
    let storageMap = {};

    beforeEach(() => {
        storageMap = {};
        global.localStorage = {
            getItem: (k) => storageMap[k] || null,
            setItem: (k, v) => {
                storageMap[k] = String(v);
            },
            removeItem: (k) => {
                delete storageMap[k];
            },
            clear: () => {
                storageMap = {};
            }
        };
        global.sessionStorage = {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
            clear: () => {}
        };
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        delete global.localStorage;
        delete global.sessionStorage;
    });

    describe('maskToken 安全脱敏', () => {
        it('正确掩码长 Token 并保留首尾4位', () => {
            const token = 'ghp_1234567890abcdef';
            expect(SyncService.maskToken(token)).toBe('ghp_****cdef');
        });

        it('短 Token 或空 Token 安全回退', () => {
            expect(SyncService.maskToken('')).toBe('');
            expect(SyncService.maskToken(null)).toBe('');
            expect(SyncService.maskToken('short')).toBe('****');
        });
    });

    describe('requestGitHub', () => {
        it('throws immediately if token is empty', async () => {
            let error = null;
            try {
                await requestGitHub('/user', '');
            } catch (err) {
                error = err;
            }
            expect(error).not.toBeNull();
            expect(error.message).toContain('未提供 GitHub Token');
        });

        it('sends correct headers and returns json on 200', async () => {
            let capturedUrl = '';
            let capturedHeaders = {};

            globalThis.fetch = async (url, options) => {
                capturedUrl = url;
                capturedHeaders = options.headers;
                return {
                    status: 200,
                    ok: true,
                    json: async () => ({ login: 'octocat', id: 1 })
                };
            };

            const data = await requestGitHub('/user', 'test-token-123');
            expect(capturedUrl).toBe('https://api.github.com/user');
            expect(capturedHeaders['Authorization']).toBe('Bearer test-token-123');
            expect(capturedHeaders['X-GitHub-Api-Version']).toBe('2022-11-28');
            expect(data.login).toBe('octocat');
        });

        it('returns null on 204 No Content', async () => {
            globalThis.fetch = async () => ({
                status: 204,
                ok: true
            });
            const res = await requestGitHub('/gists/123', 'tok');
            expect(res).toBeNull();
        });

        it('throws descriptive error on 401 Unauthorized', async () => {
            globalThis.fetch = async () => ({
                status: 401,
                ok: false
            });
            let err = null;
            try {
                await requestGitHub('/user', 'invalid-token');
            } catch (e) {
                err = e;
            }
            expect(err).not.toBeNull();
            expect(err.message).toContain('Token 无效或已过期');
        });

        it('throws descriptive error on 403 Forbidden / Rate limit', async () => {
            globalThis.fetch = async () => ({
                status: 403,
                ok: false
            });
            let err = null;
            try {
                await requestGitHub('/user', 'tok');
            } catch (e) {
                err = e;
            }
            expect(err).not.toBeNull();
            expect(err.message).toContain('访问被拒绝或达到速率限制');
        });

        it('throws descriptive error on 404 Not Found', async () => {
            globalThis.fetch = async () => ({
                status: 404,
                ok: false
            });
            let err = null;
            try {
                await requestGitHub('/gists/missing-id', 'tok');
            } catch (e) {
                err = e;
            }
            expect(err).not.toBeNull();
            expect(err.message).toContain('未找到指定的云端 Gist');
        });

        it('handles abort timeout gracefully', async () => {
            globalThis.fetch = async () => {
                const err = new Error('The operation was aborted');
                err.name = 'AbortError';
                throw err;
            };
            let err = null;
            try {
                await requestGitHub('/user', 'tok', { timeoutMs: 50 });
            } catch (e) {
                err = e;
            }
            expect(err).not.toBeNull();
            expect(err.message).toContain('请求超时');
        });
    });

    describe('testGitHubToken', () => {
        it('returns user profile info', async () => {
            globalThis.fetch = async () => ({
                status: 200,
                ok: true,
                json: async () => ({ login: 'alice', name: 'Alice Wonderland' })
            });

            const res = await SyncService.testToken('tok');
            expect(res.login).toBe('alice');
            expect(res.name).toBe('Alice Wonderland');
        });
    });

    describe('createSecretGist & fetchRemoteGist & pushRemoteGist', () => {
        it('creates secret gist with proper structure', async () => {
            let capturedBody = null;
            globalThis.fetch = async (url, options) => {
                capturedBody = JSON.parse(options.body);
                return {
                    status: 200,
                    ok: true,
                    json: async () => ({ id: 'new-gist-id-456' })
                };
            };

            const records = [{ id: 'a1', title: '番剧1' }];
            const gistId = await SyncService.createGist('tok', records, {});
            expect(gistId).toBe('new-gist-id-456');
            expect(capturedBody.public).toBe(false);
            expect(capturedBody.files[GIST_DATA_FILENAME]).toBeDefined();
        });

        it('fetches remote gist data accurately', async () => {
            const remoteContent = JSON.stringify({
                version: 1,
                updatedAt: '2026-10-20T10:00:00Z',
                records: [{ id: 'r1', title: '轻音少女' }],
                tombstones: { r0: 1700000000000 }
            });

            globalThis.fetch = async () => ({
                status: 200,
                ok: true,
                json: async () => ({
                    id: 'gist123',
                    files: {
                        [GIST_DATA_FILENAME]: {
                            content: remoteContent
                        }
                    }
                })
            });

            const remote = await SyncService.fetchGist('tok', 'gist123');
            expect(remote.records.length).toBe(1);
            expect(remote.records[0].title).toBe('轻音少女');
            expect(remote.tombstones['r0']).toBe(1700000000000);
        });

        it('pushes updated data to gist', async () => {
            let capturedPatch = null;
            globalThis.fetch = async (url, options) => {
                if (options.method === 'PATCH') {
                    capturedPatch = JSON.parse(options.body);
                }
                return {
                    status: 200,
                    ok: true,
                    json: async () => ({ id: 'gist123' })
                };
            };

            await SyncService.pushGist('tok', 'gist123', [{ id: '1' }], {});
            expect(capturedPatch).not.toBeNull();
            expect(capturedPatch.files[GIST_DATA_FILENAME]).toBeDefined();
        });
    });

    describe('performSync 流程控制', () => {
        it('未配置 Token 或 Gist ID 时静默返回 false', async () => {
            SyncService.saveConfig({ token: '', gistId: '' });
            const success = await SyncService.performSync({ silent: true });
            expect(success).toBe(false);
        });

        it('配置有效且网络成功时执行完整同步流程', async () => {
            SyncService.saveConfig({ token: 'mock-token', gistId: 'mock-gist-id' });

            const remoteContent = JSON.stringify({
                version: 1,
                records: [{ id: 'rem-1', titleZh: '云端番剧', updatedAt: '2026-10-20T10:00:00Z' }],
                tombstones: {}
            });

            globalThis.fetch = async (url, options) => {
                if (options && options.method === 'PATCH') {
                    return {
                        status: 200,
                        ok: true,
                        json: async () => ({ id: 'mock-gist-id' })
                    };
                }
                return {
                    status: 200,
                    ok: true,
                    json: async () => ({
                        id: 'mock-gist-id',
                        files: {
                            [GIST_DATA_FILENAME]: { content: remoteContent }
                        }
                    })
                };
            };

            const success = await SyncService.performSync({ silent: true });
            expect(success).toBe(true);
        });
    });

    describe('Sync UI 与交互逻辑', () => {
        let mockElements;
        const origDocument = global.document;

        function makeElement(id, initialProps = {}) {
            const classList = new Set();
            const listeners = {};
            return {
                id,
                value: initialProps.value || '',
                type: initialProps.type || 'text',
                checked: initialProps.checked || false,
                textContent: '',
                className: '',
                classList: {
                    add: (c) => classList.add(c),
                    remove: (c) => classList.delete(c),
                    contains: (c) => classList.has(c),
                    toggle: (c, val) => (val ? classList.add(c) : classList.delete(c))
                },
                addEventListener: (event, cb) => {
                    listeners[event] = listeners[event] || [];
                    listeners[event].push(cb);
                },
                click: async () => {
                    if (listeners.click) {
                        for (const cb of listeners.click) await cb();
                    }
                },
                querySelector: () => makeElement('mock-child'),
                focus: () => {}
            };
        }

        beforeEach(() => {
            mockElements = {
                'btn-sync': makeElement('btn-sync'),
                'btn-sync-now': makeElement('btn-sync-now'),
                'btn-toggle-token-visible': makeElement('btn-toggle-token-visible'),
                'btn-create-gist': makeElement('btn-create-gist'),
                'btn-test-sync': makeElement('btn-test-sync'),
                'btn-save-sync-config': makeElement('btn-save-sync-config'),
                'sync-token': makeElement('sync-token', { type: 'password', value: 'ghp_test' }),
                'sync-gist-id': makeElement('sync-gist-id', { value: 'gist-123' }),
                'sync-auto-checkbox': makeElement('sync-auto-checkbox', { checked: false }),
                'sync-session-checkbox': makeElement('sync-session-checkbox', { checked: false }),
                'sync-last-time-val': makeElement('sync-last-time-val'),
                'sync-status-badge': makeElement('sync-status-badge')
            };

            global.document = {
                getElementById: (id) => mockElements[id] || null
            };
        });

        afterEach(() => {
            global.document = origDocument;
        });

        it('updateUI 更新表单展示与状态徽标', () => {
            SyncService.saveConfig({ token: 'tok-abc', gistId: 'gist-abc', autoSync: true });
            SyncService.updateUI();
            expect(mockElements['sync-token'].value).toBe('tok-abc');
            expect(mockElements['sync-gist-id'].value).toBe('gist-abc');
            expect(mockElements['sync-status-badge'].textContent).toBe('已连接');
        });

        it('init 绑定各个交互按钮并正确触发', async () => {
            SyncService.init();

            // 1. 切换 Token 可见性
            await mockElements['btn-toggle-token-visible'].click();
            expect(mockElements['sync-token'].type).toBe('text');
            await mockElements['btn-toggle-token-visible'].click();
            expect(mockElements['sync-token'].type).toBe('password');

            // 2. 保存配置按钮
            mockElements['sync-token'].value = 'saved-tok';
            mockElements['sync-gist-id'].value = 'saved-gist';
            await mockElements['btn-save-sync-config'].click();
            const cfg = SyncService.getConfig();
            expect(cfg.token).toBe('saved-tok');

            // 3. 测试连接按钮
            globalThis.fetch = async () => ({
                status: 200,
                ok: true,
                json: async () => ({ login: 'octocat' })
            });
            await mockElements['btn-test-sync'].click();
            expect(mockElements['btn-test-sync'].textContent).toBe('测试连接');
        });

        it('performSync 在非静默模式下遇错捕获并友好提示', async () => {
            SyncService.saveConfig({ token: 'valid-tok', gistId: 'gist-id' });
            globalThis.fetch = async () => {
                throw new Error('Network error');
            };
            const res = await SyncService.performSync({ silent: false });
            expect(res).toBe(false);
        });
    });
});
