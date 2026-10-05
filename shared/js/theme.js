/**
 * 通用深浅色主题管理器
 * 支持跟随系统 prefers-color-scheme、本地存储、防止首屏闪白
 */
(function (global) {
    var KEY = 'theme';
    var doc = document.documentElement;
    var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    var META = { light: '#f6f7fb', dark: '#0e1015' };

    function stored() {
        try { return localStorage.getItem(KEY); } catch (e) { return null; }
    }

    function apply(theme, save) {
        doc.setAttribute('data-theme', theme);
        if (save) {
            try { localStorage.setItem(KEY, theme); } catch (e) {}
        }
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta && META[theme]) {
            meta.setAttribute('content', META[theme]);
        }
    }

    function initTheme(defaultThemeMeta) {
        if (defaultThemeMeta) {
            if (defaultThemeMeta.light) META.light = defaultThemeMeta.light;
            if (defaultThemeMeta.dark) META.dark = defaultThemeMeta.dark;
        }

        var s = stored();
        var isDark = s === 'dark' || (!s && mq && mq.matches);
        var activeTheme = s === 'dark' || s === 'light' ? s : (isDark ? 'dark' : 'light');
        apply(activeTheme, false);

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bindToggle);
        } else {
            bindToggle();
        }

        if (mq && mq.addEventListener) {
            mq.addEventListener('change', function (e) {
                var currentStored = stored();
                if (currentStored !== 'dark' && currentStored !== 'light') {
                    apply(e.matches ? 'dark' : 'light', false);
                }
            });
        }
    }

    function toggleTheme() {
        var current = doc.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        var next = current === 'dark' ? 'light' : 'dark';
        apply(next, true);
        document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
    }

    function bindToggle() {
        var btn = document.getElementById('theme-toggle');
        if (btn && !btn._themeBound) {
            btn._themeBound = true;
            btn.addEventListener('click', toggleTheme);
        }
    }

    // 默认自启动
    initTheme();

    global.ThemeManager = {
        init: initTheme,
        apply: apply,
        toggle: toggleTheme,
        getTheme: function () {
            return doc.getAttribute('data-theme') || 'light';
        }
    };
})(typeof window !== 'undefined' ? window : this);
