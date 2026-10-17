const { describe, it, expect, beforeEach, afterEach } = require('../test-utils.js');

describe('UIKit (Toast & Modal) Module', () => {
    let appendedElements = [];
    let focusedElement = null;

    beforeEach(() => {
        appendedElements = [];
        focusedElement = null;

        global.document = {
            body: {
                appendChild: (el) => {
                    appendedElements.push(el);
                    el.parentElement = global.document.body;
                    return el;
                },
                removeChild: (el) => {
                    const idx = appendedElements.indexOf(el);
                    if (idx > -1) appendedElements.splice(idx, 1);
                    el.parentElement = null;
                },
                contains: (el) => appendedElements.includes(el)
            },
            querySelector: (sel) => {
                if (sel === '.ui-toast-container') {
                    return appendedElements.find((e) => e.className === 'ui-toast-container') || null;
                }
                return null;
            },
            createElement: (tag) => {
                const el = {
                    tagName: tag.toUpperCase(),
                    className: '',
                    textContent: '',
                    innerHTML: '',
                    children: [],
                    attributes: {},
                    classList: {
                        add: (c) => {
                            if (!el.className.includes(c)) el.className += ` ${c}`;
                        },
                        remove: (c) => {
                            el.className = el.className.replace(c, '').trim();
                        }
                    },
                    setAttribute: (k, v) => {
                        el.attributes[k] = v;
                    },
                    appendChild: (child) => {
                        el.children.push(child);
                        child.parentElement = el;
                        return child;
                    },
                    removeChild: (child) => {
                        const idx = el.children.indexOf(child);
                        if (idx > -1) el.children.splice(idx, 1);
                        child.parentElement = null;
                        const bodyIdx = appendedElements.indexOf(child);
                        if (bodyIdx > -1) appendedElements.splice(bodyIdx, 1);
                    },
                    focus: () => {
                        focusedElement = el;
                    }
                };
                return el;
            },
            addEventListener: () => {},
            removeEventListener: () => {}
        };

        global.requestAnimationFrame = (fn) => setTimeout(fn, 0);

        delete require.cache[require.resolve('../../shared/js/ui-kit.js')];
    });

    afterEach(() => {
        delete global.document;
        delete global.requestAnimationFrame;
    });

    it('Toast.show 创建容器与 Toast 节点', () => {
        const { Toast } = require('../../shared/js/ui-kit.js');
        Toast.show('测试成功', 'success');

        const container = appendedElements.find((e) => e.className.includes('ui-toast-container'));
        expect(container).not.toBeNull();
        expect(container.children.length).toBe(1);
        expect(container.children[0].textContent).toBe('测试成功');
        expect(container.children[0].className).toContain('ui-toast-success');
    });

    it('Modal.confirm 创建并弹出对话框，并自动聚焦确认按钮', async () => {
        const { Modal } = require('../../shared/js/ui-kit.js');
        const promise = Modal.confirm({
            title: '删除记录',
            message: '确认删除？',
            okText: '删除',
            danger: true
        });

        const overlay = appendedElements.find((e) => e.className.includes('ui-modal-overlay'));
        expect(overlay).not.toBeNull();
        expect(overlay.attributes['role']).toBe('dialog');
        expect(overlay.attributes['aria-modal']).toBe('true');

        // 等待微任务触发 focus
        await new Promise((r) => setTimeout(r, 10));
        expect(focusedElement).not.toBeNull();
        expect(focusedElement.textContent).toBe('删除');
        expect(focusedElement.className).toContain('ui-modal-btn-danger');

        // 点击确认
        focusedElement.onclick();
        const result = await promise;
        expect(result).toBe(true);
    });
});
