/**
 * 云端同步模块（GitHub Secret Gist）
 * 实现两台或多台设备间的观看进度安全互通与双向智能合并
 */

const SYNC_KEYS = {
    TOKEN: 'anime-record-sync-token',
    GIST_ID: 'anime-record-sync-gist-id',
    AUTO: 'anime-record-sync-auto',
    LAST_TIME: 'anime-record-sync-last-time'
};

const GIST_DATA_FILENAME = 'anime-record-data.json';

/**
 * 获取同步配置
 * @returns {Object}
 */
function getSyncConfig() {
    try {
        return {
            token: localStorage.getItem(SYNC_KEYS.TOKEN) || '',
            gistId: localStorage.getItem(SYNC_KEYS.GIST_ID) || '',
            autoSync: localStorage.getItem(SYNC_KEYS.AUTO) === 'true',
            lastSyncTime: localStorage.getItem(SYNC_KEYS.LAST_TIME) || ''
        };
    } catch (e) {
        return { token: '', gistId: '', autoSync: false, lastSyncTime: '' };
    }
}

/**
 * 保存同步配置
 * @param {Object} config
 */
function saveSyncConfig(config) {
    try {
        if (config.token !== undefined) localStorage.setItem(SYNC_KEYS.TOKEN, config.token.trim());
        if (config.gistId !== undefined) localStorage.setItem(SYNC_KEYS.GIST_ID, cleanGistId(config.gistId));
        if (config.autoSync !== undefined) localStorage.setItem(SYNC_KEYS.AUTO, config.autoSync ? 'true' : 'false');
        if (config.lastSyncTime !== undefined) localStorage.setItem(SYNC_KEYS.LAST_TIME, config.lastSyncTime);
        return true;
    } catch (e) {
        console.warn('保存同步配置失败:', e);
        return false;
    }
}

/**
 * 提取规范的 Gist ID（支持纯 ID 或完整网页 URL）
 * @param {string} raw
 * @returns {string}
 */
function cleanGistId(raw) {
    if (!raw) return '';
    let val = raw.trim();
    // 匹配如 https://gist.github.com/user/a1b2c3d4... 或 https://gist.github.com/a1b2c3d4...
    const urlMatch = val.match(/gist\.github\.com\/(?:[^/]+\/)?([a-f0-9]+)/i);
    if (urlMatch) {
        return urlMatch[1];
    }
    // 移除两端多余字符与斜杠
    return val.replace(/^\/+|\/+$/g, '');
}

/**
 * 格式化同步时间显示
 * @param {string} isoString
 * @returns {string}
 */
function formatSyncTime(isoString) {
    if (!isoString) return '从未同步';
    try {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return '从未同步';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${day} ${h}:${min}`;
    } catch (e) {
        return '从未同步';
    }
}

/**
 * GitHub API 请求封装
 * @param {string} endpoint
 * @param {string} token
 * @param {Object} options
 * @returns {Promise<any>}
 */
async function requestGitHub(endpoint, token, options = {}) {
    const trimmedToken = (token || '').trim();
    if (!trimmedToken) {
        throw new Error('未提供 GitHub Token');
    }

    const url = endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`;
    const headers = {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${trimmedToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.headers || {})
    };

    const res = await fetch(url, {
        ...options,
        headers
    });

    if (res.status === 401) {
        throw new Error('GitHub Token 无效或已过期，请检查 Token 权限');
    }
    if (res.status === 403) {
        throw new Error('GitHub API 访问被拒绝或达到速率限制，请检查 Token 的 gist 权限');
    }
    if (res.status === 404) {
        throw new Error('未找到指定的云端 Gist，请检查 Gist ID 是否正确');
    }
    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `GitHub 请求失败 (${res.status})`);
    }

    if (res.status === 204) return null;
    return res.json();
}

/**
 * 测试 GitHub Token 有效性
 * @param {string} token
 * @returns {Promise<Object>} 用户信息
 */
async function testGitHubToken(token) {
    const user = await requestGitHub('/user', token);
    return {
        login: user.login,
        name: user.name || user.login
    };
}

/**
 * 创建包含当前数据的私有 Gist
 * @param {string} token
 * @param {Array} records
 * @param {Object} tombstones
 * @returns {Promise<string>} 新创建的 Gist ID
 */
async function createSecretGist(token, records = [], tombstones = {}) {
    const now = new Date().toISOString();
    const payload = {
        description: 'Anime Record 追番记录数据备份与同步',
        public: false,
        files: {
            [GIST_DATA_FILENAME]: {
                content: JSON.stringify({
                    version: typeof DATA_VERSION !== 'undefined' ? DATA_VERSION : 1,
                    updatedAt: now,
                    records: records || [],
                    tombstones: tombstones || {}
                }, null, 2)
            }
        }
    };

    const result = await requestGitHub('/gists', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!result || !result.id) {
        throw new Error('创建 Gist 失败：未返回有效 ID');
    }

    return result.id;
}

