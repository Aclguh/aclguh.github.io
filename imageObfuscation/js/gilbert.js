/**
 * 基于 Gilbert 空间填充曲线的像素级置换核心算法
 * 纯算法模块：供主线程与 Web Worker 共享，支持 Node.js 单元测试
 */

function generate2d(x, y, ax, ay, bx, by, coordinates) {
    const w = Math.abs(ax + ay);
    const h = Math.abs(bx + by);

    const dax = Math.sign(ax);
    const day = Math.sign(ay);
    const dbx = Math.sign(bx);
    const dby = Math.sign(by);

    if (h === 1) {
        for (let i = 0; i < w; i++) {
            coordinates.push(x, y);
            x += dax;
            y += day;
        }
        return;
    }

    if (w === 1) {
        for (let i = 0; i < h; i++) {
            coordinates.push(x, y);
            x += dbx;
            y += dby;
        }
        return;
    }

    let ax2 = Math.floor(ax / 2);
    let ay2 = Math.floor(ay / 2);
    let bx2 = Math.floor(bx / 2);
    let by2 = Math.floor(by / 2);

    const w2 = Math.abs(ax2 + ay2);
    const h2 = Math.abs(bx2 + by2);

    if (2 * w > 3 * h) {
        if (w2 % 2 && w > 2) {
            ax2 += dax;
            ay2 += day;
        }
        generate2d(x, y, ax2, ay2, bx, by, coordinates);
        generate2d(x + ax2, y + ay2, ax - ax2, ay - ay2, bx, by, coordinates);
    } else {
        if (h2 % 2 && h > 2) {
            bx2 += dbx;
            by2 += dby;
        }
        generate2d(x, y, bx2, by2, ax2, ay2, coordinates);
        generate2d(x + bx2, y + by2, ax, ay, bx - bx2, by - by2, coordinates);
        generate2d(
            x + (ax - dax) + (bx2 - dbx),
            y + (ay - day) + (by2 - dby),
            -bx2,
            -by2,
            -(ax - ax2),
            -(ay - ay2),
            coordinates
        );
    }
}

/**
 * 生成 width x height 矩形区域的 Gilbert 空间填充曲线坐标序列
 * 扁平存储 [x0, y0, x1, y1, ...]
 * @param {number} width
 * @param {number} height
 * @returns {Array<number>}
 */
function gilbert2d(width, height) {
    const coordinates = [];
    if (width >= height) {
        generate2d(0, 0, width, 0, 0, height, coordinates);
    } else {
        generate2d(0, 0, 0, height, width, 0, coordinates);
    }
    return coordinates;
}

/**
 * 对 32 位像素缓冲区执行混淆或解混淆
 * @param {Uint32Array} src32 - 输入像素
 * @param {Uint32Array} dst32 - 输出像素
 * @param {number} width
 * @param {number} height
 * @param {boolean} isEncrypt - true 为混淆，false 为解混淆
 * @param {Array<number>} [precomputedCoords] - 可选的预计算坐标
 */
function transformPixels(src32, dst32, width, height, isEncrypt, precomputedCoords = null) {
    const totalPixels = width * height;
    const coords = precomputedCoords || gilbert2d(width, height);
    const offset = Math.round(((Math.sqrt(5) - 1) / 2) * totalPixels);

    if (isEncrypt) {
        for (let i = 0; i < totalPixels; i++) {
            const oldX = coords[i * 2];
            const oldY = coords[i * 2 + 1];
            const nextIdx = (i + offset) % totalPixels;
            const newX = coords[nextIdx * 2];
            const newY = coords[nextIdx * 2 + 1];
            dst32[newX + newY * width] = src32[oldX + oldY * width];
        }
    } else {
        for (let i = 0; i < totalPixels; i++) {
            const oldX = coords[i * 2];
            const oldY = coords[i * 2 + 1];
            const prevIdx = (i - offset + totalPixels * 2) % totalPixels;
            const newX = coords[prevIdx * 2];
            const newY = coords[prevIdx * 2 + 1];
            dst32[newX + newY * width] = src32[oldX + oldY * width];
        }
    }
}

const GilbertObfuscation = {
    generate2d,
    gilbert2d,
    transformPixels
};

if (typeof window !== 'undefined') {
    window.GilbertObfuscation = GilbertObfuscation;
}

if (typeof self !== 'undefined' && typeof window === 'undefined') {
    self.GilbertObfuscation = GilbertObfuscation;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GilbertObfuscation;
}
