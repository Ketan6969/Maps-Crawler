"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.browserPool = void 0;
const playwright_1 = require("playwright");
const randomUserAgent_1 = require("../utils/randomUserAgent");
const stealth_1 = require("../utils/stealth");
const DEFAULT_CONFIG = {
    maxBrowsers: parseInt(process.env.MAX_BROWSERS || '3', 10),
    maxJobsPerBrowser: 50, // Restart browser after this many jobs to prevent memory leaks
};
class BrowserPool {
    browsers = [];
    config;
    initializing = false;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Initialize the pool by booting up browsers.
     */
    async init() {
        if (this.initializing)
            return;
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
    async createBrowserInstance() {
        const proxyConfig = process.env.PROXY_SERVER ? {
            server: process.env.PROXY_SERVER,
            username: process.env.PROXY_USERNAME,
            password: process.env.PROXY_PASSWORD
        } : undefined;
        const browser = await playwright_1.chromium.launch({
            headless: process.env.HEADLESS !== 'false',
            proxy: proxyConfig,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-blink-features=AutomationControlled'
            ]
        });
        const context = await browser.newContext({
            userAgent: (0, randomUserAgent_1.getRandomUserAgent)(),
            viewport: { width: 1366, height: 768 },
            deviceScaleFactor: 1,
            locale: 'en-IN',
            timezoneId: 'Asia/Kolkata',
            geolocation: { longitude: 77.2090, latitude: 28.6139 },
            permissions: ['geolocation']
        });
        // Mask webdriver and inject stealth properties
        await context.addInitScript(stealth_1.stealthScript);
        // Block resources to save RAM and network bandwidth
        await context.route('**/*', (route) => {
            const resourceType = route.request().resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                route.abort();
            }
            else {
                route.continue();
            }
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
    async acquireContext() {
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
    async releaseContext(context) {
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
    async releaseInstance(instance) {
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
exports.browserPool = new BrowserPool();