/**
 * 从 Gist 拉取数据
 * @param {string} token
 * @param {string} gistId
 * @returns {Promise<Object>} { records, tombstones, updatedAt }
 */
async function fetchRemoteGist(token, gistId) {
    const cleanId = cleanGistId(gistId);
    if (!cleanId) throw new Error('缺少 Gist ID');

    const gist = await requestGitHub(`/gists/${cleanId}`, token);
    if (!gist || !gist.files) {
        throw new Error('Gist 数据格式异常：未包含文件');
    }

    // 优先读取专属文件名，若无则查找任意 .json 文件
    let file = gist.files[GIST_DATA_FILENAME];
    if (!file) {
        const jsonKey = Object.keys(gist.files).find(k => k.endsWith('.json'));
        if (jsonKey) file = gist.files[jsonKey];
    }

    if (!file) {
        return { records: [], tombstones: {}, updatedAt: null };
    }

    let content = file.content;
    // 若文件过大内容被截断，按 raw_url 抓取完整内容
    if (file.truncated && file.raw_url) {
        const rawRes = await fetch(file.raw_url);
        content = await rawRes.text();
    }

    if (!content) {
        return { records: [], tombstones: {}, updatedAt: null };
    }

    try {
        const parsed = JSON.parse(content);
        return {
            records: Array.isArray(parsed.records) ? parsed.records : (Array.isArray(parsed) ? parsed : []),
            tombstones: parsed.tombstones && typeof parsed.tombstones === 'object' ? parsed.tombstones : {},
            updatedAt: parsed.updatedAt || null
        };
    } catch (e) {
        throw new Error('Gist 中的数据不是有效的 JSON 格式');
    }
}

/**
 * 推送最新数据到云端 Gist
 * @param {string} token
 * @param {string} gistId
 * @param {Array} records
 * @param {Object} tombstones
 * @returns {Promise<void>}
 */
