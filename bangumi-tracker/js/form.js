/**
 * 表单逻辑模块
 * 负责添加/编辑番剧的模态窗口表单
 */

let editingId = null; // 当前编辑的记录 ID

/**
 * 打开添加表单
 */
function openAddForm() {
    editingId = null;
    document.getElementById('modal-title').textContent = '添加番剧';
    document.getElementById('modal-delete').classList.add('hidden');
    resetForm();
    showModal();
}

/**
 * 打开编辑表单
 * @param {string} id - 记录 ID
 */
function openEditForm(id) {
    const record = getRecord(id);
    if (!record) {
        showToast('未找到该记录', 'error');
        return;
    }

    editingId = id;
    document.getElementById('modal-title').textContent = '编辑番剧';
    document.getElementById('modal-delete').classList.remove('hidden');

    // 填充表单
    document.getElementById('form-id').value = record.id;
    document.getElementById('form-title-zh').value = record.titleZh || '';
    document.getElementById('form-status').value = record.status;
    document.getElementById('form-ep-watched').value = record.episodesWatched;
    document.getElementById('form-ep-total').value = record.episodesTotal;

    showModal();
}

/**
 * 重置表单
 */
function resetForm() {
    document.getElementById('anime-form').reset();
    document.getElementById('form-id').value = '';
    document.getElementById('form-status').value = STATUS.WANT_TO_WATCH;
}

/**
 * 显示模态窗口
 */
function showModal() {
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('form-title-zh').focus();
    document.body.style.overflow = 'hidden';
}

/**
 * 隐藏模态窗口
 */
function hideModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.body.style.overflow = '';
    editingId = null;
}

/**
 * 保存记录
 */
function saveFormRecord() {
    const titleZh = document.getElementById('form-title-zh').value.trim();

    // 验证
    if (!titleZh) {
        showToast('请输入番剧名称', 'error');
        document.getElementById('form-title-zh').focus();
        return;
    }

    const record = {
        titleZh: titleZh,
        status: document.getElementById('form-status').value,
        episodesWatched: parseInt(document.getElementById('form-ep-watched').value) || 0,
        episodesTotal: parseInt(document.getElementById('form-ep-total').value) || 0,
    };

    // 集数修正
    if (record.episodesWatched < 0) record.episodesWatched = 0;
    if (record.episodesTotal < 0) record.episodesTotal = 0;
    if (record.episodesTotal > 0 && record.episodesWatched > record.episodesTotal) {
        record.episodesWatched = record.episodesTotal;
    }

    // 状态自动修正：全看完且状态为watching时改为watched
    if (record.episodesTotal > 0 && record.episodesWatched >= record.episodesTotal) {
        if (record.status === STATUS.WATCHING || record.status === STATUS.WANT_TO_WATCH) {
            record.status = STATUS.WATCHED;
            if (!record.endDate) {
                record.endDate = new Date().toISOString().split('T')[0];
            }
            showToast('已自动切换为"看过"状态', 'info');
        }
    }

    let result;
    if (editingId) {
        result = updateRecord(editingId, record);
        if (result) {
            showToast(`「${result.titleZh}」已更新`, 'success');
        } else {
            showToast('更新失败', 'error');
            return;
        }
    } else {
        result = addRecord(record);
        if (result) {
            showToast(`「${result.titleZh}」已添加`, 'success');
        } else {
            showToast('添加失败', 'error');
            return;
        }
    }

    hideModal();
    refreshCards();
}

/**
 * 删除记录（从表单中）
 */
async function deleteFormRecord() {
    if (!editingId) return;

    const record = getRecord(editingId);
    if (!record) return;

    const confirmed = await showConfirm(
        '删除番剧',
        `确定要删除「${record.titleZh || '未命名番剧'}」吗？此操作不可撤销。`
    );

    if (confirmed) {
        const success = deleteRecord(editingId);
        if (success) {
            showToast(`「${record.titleZh}」已删除`, 'success');
            hideModal();
            refreshCards();
        } else {
            showToast('删除失败', 'error');
        }
    }
}

/**
 * 从卡片事件中删除记录
 */
