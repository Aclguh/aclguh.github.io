/**
 * 小番茄图片混淆 — 基于空间填充曲线 (Gilbert curve)
 * 支持 Web Worker 多线程处理与 32位像素流水线
 */

const img = document.getElementById("display-img");
const statusEl = document.getElementById("status");
const ipt = document.getElementById("ipt");
const btn_enc = document.getElementById("enc");
const btn_dec = document.getElementById("dec");
const btn_restore = document.getElementById("re");
const btn_download = document.getElementById("download");

let worker = null;
try {
    worker = new Worker('js/worker.js');
} catch (e) {
    console.warn('[imageObfuscation] Web Worker 无法加载，将使用主线程后备模式:', e);
}

function setStatus(text, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = isError ? 'status-text status-error' : 'status-text';
}

function setBusy(busy) {
    [btn_enc, btn_dec, btn_restore, btn_download].forEach(btn => {
        if (btn) btn.disabled = busy;
    });
}

function setsrc(src) {
    if (img.src && img.src.startsWith('blob:')) {
        URL.revokeObjectURL(img.src);
    }
    img.src = src;
    img.style.display = "inline-block";
}

/* ── 主线程后备算法（扁平坐标 + 32位像素） ── */
function generate2dFallback(x, y, ax, ay, bx, by, coords) {
    const w = Math.abs(ax + ay);
    const h = Math.abs(bx + by);
    const dax = Math.sign(ax), day = Math.sign(ay);
    const dbx = Math.sign(bx), dby = Math.sign(by);

    if (h === 1) {
        for (let i = 0; i < w; i++) {
            coords.push(x, y);
            x += dax; y += day;
        }
        return;
    }
    if (w === 1) {
        for (let i = 0; i < h; i++) {
            coords.push(x, y);
            x += dbx; y += dby;
        }
        return;
    }

    let ax2 = Math.floor(ax / 2), ay2 = Math.floor(ay / 2);
    let bx2 = Math.floor(bx / 2), by2 = Math.floor(by / 2);
    const w2 = Math.abs(ax2 + ay2);
    const h2 = Math.abs(bx2 + by2);

    if (2 * w > 3 * h) {
        if ((w2 % 2) && (w > 2)) { ax2 += dax; ay2 += day; }
        generate2dFallback(x, y, ax2, ay2, bx, by, coords);
        generate2dFallback(x + ax2, y + ay2, ax - ax2, ay - ay2, bx, by, coords);
    } else {
        if ((h2 % 2) && (h > 2)) { bx2 += dbx; by2 += dby; }
        generate2dFallback(x, y, bx2, by2, ax2, ay2, coords);
        generate2dFallback(x + bx2, y + by2, ax, ay, bx - bx2, by - by2, coords);
        generate2dFallback(x + (ax - dax) + (bx2 - dbx), y + (ay - day) + (by2 - dby),
            -bx2, -by2, -(ax - ax2), -(ay - ay2), coords);
    }
}

function processFallback(action, cvs, ctx, width, height, t0) {
    const imgdata = ctx.getImageData(0, 0, width, height);
    const imgdata2 = ctx.createImageData(width, height);
    const totalPixels = width * height;
    const src32 = new Uint32Array(imgdata.data.buffer);
    const dst32 = new Uint32Array(imgdata2.data.buffer);

    const coords = [];
    if (width >= height) generate2dFallback(0, 0, width, 0, 0, height, coords);
    else generate2dFallback(0, 0, 0, height, width, 0, coords);

    const offset = Math.round((Math.sqrt(5) - 1) / 2 * totalPixels);
    if (action === 'encrypt') {
        for (let i = 0; i < totalPixels; i++) {
            const oldX = coords[i * 2], oldY = coords[i * 2 + 1];
            const nextIdx = (i + offset) % totalPixels;
            const newX = coords[nextIdx * 2], newY = coords[nextIdx * 2 + 1];
            dst32[newX + newY * width] = src32[oldX + oldY * width];
        }
    } else {
        for (let i = 0; i < totalPixels; i++) {
            const oldX = coords[i * 2], oldY = coords[i * 2 + 1];
            const nextIdx = (i + offset) % totalPixels;
            const newX = coords[nextIdx * 2], newY = coords[nextIdx * 2 + 1];
            dst32[oldX + oldY * width] = src32[newX + newY * width];
        }
    }

    ctx.putImageData(imgdata2, 0, 0);
    cvs.toBlob(b => {
        setsrc(URL.createObjectURL(b));
        setBusy(false);
        const dt = (performance.now() - t0).toFixed(0);
        setStatus(`${action === 'encrypt' ? '混淆' : '解混淆'}完成（耗时 ${dt}ms）`);
    }, "image/jpeg", 1);
}

function processImage(action) {
    if (!img.src) return;
    const t0 = performance.now();
    setBusy(true);
    setStatus(`正在${action === 'encrypt' ? '混淆' : '解混淆'}中...`);

    const cvs = document.createElement("canvas");
    const width = cvs.width = img.naturalWidth || img.width;
    const height = cvs.height = img.naturalHeight || img.height;
    const ctx = cvs.getContext("2d");
    ctx.drawImage(img, 0, 0);

    if (worker) {
        const imgdata = ctx.getImageData(0, 0, width, height);
        const buffer = imgdata.data.buffer;

        worker.onmessage = function (e) {
            const resultBuf = e.data.buffer;
            const resImageData = new ImageData(new Uint8ClampedArray(resultBuf), width, height);
            ctx.putImageData(resImageData, 0, 0);
            cvs.toBlob(b => {
                setsrc(URL.createObjectURL(b));
                setBusy(false);
                const dt = (performance.now() - t0).toFixed(0);
                setStatus(`${action === 'encrypt' ? '混淆' : '解混淆'}完成（多线程加速，耗时 ${dt}ms）`);
            }, "image/jpeg", 1);
        };

        worker.onerror = function (err) {
            console.warn('[imageObfuscation] Worker 执行失败，转为主线程执行:', err);
            processFallback(action, cvs, ctx, width, height, t0);
        };

        // 零拷贝转移动画缓存
        worker.postMessage({ action, width, height, buffer }, [buffer]);
    } else {
        requestAnimationFrame(() => {
            setTimeout(() => {
                processFallback(action, cvs, ctx, width, height, t0);
            }, 10);
        });
    }
}

/* ── UI 事件监听 ─────────────────── */
ipt.onchange = () => {
    if (ipt.files.length > 0) {
        setsrc(URL.createObjectURL(ipt.files[0]));
        setStatus(`已载入图片：${ipt.files[0].name}`);
    }
};

btn_enc.onclick = () => processImage('encrypt');
btn_dec.onclick = () => processImage('decrypt');

btn_restore.onclick = () => {
    if (ipt.files.length > 0) {
        setsrc(URL.createObjectURL(ipt.files[0]));
        setStatus('已还原为原始图片');
    }
};

btn_download.onclick = () => {
    if (img.src && img.style.display !== "none") {
        const a = document.createElement('a');
        a.href = img.src;
        a.download = 'processed_image.jpg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
};
