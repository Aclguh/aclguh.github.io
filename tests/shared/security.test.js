const { describe, it, expect } = require('../test-utils.js');
const { escapeHtml, escapeAttr, sanitizeUrl } = require('../../shared/js/security.js');

describe('Security: escapeHtml & escapeAttr', () => {
    it('应正确转义 HTML 基础特殊字符 <, >, &', () => {
        expect(escapeHtml('<div>&amp;</div>')).toBe('&lt;div&gt;&amp;amp;&lt;/div&gt;');
    });

    it('应严格转义双引号和单引号，防止属性注入', () => {
        const injected = 'My Anime" onmouseover="alert(1)"';
        const escaped = escapeHtml(injected);
        expect(escaped).toBe('My Anime&quot; onmouseover=&quot;alert(1)&quot;');
        expect(escaped).not.toContain('"');
    });

    it('处理 null, undefined, 数字与空字符串', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
        expect(escapeHtml('')).toBe('');
        expect(escapeHtml(123)).toBe('123');
        expect(escapeAttr(null)).toBe('');
        expect(escapeAttr('title "test" & <attr>')).toBe('title &quot;test&quot; &amp; &lt;attr&gt;');
    });
});

describe('Security: sanitizeUrl', () => {
    it('允许合法 http 与 https 协议 URL', () => {
        expect(sanitizeUrl('https://example.com/cover.jpg')).toBe('https://example.com/cover.jpg');
        expect(sanitizeUrl('http://test.org/api?v=1&q=2')).toBe('http://test.org/api?v=1&amp;q=2');
    });

    it('允许安全相对路径与锚点', () => {
        expect(sanitizeUrl('/images/logo.png')).toBe('/images/logo.png');
        expect(sanitizeUrl('./detail.html')).toBe('./detail.html');
        expect(sanitizeUrl('../shared/css/ui-kit.css')).toBe('../shared/css/ui-kit.css');
        expect(sanitizeUrl('#section1')).toBe('#section1');
    });

    it('允许安全图片 Base64 data:image 格式', () => {
        const safeDataUrl =
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        expect(sanitizeUrl(safeDataUrl)).toBe(safeDataUrl);
    });

    it('彻底拦截 javascript: 及其混淆伪协议', () => {
        expect(sanitizeUrl('javascript:alert(1)')).toBe('');
        expect(sanitizeUrl('JAVASCRIPT:alert(document.cookie)')).toBe('');
        expect(sanitizeUrl('  javascript:alert(1)  ')).toBe('');
        expect(sanitizeUrl('java\x00script:alert(1)')).toBe('');
        expect(sanitizeUrl('vbscript:msgbox("xss")')).toBe('');
        expect(sanitizeUrl('file:///etc/passwd')).toBe('');
    });

    it('拦截非图片类危险 data 协议 (如 data:text/html)', () => {
        expect(sanitizeUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe('');
    });

    it('支持自定义 fallback 回退值', () => {
        expect(sanitizeUrl('javascript:void(0)', 'about:blank')).toBe('about:blank');
        expect(sanitizeUrl(null, 'default.png')).toBe('default.png');
        expect(sanitizeUrl('', 'default.png')).toBe('default.png');
    });
});