async function pushRemoteGist(token, gistId, records = [], tombstones = {}) {
    const cleanId = cleanGistId(gistId);
    if (!cleanId) throw new Error('缺少 Gist ID');

    const now = new Date().toISOString();
    const payload = {
        description: 'Anime Record 追番记录数据备份与同步',
        files: {
            [GIST_DATA_FILENAME]: {
                content: JSON.stringify({
                    version: typeof DATA_VERSION !== 'undefined' ? DATA_VERSION : 1,
                    updatedAt: now,
                    records: records,
                    tombstones: tombstones
                }, null, 2)
            }
        }
    };

    await requestGitHub(`/gists/${cleanId}`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

/**
 * 双向智能合并算法
 * 保护原则：
 * 1. 本地为空时单向拉取，禁止用空白覆盖云端
 * 2. 依据记录的 updatedAt 时间戳合并最新数据
 * 3. 墓碑跟踪，防止已删除番剧在多设备同步时复活
 * 4. 断崖式数据骤减保护
 *
 * @param {Array} localRecords
 * @param {Array} remoteRecords
 * @param {Object} localTombstones
 * @param {Object} remoteTombstones
 * @returns {Object} { mergedRecords, mergedTombstones, hasChanges, stats }
 */
function mergeSyncRecords(localRecords = [], remoteRecords = [], localTombstones = {}, remoteTombstones = {}) {
    const locals = Array.isArray(localRecords) ? localRecords : [];
    const remotes = Array.isArray(remoteRecords) ? remoteRecords : [];

    // 1. 合并墓碑（取较新的删除时间）
    const mergedTombstones = { ...(localTombstones || {}) };
    for (const [id, time] of Object.entries(remoteTombstones || {})) {
        if (!mergedTombstones[id] || new Date(time).getTime() > new Date(mergedTombstones[id]).getTime()) {
            mergedTombstones[id] = time;
        }
    }

    // 辅助：获取记录的唯一键与墓碑删除检查
    function getKey(rec) {
        if (rec && rec.id) return `id:${rec.id}`;
        return `title:${((rec && rec.titleZh) || '').trim().toLowerCase()}`;
    }

    function isRecordDeleted(rec) {
        if (!rec || !rec.id) return false;
        const deletedAt = mergedTombstones[rec.id];
        if (!deletedAt) return false;
        return new Date(rec.updatedAt || rec.createdAt || 0).getTime() <= new Date(deletedAt).getTime();
    }

    // 收集有效的远程记录键集合
    const validRemoteKeys = new Set();
    for (const rem of remotes) {
        const normRem = typeof normalizeRecord === 'function' ? normalizeRecord(rem) : rem;
        if (!isRecordDeleted(normRem)) {
            validRemoteKeys.add(getKey(normRem));
        }
    }

    const map = new Map();
    let pulledCount = 0;
    let pushedCount = 0;

    // 2. 填入本地记录
    for (const loc of locals) {
        const norm = typeof normalizeRecord === 'function' ? normalizeRecord(loc) : loc;
        if (isRecordDeleted(norm)) {
            continue; // 已被墓碑标记删除
        }
        const key = getKey(norm);
        map.set(key, norm);

        // 如果云端不存在此记录，说明本地有新增，需要推向云端
        if (!validRemoteKeys.has(key)) {
            pushedCount++;
        }
    }

    // 3. 对比合并远程记录
    for (const rem of remotes) {
        const normRem = typeof normalizeRecord === 'function' ? normalizeRecord(rem) : rem;
        if (isRecordDeleted(normRem)) {
            continue; // 已被墓碑标记删除
        }

        const key = getKey(normRem);

        if (!map.has(key)) {
            // 本地没有，云端有 -> 采纳云端
            map.set(key, normRem);
            pulledCount++;
        } else {
            // 本地和云端都有 -> 比较修改时间戳
            const loc = map.get(key);
            const locTime = new Date(loc.updatedAt || loc.createdAt || 0).getTime();
            const remTime = new Date(normRem.updatedAt || normRem.createdAt || 0).getTime();

            if (remTime > locTime) {
                // 云端较新 -> 采纳云端
                map.set(key, normRem);
                pulledCount++;
            } else if (locTime > remTime) {
                // 本地较新 -> 保留本地，标记需推送到云端
                pushedCount++;
            } else {
                // 时间戳相同，优先保留已看集数较大或数据更完整者
                if ((normRem.episodesWatched || 0) > (loc.episodesWatched || 0)) {
                    map.set(key, normRem);
                }
            }
        }
    }

    const mergedRecords = Array.from(map.values());

    // 4. 断崖骤减保护（第 3 防线：当云端已有较多记录，合并后大幅减少时告警）
    if (remotes.length >= 5 && mergedRecords.length < remotes.length * 0.4) {
        throw new Error(`数据安全防护触发：云端原有 ${remotes.length} 部番剧，合并后仅剩 ${mergedRecords.length} 部。为防止数据异常丢失已终止同步。`);
    }

    return {
        mergedRecords,
        mergedTombstones,
        hasChanges: pulledCount > 0 || pushedCount > 0,
        stats: { pulled: pulledCount, pushed: pushedCount }
    };
}

// 同步互斥锁
let isSyncing = false;

/**
 * 执行完整同步流程
 * @param {Object} options { silent: boolean }
 * @returns {Promise<boolean>}
 */
async function performSync(options = {}) {
    const { silent = false } = options;

    if (isSyncing) {
        if (!silent && typeof showToast === 'function') {
            showToast('同步正在进行中，请稍候...', 'info');
        }
        return false;
    }

    const config = getSyncConfig();
    if (!config.token || !config.gistId) {
        if (!silent) {
            if (typeof showToast === 'function') {
                showToast('请先配置 GitHub Token 与 Gist ID', 'info');
            }
            if (typeof openSettingsModal === 'function') {
                openSettingsModal();
                setTimeout(() => {
                    const tokenInput = document.getElementById('sync-token');
                    if (tokenInput) tokenInput.focus();
                }, 200);
            }
        }
        return false;
    }

    try {
        isSyncing = true;
        setSyncingUIState(true);

        const localRecords = typeof loadRecords === 'function' ? loadRecords() : [];
        const localTombstones = typeof getTombstones === 'function' ? getTombstones() : {};

        // 1. 拉取云端
        const remoteData = await fetchRemoteGist(config.token, config.gistId);

        // 2. 双向智能合并
        const result = mergeSyncRecords(
            localRecords,
            remoteData.records,
            localTombstones,
            remoteData.tombstones
        );

        // 3. 保存至本地
        if (typeof saveRecords === 'function') {
            saveRecords(result.mergedRecords);
        }
        if (typeof saveTombstones === 'function') {
            saveTombstones(result.mergedTombstones);
        }

        // 4. 回写至云端 Gist
        await pushRemoteGist(
            config.token,
            config.gistId,
            result.mergedRecords,
            result.mergedTombstones
        );

        // 5. 更新同步时间
        const now = new Date().toISOString();
        localStorage.setItem(SYNC_KEYS.LAST_TIME, now);
        updateSyncTimeUI(now);

        // 6. 刷新界面
        if (typeof refreshCards === 'function') {
            refreshCards();
        }

        if (!silent && typeof showToast === 'function') {
            const count = result.mergedRecords.length;
            showToast(`同步成功！共 ${count} 部番剧已与云端同步`, 'success');
        }
        return true;
    } catch (err) {
        console.error('同步异常:', err);
        if (!silent && typeof showToast === 'function') {
            showToast(`同步失败：${err.message}`, 'error');
        }
        return false;
    } finally {
        isSyncing = false;
        setSyncingUIState(false);
    }
}

/**
 * 切换同步中界面的 Loading 状态
 * @param {boolean} busy
 */
function setSyncingUIState(busy) {
    // 顶部同步按钮
    const headerSyncBtn = document.getElementById('btn-sync');
    if (headerSyncBtn) {
        const icon = headerSyncBtn.querySelector('.btn-icon');
        if (icon) icon.classList.toggle('spinning', busy);
        headerSyncBtn.disabled = busy;
    }

    // 设置弹窗内同步按钮
    const settingsSyncBtn = document.getElementById('btn-sync-now');
    if (settingsSyncBtn) {
        const icon = settingsSyncBtn.querySelector('.btn-icon');
        if (icon) icon.classList.toggle('spinning', busy);
        settingsSyncBtn.disabled = busy;
    }

    // 状态徽标
    const badge = document.getElementById('sync-status-badge');
    if (badge) {
        if (busy) {
            badge.textContent = '同步中...';
            badge.className = 'sync-status-badge syncing';
        } else {
            updateSyncStatusBadge();
        }
    }
}

/**
 * 更新上次同步时间文案
 * @param {string} isoString
 */
function updateSyncTimeUI(isoString) {
    const timeVal = document.getElementById('sync-last-time-val');
    if (timeVal) {
        timeVal.textContent = formatSyncTime(isoString);
    }
}

/**
 * 更新状态徽标（未配置 / 已就绪）
 */
function updateSyncStatusBadge() {
    const badge = document.getElementById('sync-status-badge');
    if (!badge) return;

    const config = getSyncConfig();
    if (config.token && config.gistId) {
        badge.textContent = '已连接';
        badge.className = 'sync-status-badge connected';
    } else {
        badge.textContent = '未配置';
        badge.className = 'sync-status-badge';
    }
}

/**
 * 同步弹窗内的表单项与本地存储
 */
function updateSyncFormFields() {
    const config = getSyncConfig();

    const tokenInput = document.getElementById('sync-token');
    const gistInput = document.getElementById('sync-gist-id');
    const autoCheckbox = document.getElementById('sync-auto-checkbox');

    if (tokenInput) tokenInput.value = config.token;
    if (gistInput) gistInput.value = config.gistId;
    if (autoCheckbox) autoCheckbox.checked = config.autoSync;

    updateSyncTimeUI(config.lastSyncTime);
    updateSyncStatusBadge();
}

/**
 * 初始化云同步模块事件与 UI
 */
function initSyncModule() {
    // 顶部同步按钮点击
    const headerSyncBtn = document.getElementById('btn-sync');
    if (headerSyncBtn) {
        headerSyncBtn.addEventListener('click', () => {
            performSync({ silent: false });
        });
    }

    // 设置弹窗内：切换 Token 显隐
    const toggleTokenBtn = document.getElementById('btn-toggle-token-visible');
    const tokenInput = document.getElementById('sync-token');
    if (toggleTokenBtn && tokenInput) {
        toggleTokenBtn.addEventListener('click', () => {
            const isPassword = tokenInput.type === 'password';
            tokenInput.type = isPassword ? 'text' : 'password';
            const iconEye = toggleTokenBtn.querySelector('.icon-eye');
            const iconEyeOff = toggleTokenBtn.querySelector('.icon-eye-off');
            if (iconEye && iconEyeOff) {
                iconEye.classList.toggle('hidden', isPassword);
                iconEyeOff.classList.toggle('hidden', !isPassword);
            }
        });
    }

    // 设置弹窗内：自动新建 Gist
    const createGistBtn = document.getElementById('btn-create-gist');
    if (createGistBtn) {
        createGistBtn.addEventListener('click', async () => {
            const token = (document.getElementById('sync-token')?.value || '').trim();
            if (!token) {
                if (typeof showToast === 'function') showToast('请先填写 GitHub Token', 'error');
                tokenInput?.focus();
                return;
            }

            try {
                createGistBtn.disabled = true;
                createGistBtn.textContent = '创建中...';

                const records = typeof loadRecords === 'function' ? loadRecords() : [];
                const tombstones = typeof getTombstones === 'function' ? getTombstones() : {};
                const gistId = await createSecretGist(token, records, tombstones);

                const gistInput = document.getElementById('sync-gist-id');
                if (gistInput) gistInput.value = gistId;

                // 立即持久化配置
                saveSyncConfig({
                    token,
                    gistId,
                    autoSync: document.getElementById('sync-auto-checkbox')?.checked ?? false,
                    lastSyncTime: new Date().toISOString()
                });

                updateSyncTimeUI(new Date().toISOString());
                updateSyncStatusBadge();

                if (typeof showToast === 'function') {
                    showToast('已成功在 GitHub 创建私有 Gist 并完成绑定！', 'success');
                }
            } catch (err) {
                console.error('新建 Gist 失败:', err);
                if (typeof showToast === 'function') {
                    showToast(`创建 Gist 失败：${err.message}`, 'error');
                }
            } finally {
                createGistBtn.disabled = false;
                createGistBtn.textContent = '自动新建 Gist';
            }
        });
    }

    // 设置弹窗内：测试连接
    const testSyncBtn = document.getElementById('btn-test-sync');
    if (testSyncBtn) {
        testSyncBtn.addEventListener('click', async () => {
            const token = (document.getElementById('sync-token')?.value || '').trim();
            const gistId = cleanGistId(document.getElementById('sync-gist-id')?.value || '');

            if (!token) {
                if (typeof showToast === 'function') showToast('请先输入 GitHub Token', 'info');
                tokenInput?.focus();
                return;
            }

            try {
                testSyncBtn.disabled = true;
                testSyncBtn.textContent = '测试中...';

                const user = await testGitHubToken(token);

                let gistMsg = '';
                if (gistId) {
                    const data = await fetchRemoteGist(token, gistId);
                    gistMsg = `，Gist 数据正常（云端含 ${data.records.length} 条记录）`;
                }

                if (typeof showToast === 'function') {
                    showToast(`连接成功！GitHub 账号：${user.login}${gistMsg}`, 'success');
                }
            } catch (err) {
                if (typeof showToast === 'function') {
                    showToast(`测试失败：${err.message}`, 'error');
                }
            } finally {
                testSyncBtn.disabled = false;
                testSyncBtn.textContent = '测试连接';
            }
        });
    }

    // 设置弹窗内：保存配置
    const saveConfigBtn = document.getElementById('btn-save-sync-config');
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', () => {
            const token = (document.getElementById('sync-token')?.value || '').trim();
            const gistId = cleanGistId(document.getElementById('sync-gist-id')?.value || '');
            const autoSync = document.getElementById('sync-auto-checkbox')?.checked ?? false;

            saveSyncConfig({ token, gistId, autoSync });
            updateSyncStatusBadge();

            if (typeof showToast === 'function') {
                showToast('云同步配置已保存', 'success');
            }
        });
    }

    // 设置弹窗内：立即同步按钮
    const syncNowBtn = document.getElementById('btn-sync-now');
    if (syncNowBtn) {
        syncNowBtn.addEventListener('click', () => {
            // 先同步保存输入框的值
            const token = (document.getElementById('sync-token')?.value || '').trim();
            const gistId = cleanGistId(document.getElementById('sync-gist-id')?.value || '');
            const autoSync = document.getElementById('sync-auto-checkbox')?.checked ?? false;
            saveSyncConfig({ token, gistId, autoSync });

            performSync({ silent: false });
        });
    }

    // 初始化表单展示
    updateSyncFormFields();

    // 自动同步（若已开启且配置齐全）
    const cfg = getSyncConfig();
    if (cfg.autoSync && cfg.token && cfg.gistId) {
        // 延时在后台静默发起同步
        setTimeout(() => {
            performSync({ silent: true });
        }, 1200);
    }
}

// 统一对外导出服务对象
const SyncService = {
    getConfig: getSyncConfig,
    saveConfig: saveSyncConfig,
    cleanGistId,
    formatTime: formatSyncTime,
    testToken: testGitHubToken,
    createGist: createSecretGist,
    fetchGist: fetchRemoteGist,
    pushGist: pushRemoteGist,
    mergeRecords: mergeSyncRecords,
    performSync,
    init: initSyncModule,
    updateUI: updateSyncFormFields
};

if (typeof window !== 'undefined') {
    window.SyncService = SyncService;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SYNC_KEYS,
        GIST_DATA_FILENAME,
        cleanGistId,
        formatSyncTime,
        mergeSyncRecords,
        SyncService
    };
}
