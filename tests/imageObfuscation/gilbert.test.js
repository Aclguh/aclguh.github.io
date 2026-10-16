const { describe, it, expect } = require('../test-utils.js');
const GilbertObfuscation = require('../../imageObfuscation/js/gilbert.js');

describe('Gilbert Image Obfuscation Core', () => {
    const testDimensions = [
        { w: 4, h: 4 },
        { w: 8, h: 5 },
        { w: 7, h: 9 },
        { w: 13, h: 11 },
        { w: 1, h: 10 },
        { w: 10, h: 1 }
    ];

    it('generates exact number of coordinates without omission or overlap', () => {
        for (const { w, h } of testDimensions) {
            const coords = GilbertObfuscation.gilbert2d(w, h);
            const totalPixels = w * h;

            expect(coords.length).toBe(totalPixels * 2);

            const visited = new Set();
            for (let i = 0; i < totalPixels; i++) {
                const x = coords[i * 2];
                const y = coords[i * 2 + 1];

                expect(x >= 0 && x < w).toBe(true);
                expect(y >= 0 && y < h).toBe(true);

                const key = `${x},${y}`;
                expect(visited.has(key)).toBe(false);
                visited.add(key);
            }
            expect(visited.size).toBe(totalPixels);
        }
    });

    it('ensures encryption and decryption are perfectly reversible: D(E(P)) === P', () => {
        for (const { w, h } of testDimensions) {
            const totalPixels = w * h;
            const original = new Uint32Array(totalPixels);
            for (let i = 0; i < totalPixels; i++) {
                // 生成模拟的 RGBA 32位像素值
                original[i] = (Math.random() * 0xffffffff) >>> 0;
            }

            const encrypted = new Uint32Array(totalPixels);
            const decrypted = new Uint32Array(totalPixels);

            // 加密
            GilbertObfuscation.transformPixels(original, encrypted, w, h, true);
            // 验证加密后数据被打乱（非退化情况）
            if (totalPixels > 2) {
                let diffCount = 0;
                for (let i = 0; i < totalPixels; i++) {
                    if (original[i] !== encrypted[i]) diffCount++;
                }
                expect(diffCount > 0).toBe(true);
            }

            // 解密
            GilbertObfuscation.transformPixels(encrypted, decrypted, w, h, false);

            // 验证解密完全恢复
            for (let i = 0; i < totalPixels; i++) {
                expect(decrypted[i]).toBe(original[i]);
            }
        }
    });
});
