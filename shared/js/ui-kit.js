/**
 * 通用 UI 交互库 (UIKit) - Toast 提示与 Confirm 对话框
 * 零第三方依赖，自适应主题，具备无障碍键盘交互支持 (a11y)
 */

(function (_global) {
    'use strict';

    /* ── Toast 提示管理器 ────────────────────────────────── */
    const Toast = {
        container: null,
        activeTimer: null,

        ensureContainer() {
            if (this.container && document.body.contains(this.container)) return this.container;
            let c = document.querySelector('.ui-toast-container');
            if (!c) {
                c = document.createElement('div');
                c.className = 'ui-toast-container';
                c.setAttribute('aria-live', 'polite');
                document.body.appendChild(c);
            }
            this.container = c;
            return c;
        },

        /**
         * 弹出轻提示
         * @param {string} message - 消息文本
         * @param {'info'|'success'|'error'|'warning'} type - 提示类型
         * @param {number} duration - 展示时长 (ms)
         */
        show(message, type = 'info', duration = 2500) {
            if (typeof document === 'undefined') return;
            const container = this.ensureContainer();

            // 单实例覆盖模式，避免屏幕堆叠过多气泡
            container.innerHTML = '';
            clearTimeout(this.activeTimer);

            const toast = document.createElement('div');
            toast.className = `ui-toast ui-toast-${type}`;
            toast.textContent = message;

            container.appendChild(toast);

            // 触发进入动画
            requestAnimationFrame(() => {
                toast.classList.add('ui-toast-visible');
            });

            this.activeTimer = setTimeout(() => {
                toast.classList.remove('ui-toast-visible');
                setTimeout(() => {
                    if (toast.parentElement) toast.parentElement.removeChild(toast);
                }, 260);
            }, duration);
        },

        info(msg, duration) {
            this.show(msg, 'info', duration);
        },
        success(msg, duration) {
            this.show(msg, 'success', duration);
        },
        error(msg, duration) {
            this.show(msg, 'error', duration);
        },
        warning(msg, duration) {
            this.show(msg, 'warning', duration);
        }
    };

    /* ── Confirm 模态对话框 ────────────────────────────── */
    const Modal = {
        /**
         * 弹出异步确认对话框
         * @param {Object} options
         * @param {string} options.title - 弹窗标题
         * @param {string} options.message - 描述正文
         * @param {string} [options.okText='确定'] - 确定按钮文字
         * @param {string} [options.cancelText='取消'] - 取消按钮文字
         * @param {boolean} [options.danger=false] - 是否危险操作高亮
         * @returns {Promise<boolean>} 用户点击确认返回 true，取消/关闭返回 false
         */
        confirm({ title = '确认操作', message = '', okText = '确定', cancelText = '取消', danger = false }) {
            if (typeof document === 'undefined') return Promise.resolve(false);

            return new Promise((resolve) => {
                const previousActiveElement = document.activeElement;
                const modalId = 'modal_' + Math.random().toString(36).substring(2, 8);

                const overlay = document.createElement('div');
                overlay.className = 'ui-modal-overlay';
                overlay.setAttribute('role', 'dialog');
                overlay.setAttribute('aria-modal', 'true');
                overlay.setAttribute('aria-labelledby', modalId + '_title');
                overlay.setAttribute('aria-describedby', modalId + '_desc');

                const dialog = document.createElement('div');
                dialog.className = 'ui-modal-dialog';

                const titleEl = document.createElement('div');
                titleEl.className = 'ui-modal-title';
                titleEl.id = modalId + '_title';
                titleEl.textContent = title;

                const msgEl = document.createElement('div');
                msgEl.className = 'ui-modal-message';
                msgEl.id = modalId + '_desc';
                msgEl.textContent = message;

                const actions = document.createElement('div');
                actions.className = 'ui-modal-actions';

                const cancelBtn = document.createElement('button');
                cancelBtn.type = 'button';
                cancelBtn.className = 'ui-modal-btn ui-modal-btn-cancel';
                cancelBtn.textContent = cancelText;

                const okBtn = document.createElement('button');
                okBtn.type = 'button';
                okBtn.className = `ui-modal-btn ${danger ? 'ui-modal-btn-danger' : 'ui-modal-btn-confirm'}`;
                okBtn.textContent = okText;

                actions.appendChild(cancelBtn);
                actions.appendChild(okBtn);

                dialog.appendChild(titleEl);
                dialog.appendChild(msgEl);
                dialog.appendChild(actions);
                overlay.appendChild(dialog);
                document.body.appendChild(overlay);

                // 显示过渡
                requestAnimationFrame(() => {
                    overlay.classList.add('ui-modal-visible');
                    okBtn.focus();
                });

                function close(result) {
                    overlay.classList.remove('ui-modal-visible');
                    document.removeEventListener('keydown', onKeydown);
                    if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
                        try {
                            previousActiveElement.focus();
                        } catch (_) {}
                    }
                    setTimeout(() => {
                        if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
                        resolve(result);
                    }, 210);
                }

                function onKeydown(e) {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        close(false);
                    } else if (
                        e.key === 'Enter' &&
                        (document.activeElement === okBtn || document.activeElement === cancelBtn)
                    ) {
                        // 允许回车触发当前聚焦的按钮
                        e.preventDefault();
                        close(document.activeElement === okBtn);
                    } else if (e.key === 'Tab') {
                        // 焦点锁定 (Focus Trap)
                        const focusables = [cancelBtn, okBtn];
                        const first = focusables[0];
                        const last = focusables[focusables.length - 1];

                        if (e.shiftKey) {
                            if (document.activeElement === first || !dialog.contains(document.activeElement)) {
                                e.preventDefault();
                                last.focus();
                            }
                        } else {
                            if (document.activeElement === last || !dialog.contains(document.activeElement)) {
                                e.preventDefault();
                                first.focus();
                            }
                        }
                    }
                }

                cancelBtn.onclick = () => close(false);
                okBtn.onclick = () => close(true);
                overlay.onclick = (e) => {
                    if (e.target === overlay) close(false);
                };
                document.addEventListener('keydown', onKeydown);
            });
        }
    };

    const UIKit = { Toast, Modal };

    if (typeof window !== 'undefined') {
        window.UIKit = UIKit;
        window.Toast = Toast;
        window.Modal = Modal;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = UIKit;
    }
})(typeof window !== 'undefined' ? window : this);
