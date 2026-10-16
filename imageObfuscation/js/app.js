/**
 * 小番茄图片混淆 — 基于空间填充曲线 (Gilbert curve)
 * 支持 Web Worker 多线程处理与 32位像素流水线
 */

const img = document.getElementById('display-img');
const statusEl = document.getElementById('status');
const ipt = document.getElementById('ipt');
const btn_enc = document.getElementById('enc');
const btn_dec = document.getElementById('dec');
const btn_restore = document.getElementById('re');
const btn_download = document.getElementById('download');

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
    [btn_enc, btn_dec, btn_restore, btn_download].forEach((btn) => {
        if (btn) btn.disabled = busy;
    });
}

function setsrc(src) {
    if (img.src && img.src.startsWith('blob:')) {
        URL.revokeObjectURL(img.src);
    }
    img.src = src;
    img.style.display = 'inline-block';
}

/* ── 主线程后备算法（复用共享的 gilbert.js） ── */
function processFallback(action, cvs, ctx, width, height, t0) {
    const imgdata = ctx.getImageData(0, 0, width, height);
    const imgdata2 = ctx.createImageData(width, height);
    const src32 = new Uint32Array(imgdata.data.buffer);
    const dst32 = new Uint32Array(imgdata2.data.buffer);

    GilbertObfuscation.transformPixels(src32, dst32, width, height, action === 'encrypt');

    ctx.putImageData(imgdata2, 0, 0);
    cvs.toBlob(
        (b) => {
            setsrc(URL.createObjectURL(b));
            setBusy(false);
            const dt = (performance.now() - t0).toFixed(0);
            setStatus(`${action === 'encrypt' ? '混淆' : '解混淆'}完成（耗时 ${dt}ms）`);
        },
        'image/jpeg',
        1
    );
}

function processImage(action) {
    if (!img.src) return;
    const t0 = performance.now();
    setBusy(true);
    setStatus(`正在${action === 'encrypt' ? '混淆' : '解混淆'}中...`);

    const cvs = document.createElement('canvas');
    const width = (cvs.width = img.naturalWidth || img.width);
    const height = (cvs.height = img.naturalHeight || img.height);
    const ctx = cvs.getContext('2d');
    ctx.drawImage(img, 0, 0);

    if (worker) {
        const imgdata = ctx.getImageData(0, 0, width, height);
        const buffer = imgdata.data.buffer;

        worker.onmessage = function (e) {
            const resultBuf = e.data.buffer;
            const resImageData = new ImageData(new Uint8ClampedArray(resultBuf), width, height);
            ctx.putImageData(resImageData, 0, 0);
            cvs.toBlob(
                (b) => {
                    setsrc(URL.createObjectURL(b));
                    setBusy(false);
                    const dt = (performance.now() - t0).toFixed(0);
                    setStatus(`${action === 'encrypt' ? '混淆' : '解混淆'}完成（多线程加速，耗时 ${dt}ms）`);
                },
                'image/jpeg',
                1
            );
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
    if (img.src && img.style.display !== 'none') {
        const a = document.createElement('a');
        a.href = img.src;
        a.download = 'processed_image.jpg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
};
