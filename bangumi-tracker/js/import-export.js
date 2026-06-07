/**
 * 导入导出模块
 * 负责数据的导入、导出及模板下载
 */

/**
 * 导出数据为 JSON 文件
 */
function exportData() {
    const records = loadRecords();

    const exportObj = {
        version: DATA_VERSION,
        exportedAt: new Date().toISOString(),
        totalRecords: records.length,
        records: records
    };

    downloadJSON(exportObj, `bangumi-backup-${formatDateFilename(new Date())}.json`);
    showToast(`已导出 ${records.length} 条记录`, 'success');
}

/**
 * 导出空白导入模板
 */
function exportTemplate() {
    const templateRecord = {
        titleZh: '示例：葬送的芙莉莲',
        titleJa: '葬送のフリーレン',
        coverUrl: 'https://example.com/cover.jpg',
        status: 'watching',
        rating: 8,
        episodesWatched: 12,
        episodesTotal: 28,
        tags: ['奇幻', '冒险'],
        notes: '这是一部很好看的番，推荐给所有人。',
        startDate: '2023-09-29',
        endDate: '',
        year: 2023,
        season: 'fall'
    };

    const template = {
        _description: 'Bangumi Tracker 导入模板',
        _instructions: [
            '1. 每条记录只需填写必要字段（titleZh 为必填）',
            '2. 未知字段可以留空或删除',
            '3. status 可选值: want_to_watch | watching | watched | on_hold | dropped',
            '4. season 可选值: winter | spring | summer | fall（也可留空）',
            '5. rating 范围 1-10，0 表示未评分',
            '6. tags 为字符串数组，可自定义',
            '7. 导入时会自动生成 id、createdAt、updatedAt 字段',
            '8. 删除此模板中的 _description 和 _instructions 字段后即可导入'
        ],
        version: DATA_VERSION,
        records: [
            templateRecord,
            {
                titleZh: '示例：鬼灭之刃 柱训练篇',
                titleJa: '鬼滅の刃 柱稽古編',
                coverUrl: '',
                status: 'want_to_watch',
                rating: 0,
                episodesWatched: 0,
                episodesTotal: 8,
                tags: ['战斗', '热血'],
                notes: '',
                startDate: '',
                endDate: '',
                year: 2024,
                season: 'spring'
            }
        ]
    };

    downloadJSON(template, `bangumi-template.json`);
    showToast('导入模板已下载', 'success');
}

/**
 * 触发导入文件选择
 */
function triggerImport() {
    document.getElementById('import-file-input').click();
}

/**
 * 处理导入文件
 * @param {File} file
 */
