/**
 * 小番茄图片混淆 - Web Worker
 * 引入共享的 gilbert.js，在后台线程执行像素置换
 */

importScripts('gilbert.js');

self.onmessage = function (e) {
    const { action, width, height, buffer } = e.data;
    const totalPixels = width * height;
    const src32 = new Uint32Array(buffer);
    const dst32 = new Uint32Array(totalPixels);

    const isEncrypt = action === 'encrypt';
    GilbertObfuscation.transformPixels(src32, dst32, width, height, isEncrypt);

    // 将结果二进制零拷贝转移回主线程
    self.postMessage({ buffer: dst32.buffer, width, height }, [dst32.buffer]);
};
