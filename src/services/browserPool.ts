import { chromium, Browser, BrowserContext } from 'playwright';
import { getRandomUserAgent } from '../utils/randomUserAgent';

interface PoolConfig {
    maxBrowsers: number;
    maxJobsPerBrowser: number;
}

const DEFAULT_CONFIG: PoolConfig = {
    maxBrowsers: parseInt(process.env.MAX_BROWSERS || '3', 10),
    maxJobsPerBrowser: 50, // Restart browser after this many jobs to prevent memory leaks
};

class BrowserPool {
    private browsers: Array<{
        browser: Browser;
        context: BrowserContext;
        jobsCompleted: number;
        inUse: boolean;
    }> = [];

    private config: PoolConfig;
    private initializing = false;

    constructor(config: Partial<PoolConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Initialize the pool by booting up browsers.
     */
    async init() {
        if (this.initializing) return;
        this.initializing = true;

        console.log(`[BrowserPool] Initializing ${this.config.maxBrowsers} browsers...`);

        const promises = Array.from({ length: this.config.maxBrowsers }).map(() => this.createBrowserInstance());
        await Promise.all(promises);

        console.log(`[BrowserPool] Initialization complete. Available contexts: ${this.browsers.length}`);
        this.initializing = false;
    }

    /**
     * Creates a single browser and context pair and adds to the pool.
     */
    private async createBrowserInstance() {
        const browser = await chromium.launch({
            headless: process.env.HEADLESS !== 'false',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });

        const context = await browser.newContext({
            userAgent: getRandomUserAgent(),
            viewport: { width: 1280, height: 800 },
            deviceScaleFactor: 1,
            locale: 'en-US',
            permissions: ['geolocation']
        });

        // Mask webdriver
        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        this.browsers.push({
            browser,
            context,
            jobsCompleted: 0,
            inUse: false
        });
    }

    /**
     * Acquire a browser context from the pool.
     * If all are heavily used or max jobs reached, recreates one.
     */
    async acquireContext(): Promise<BrowserContext> {
        // Wait until at least one is free
        let instance = this.browsers.find(b => !b.inUse);

        while (!instance) {
            await new Promise(r => setTimeout(r, 500));
            instance = this.browsers.find(b => !b.inUse);
        }

        instance.inUse = true;

        // Check if it needs a restart based on job limit
        if (instance.jobsCompleted >= this.config.maxJobsPerBrowser) {
            console.log(`[BrowserPool] Restarting heavily used browser (completed ${instance.jobsCompleted} jobs)...`);
            await this.releaseInstance(instance);
            await this.createBrowserInstance();
            // Re-acquire the newly created instance
            instance = this.browsers[this.browsers.length - 1];
            instance.inUse = true;
        }

        return instance.context;
    }

    /**
     * Release a context back to the pool after job completion.
     */
    async releaseContext(context: BrowserContext) {
        const instance = this.browsers.find(b => b.context === context);
        if (instance) {
            instance.jobsCompleted += 1;
            instance.inUse = false;

            // Clear cookies/storage to reset state for next job
            await context.clearCookies();
        }
    }

    /**
     * Completely shut down an instance.
     */
    private async releaseInstance(instance: any) {
        this.browsers = this.browsers.filter(b => b !== instance);
        await instance.context.close().catch(() => { });
        await instance.browser.close().catch(() => { });
    }

    /**
     * Closes all browsers.
     */
    async destroy() {
        console.log('[BrowserPool] Destroying all browsers...');
        await Promise.all(this.browsers.map(b => this.releaseInstance(b)));
    }
}

export const browserPool = new BrowserPool();
