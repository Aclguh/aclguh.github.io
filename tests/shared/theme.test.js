const { describe, it, expect, beforeEach, afterEach } = require('../test-utils.js');

describe('ThemeManager Module', () => {
    let mockStorage = {};
    let attributes = {};
    let metaAttrs = {};
    let eventListeners = {};
    let customEvents = [];

    beforeEach(() => {
        mockStorage = {};
        attributes = {};
        metaAttrs = {};
        eventListeners = {};
        customEvents = [];

        global.localStorage = {
            getItem: (k) => (k in mockStorage ? mockStorage[k] : null),
            setItem: (k, v) => {
                mockStorage[k] = String(v);
            },
            removeItem: (k) => {
                delete mockStorage[k];
            }
        };

        global.document = {
            documentElement: {
                getAttribute: (k) => attributes[k] || null,
                setAttribute: (k, v) => {
                    attributes[k] = String(v);
                }
            },
            querySelector: (sel) => {
                if (sel === 'meta[name="theme-color"]') {
                    return {
                        setAttribute: (k, v) => {
                            metaAttrs[k] = v;
                        }
                    };
                }
                return null;
            },
            getElementById: () => null,
            addEventListener: (evt, handler) => {
                eventListeners[evt] = handler;
            },
            dispatchEvent: (evt) => {
                customEvents.push(evt);
            },
            readyState: 'complete'
        };

        global.window = {
            matchMedia: (q) => ({
                matches: false,
                addEventListener: () => {}
            })
        };

        global.CustomEvent = class {
            constructor(type, init) {
                this.type = type;
                this.detail = init ? init.detail : null;
            }
        };

        // 清除模块缓存确保重新初始化
        delete require.cache[require.resolve('../../shared/js/theme.js')];
    });

    afterEach(() => {
        delete global.document;
        delete global.window;
        delete global.localStorage;
        delete global.CustomEvent;
    });

    it('无本地存储且非深色模式偏好时，初始化默认应用 light 主题', () => {
        const ThemeManager = require('../../shared/js/theme.js');
        expect(ThemeManager.getTheme()).toBe('light');
        expect(attributes['data-theme']).toBe('light');
    });

    it('存在 localStorage 时优先读取已保存主题', () => {
        mockStorage['theme'] = 'dark';
        const ThemeManager = require('../../shared/js/theme.js');
        expect(ThemeManager.getTheme()).toBe('dark');
        expect(attributes['data-theme']).toBe('dark');
    });

    it('手动 apply 主题可保存至 storage 并同步 meta theme-color', () => {
        const ThemeManager = require('../../shared/js/theme.js');
        ThemeManager.apply('dark', true);

        expect(attributes['data-theme']).toBe('dark');
        expect(mockStorage['theme']).toBe('dark');
        expect(metaAttrs['content']).toBe('#0e1015');
    });

    it('toggleTheme 应在深浅色之间翻转并分发 themechange 事件', () => {
        const ThemeManager = require('../../shared/js/theme.js');
        // 当前为 light，切换为 dark
        ThemeManager.toggle();

        expect(attributes['data-theme']).toBe('dark');
        expect(mockStorage['theme']).toBe('dark');
        expect(customEvents.length).toBe(1);
        expect(customEvents[0].type).toBe('themechange');
        expect(customEvents[0].detail.theme).toBe('dark');

        // 再次切换回到 light
        ThemeManager.toggle();
        expect(attributes['data-theme']).toBe('light');
        expect(mockStorage['theme']).toBe('light');
        expect(customEvents[1].detail.theme).toBe('light');
    });
});
