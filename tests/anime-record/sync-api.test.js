const { describe, it, expect, afterEach } = require('../test-utils.js');
const { requestGitHub, SyncService, GIST_DATA_FILENAME } = require('../../anime-record/js/sync.js');

describe('Anime Record Sync API Module (Mocked)', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
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
});
