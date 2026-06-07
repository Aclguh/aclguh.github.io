/**
 * 应用入口
 * 初始化应用、绑定全局事件
 */

(function () {
    'use strict';

    // ============================================
    // 初始化
    // ============================================
    function init() {
        checkVersion();
        populateSortOptions();
        populateFilters();
        refreshCards();
        bindEvents();
        bindStorageSync();
        console.log('🎬 看番记录管理已就绪');
    }

    // ============================================
    // 填充排序选项
    // ============================================
    function populateSortOptions() {
        const select = document.getElementById('sort-select');
        for (const [value, label] of Object.entries(SORT_LABELS)) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            select.appendChild(option);
        }
    }

    // ============================================
    // 填充筛选按钮计数
    // ============================================
    function populateFilters() {
        // 添加计数 span 到每个筛选按钮
        document.querySelectorAll('.filter-btn').forEach(btn => {
            if (!btn.querySelector('.filter-count')) {
                const count = document.createElement('span');
                count.className = 'filter-count';
                btn.appendChild(count);
            }
        });
    }

    // ============================================
    // 绑定事件
    // ============================================
    function bindEvents() {
        // 添加番剧
        document.getElementById('btn-add').addEventListener('click', openAddForm);
        document.getElementById('btn-add-empty').addEventListener('click', openAddForm);

        // 导入导出
        document.getElementById('btn-export').addEventListener('click', exportData);
        document.getElementById('btn-template').addEventListener('click', exportTemplate);
        document.getElementById('btn-import').addEventListener('click', triggerImport);

        // 导入文件
        document.getElementById('import-file-input').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleImportFile(file);
                // 重置文件输入，以便可以重复选择同一文件
                e.target.value = '';
            }
        });

        // 模态窗口
        document.getElementById('modal-close').addEventListener('click', hideModal);
        document.getElementById('modal-cancel').addEventListener('click', hideModal);
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                hideModal();
            }
        });

        // 保存
        document.getElementById('modal-save').addEventListener('click', saveFormRecord);
        document.getElementById('modal-delete').addEventListener('click', deleteFormRecord);

        // 表单字段事件
        document.getElementById('form-rating').addEventListener('input', (e) => {
            updateRatingDisplay(parseInt(e.target.value));
        });
        document.getElementById('form-cover-url').addEventListener('input', (e) => {
            updateCoverPreview(e.target.value);
        });

        // 标签搜索
        document.getElementById('tag-search-input').addEventListener('input', (e) => {
            renderTagOptions(e.target.value);
        });

        // 防止标签下拉框关闭
        document.getElementById('tags-dropdown').addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // 状态筛选
        document.getElementById('status-filters').addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-btn');
            if (!btn) return;

            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            refreshCards();
        });

        // 搜索
        let searchDebounce;
        document.getElementById('search-input').addEventListener('input', (e) => {
            const clearBtn = document.getElementById('search-clear');
            if (e.target.value.trim()) {
                clearBtn.classList.remove('hidden');
            } else {
                clearBtn.classList.add('hidden');
            }

            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(refreshCards, 250);
        });

        document.getElementById('search-clear').addEventListener('click', () => {
            const input = document.getElementById('search-input');
            input.value = '';
            document.getElementById('search-clear').classList.add('hidden');
            input.focus();
            refreshCards();
        });

        // 排序
        document.getElementById('sort-select').addEventListener('change', refreshCards);

        // 卡片事件（事件委托）
        document.getElementById('anime-grid').addEventListener('click', (e) => {
            // 编辑按钮
            const editBtn = e.target.closest('[data-action="edit"]');
            if (editBtn) {
                e.stopPropagation();
                openEditForm(editBtn.dataset.id);
                return;
            }

            // 删除按钮
            const deleteBtn = e.target.closest('[data-action="delete"]');
            if (deleteBtn) {
                e.stopPropagation();
                deleteRecordFromCard(deleteBtn.dataset.id);
                return;
            }

            // +1集按钮
            const epBtn = e.target.closest('[data-action="ep-plus"]');
            if (epBtn) {
                e.stopPropagation();
                episodePlusOne(epBtn.dataset.id);
                return;
            }

            // 点击卡片 → 编辑
            const card = e.target.closest('.anime-card');
            if (card) {
                openEditForm(card.dataset.id);
            }
        });

        // 加载更多
        document.getElementById('btn-load-more').addEventListener('click', loadMoreCards);

        // 键盘快捷键
        document.addEventListener('keydown', handleKeyboard);

        // 表单内 Enter 提交
        document.getElementById('anime-form').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                saveFormRecord();
            }
        });
    }

    // ============================================
    // 键盘快捷键
    // ============================================
    function handleKeyboard(e) {
        // Esc 关闭模态
        if (e.key === 'Escape') {
            const overlay = document.getElementById('modal-overlay');
            const confirmOverlay = document.getElementById('confirm-overlay');
            if (!overlay.classList.contains('hidden')) {
                hideModal();
            } else if (!confirmOverlay.classList.contains('hidden')) {
                document.getElementById('confirm-cancel').click();
            }
            return;
        }

        // Ctrl+N 添加新番剧
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            openAddForm();
            return;
        }

        // Ctrl+S 导出
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            exportData();
            return;
        }

        // Ctrl+O 导入
        if (e.ctrlKey && e.key === 'o') {
            e.preventDefault();
            triggerImport();
            return;
        }

        // 搜索框快捷键 Ctrl+F → 聚焦搜索
        if (e.ctrlKey && e.key === 'f') {
            // 如果不在输入框内
            if (document.activeElement === document.body || document.activeElement === document.getElementById('anime-grid')) {
                e.preventDefault();
                document.getElementById('search-input').focus();
            }
        }
    }

    // ============================================
    // 跨标签页同步
    // ============================================
    function bindStorageSync() {
        window.addEventListener('storage', (e) => {
            if (e.key === STORAGE_KEY) {
                // 数据在其他标签页被修改，刷新显示
                refreshCards();
                showToast('数据已在其他标签页更新', 'info', 2000);
            }
        });
    }

    // ============================================
    // 拖拽导入支持
    // ============================================
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    document.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.json')) {
            handleImportFile(file);
        } else if (file) {
            showToast('请拖入 .json 文件', 'error');
        }
    });

    // ============================================
    // 启动
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
