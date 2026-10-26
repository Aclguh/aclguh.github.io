const { describe, it, expect } = require('../test-utils.js');
const fs = require('node:fs');
const path = require('node:path');

describe('Service Worker Precache & Route Integrity', () => {
    const swPath = path.resolve(__dirname, '../../sw.js');
    const swContent = fs.readFileSync(swPath, 'utf8');

    it('defines a valid cache version and cache name', () => {
        expect(swContent).toContain("const CACHE_VERSION = 'v6';");
        expect(swContent).toContain('const CACHE_NAME = `tomato-tools-${CACHE_VERSION}`;');
    });

    it('ensures all PRECACHE_URLS exist on the filesystem', () => {
        const match = swContent.match(/const PRECACHE_URLS = \[([\s\S]*?)\];/);
        expect(match).not.toBeNull();

        const urlsBlock = match[1];
        const urls = urlsBlock
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.startsWith("'./") || line.startsWith("'."))
            .map((line) => line.replace(/[',]/g, ''));

        expect(urls.length).toBeGreaterThan(15);

        const projectRoot = path.resolve(__dirname, '../../');
        for (const url of urls) {
            if (url === './') continue; // 根目录
            const relativePath = url.replace(/^\.\//, '');
            const absolutePath = path.join(projectRoot, relativePath);
            const exists = fs.existsSync(absolutePath);
            if (!exists) {
                throw new Error(`PRECACHE_URL file does not exist: ${relativePath} (${absolutePath})`);
            }
            expect(exists).toBe(true);
        }
    });

    it('excludes GitHub API requests from static caching', () => {
        expect(swContent).toContain("request.url.includes('api.github.com')");
    });
});