async function handleImportFile(file) {
    try {
        const text = await file.text();
        const data = JSON.parse(text);

        // 验证格式
        if (!data.records || !Array.isArray(data.records)) {
            throw new Error('无效的导入文件格式：缺少 records 数组');
        }

        if (data.records.length === 0) {
            showToast('导入文件中没有记录', 'info');
            return;
        }

        // 过滤掉模板说明条目（包含 _description 的条目不导入）
        const validRecords = data.records.filter(r => {
            // 跳过纯说明条目
            if (r._description || r._instructions) return false;
            // 确保至少有标题
            return r.titleZh && r.titleZh.trim();
        });

        if (validRecords.length === 0) {
            showToast('导入文件中没有有效的番剧记录', 'info');
            return;
        }

        // 询问导入方式
        const existingRecords = loadRecords();
        let importMode = 'merge';

        if (existingRecords.length > 0) {
            const choice = await showImportChoice(validRecords.length, existingRecords.length);
            if (choice === null) return; // 用户取消
            importMode = choice;
        }

        let finalRecords;
        if (importMode === 'replace') {
            finalRecords = validRecords.map(r => ({
                ...createEmptyRecord(),
                ...r,
                id: r.id || generateId(),
                tags: Array.isArray(r.tags) ? r.tags : [],
                createdAt: r.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }));
        } else {
            // 合并模式：根据 titleZh 去重
            finalRecords = [...existingRecords];
            const existingTitles = new Set(finalRecords.map(r => r.titleZh.trim().toLowerCase()));

            let addedCount = 0;
            let skippedCount = 0;

            for (const r of validRecords) {
                const normalizedRecord = {
                    ...createEmptyRecord(),
                    ...r,
                    id: r.id || generateId(),
                    tags: Array.isArray(r.tags) ? r.tags : [],
                    createdAt: r.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                const titleLower = normalizedRecord.titleZh.trim().toLowerCase();
                if (existingTitles.has(titleLower)) {
                    skippedCount++;
                } else {
                    finalRecords.push(normalizedRecord);
                    existingTitles.add(titleLower);
                    addedCount++;
                }
            }

            if (saveRecords(finalRecords)) {
                if (skippedCount > 0) {
                    showToast(`已导入 ${addedCount} 条，跳过 ${skippedCount} 条重复记录`, 'info');
                } else {
                    showToast(`已导入 ${addedCount} 条记录`, 'success');
                }
                refreshCards();
            } else {
                showToast('导入失败：数据保存出错', 'error');
            }
            return;
        }

        if (saveRecords(finalRecords)) {
            showToast(`已${importMode === 'replace' ? '替换' : '导入'} ${finalRecords.length} 条记录`, 'success');
            refreshCards();
        } else {
            showToast('导入失败：数据保存出错', 'error');
        }

    } catch (e) {
        if (e instanceof SyntaxError) {
            showToast('文件格式错误：无效的 JSON 文件', 'error');
        } else {
            showToast(`导入失败：${e.message}`, 'error');
        }
        console.error('导入错误:', e);
    }
}

/**
 * 显示导入选项对话框
 * @param {number} importCount 导入文件中的记录数
 * @param {number} existingCount 现有记录数
 * @returns {Promise<string|null>} 'merge' | 'replace' | null
 */
function showImportChoice(importCount, existingCount) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('confirm-overlay');
        document.getElementById('confirm-title').textContent = '导入数据';
        document.getElementById('confirm-message').innerHTML = `
            <p>发现 <strong>${importCount}</strong> 条待导入记录。</p>
            <p>当前已有 <strong>${existingCount}</strong> 条记录。</p>
            <p style="margin-top:8px">请选择导入方式：</p>
        `;

        // 修改确认对话框的按钮
        const cancelBtn = document.getElementById('confirm-cancel');
        const okBtn = document.getElementById('confirm-ok');

        cancelBtn.textContent = '取消';
        okBtn.textContent = '合并导入';

        overlay.classList.remove('hidden');

        // 添加替换按钮
        let replaceBtn = document.getElementById('confirm-replace');
        if (!replaceBtn) {
            replaceBtn = document.createElement('button');
            replaceBtn.id = 'confirm-replace';
            replaceBtn.className = 'btn btn-outline';
            replaceBtn.textContent = '替换全部';
            const footer = document.querySelector('#confirm-modal .modal-footer');
            footer.insertBefore(replaceBtn, okBtn);
        }
        replaceBtn.classList.remove('hidden');

        function cleanup() {
            overlay.classList.add('hidden');
            cancelBtn.textContent = '取消';
            okBtn.textContent = '确认';
            if (replaceBtn) replaceBtn.classList.add('hidden');
            okBtn.removeEventListener('click', onMerge);
            cancelBtn.removeEventListener('click', onCancel);
            if (replaceBtn) replaceBtn.removeEventListener('click', onReplace);
            document.removeEventListener('keydown', onKeydown);
        }

        function onMerge() {
            cleanup();
            resolve('merge');
        }

        function onReplace() {
            cleanup();
            resolve('replace');
        }

        function onCancel() {
            cleanup();
            resolve(null);
        }

        function onKeydown(e) {
            if (e.key === 'Escape') {
                onCancel();
            }
        }

        okBtn.addEventListener('click', onMerge);
        cancelBtn.addEventListener('click', onCancel);
        if (replaceBtn) replaceBtn.addEventListener('click', onReplace);
        document.addEventListener('keydown', onKeydown);
        okBtn.focus();
    });
}

/**
 * 触发 JSON 文件下载
 * @param {Object} data
 * @param {string} filename
 */
function downloadJSON(data, filename) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * 格式化日期为文件名格式
 */
function formatDateFilename(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
}