async function deleteRecordFromCard(id) {
    const record = getRecord(id);
    if (!record) return;

    const confirmed = await showConfirm(
        '删除番剧',
        `确定要删除「${record.titleZh || '未命名番剧'}」吗？此操作不可撤销。`
    );

    if (confirmed) {
        const success = deleteRecord(id);
        if (success) {
            showToast(`「${record.titleZh}」已删除`, 'success');
            refreshCards();
        } else {
            showToast('删除失败', 'error');
        }
    }
}

/**
 * 快捷集数+1
 * @param {string} id - 记录 ID
 */
function episodePlusOne(id) {
    const record = getRecord(id);
    if (!record) return;

    let newWatched = record.episodesWatched + 1;
    let newStatus = record.status;
    let newEndDate = record.endDate;

    // 状态自动切换
    if (record.status === STATUS.WANT_TO_WATCH) {
        newStatus = STATUS.WATCHING;
        if (!record.startDate) {
            // 不自动设置开始日期，保持用户手动设置
        }
    }

    // 达到总集数时自动标记为看过
    if (record.episodesTotal > 0 && newWatched >= record.episodesTotal) {
        newStatus = STATUS.WATCHED;
        newEndDate = new Date().toISOString().split('T')[0];
        newWatched = record.episodesTotal;
    }

    const result = updateRecord(id, {
        episodesWatched: newWatched,
        status: newStatus,
        endDate: newEndDate
    });

    if (result) {
        // 就地更新卡片
        updateCardInPlace(result);

        // 如果状态变更，刷新统计数据
        if (newStatus !== record.status) {
            renderStats(loadRecords());
            if (newStatus === STATUS.WATCHED) {
                showToast(`🎉「${result.titleZh}」追完了！`, 'success');
            } else if (newStatus === STATUS.WATCHING) {
                showToast(`「${result.titleZh}」状态已切换为「在看」`, 'info');
            }
        }
    } else {
        showToast('更新失败', 'error');
    }
}

/**
 * 就地更新卡片内容（用于 +1集 等快捷操作，避免全量刷新破坏动画）
 */
function updateCardInPlace(record) {
    const card = document.querySelector(`.anime-card[data-id="${record.id}"]`);
    if (!card) return;

    // 更新状态徽章
    const badge = card.querySelector('.card-status-badge');
    if (badge) {
        badge.style.background = STATUS_COLORS[record.status];
        badge.textContent = STATUS_LABELS[record.status];
    }

    // 更新集数显示
    const epEl = card.querySelector('.card-episodes');
    if (epEl) {
        if (record.episodesTotal > 0) {
            const remaining = record.episodesTotal - record.episodesWatched;
            if (record.status === STATUS.WATCHED || remaining <= 0) {
                epEl.innerHTML = `<span>已完成 ${record.episodesTotal} 集</span>`;
            } else {
                epEl.innerHTML = `<span class="ep-watched">${record.episodesWatched}</span><span class="ep-divider">/</span><span>${record.episodesTotal}</span><span class="ep-divider" style="margin-left:4px">剩${remaining}集</span>`;
            }
        } else if (record.episodesWatched > 0) {
            epEl.innerHTML = `<span class="ep-watched">已看 ${record.episodesWatched} 集</span>`;
        } else {
            epEl.innerHTML = '';
        }
    }

    // 更新 +1集 按钮
    const epBtn = card.querySelector('.card-ep-btn');
    if (epBtn) {
        const isCompleted = record.status === STATUS.WATCHED ||
            (record.episodesTotal > 0 && record.episodesWatched >= record.episodesTotal);

        if (isCompleted) {
            epBtn.classList.add('completed');
            epBtn.textContent = '✓ 已追完';
            epBtn.disabled = true;
            epBtn.title = '已追完';
        } else {
            epBtn.classList.remove('completed', 'pulse');
            epBtn.disabled = false;
            epBtn.textContent = '+1集';
            epBtn.title = '集数+1';

            // 播放脉冲动画
            // 先移除再添加触发回流重启动画
            epBtn.classList.remove('pulse');
            void epBtn.offsetWidth; // 强制回流
            epBtn.classList.add('pulse');
            setTimeout(() => epBtn.classList.remove('pulse'), 400);
        }
    }

    // 更新 data-status 属性（影响过滤显示）
    card.dataset.status = record.status;
}
