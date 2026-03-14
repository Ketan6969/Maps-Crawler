"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeGoogleMaps = void 0;
const p_queue_1 = __importDefault(require("p-queue"));
const parser_1 = require("../utils/parser");
const delay_1 = require("../utils/delay");
const logger_1 = require("../utils/logger");
const metrics_1 = require("../services/metrics");
const scrapeGoogleMaps = async (context, query, limit = 20, jobId) => {
    const page = await context.newPage();
    const results = [];
    // Rate limiting & Interaction simulation setup
    const minDelay = parseInt(process.env.SCRAPER_DELAY_MIN || '2000', 10);
    const maxDelay = parseInt(process.env.SCRAPER_DELAY_MAX || '6000', 10);
    // Big initial wait for rate limiting searches
    const searchDelayMin = 5000;
    const searchDelayMax = 10000;
    try {
        logger_1.logger.info('crawl_started', 'google.com', jobId, { query, limit });
        console.log(`[Scraper] Starting scrape for query: "${query}" (limit: ${limit})`);
        metrics_1.metricsService.incrementRequest('google.com'); // Track domain rate on main maps search
        // Rate limit starting actions
        await (0, delay_1.randomDelay)(searchDelayMin, searchDelayMax);
        // 1. Navigate to Google Maps (with retry for flaky Chromium network changes)
        let loaded = false;
        for (let attempt = 0; attempt < 3 && !loaded; attempt++) {
            try {
                metrics_1.metricsService.incrementRequest('google.com'); // Increment on retry as well
                await page.goto('https://www.google.com/maps', { waitUntil: 'domcontentloaded', timeout: 30000 });
                loaded = true;
            }
            catch (e) {
                logger_1.logger.warn('retry', 'google.com', jobId, { attempt: attempt + 1, error: e.message });
                metrics_1.metricsService.incrementRetry();
                console.warn(`[Scraper] Network load issue (attempt ${attempt + 1}): ${e.message}`);
                await (0, delay_1.randomDelay)(2000, 4000);
            }
        }
        if (!loaded) {
            logger_1.logger.error('timeout', 'google.com', jobId, { message: 'Failed to fully load map DOM after 3 attempts' });
            throw new Error("Failed to load Google Maps after 3 attempts");
        }
        await (0, delay_1.randomDelay)(minDelay, maxDelay);
        // Accept cookies if present
        try {
            const consentButton = page.locator('button:has-text("Accept all"), button:has-text("I agree")');
            if (await consentButton.isVisible({ timeout: 2000 })) {
                await consentButton.click();
                await (0, delay_1.randomDelay)(1000, 2000);
            }
        }
        catch (e) { }
        // 2. Search for the query
        const searchbox = page.locator('input#searchboxinput, input[name="q"]').first();
        await searchbox.waitFor({ state: 'visible', timeout: 10000 });
        // Move mouse to search box before clicking
        const bbSearch = await searchbox.boundingBox();
        if (bbSearch) {
            await page.mouse.move(bbSearch.x + bbSearch.width / 2, bbSearch.y + bbSearch.height / 2, { steps: 5 });
            await (0, delay_1.randomDelay)(300, 800);
        }
        // Type slowly like a human
        await searchbox.fill(query);
        await (0, delay_1.randomDelay)(500, 1500);
        await page.keyboard.press('Enter');
        console.log(`[Scraper] Search submitted. Waiting for results panel.`);
        // 3. Wait for the results pane to load, or handle "No results" gracefully.
        const feed = page.locator('div[role="feed"]');
        try {
            await feed.waitFor({ state: 'attached', timeout: 10000 });
        }
        catch (e) {
            console.log(`[Scraper] Results feed did not load. Checking for empty state...`);
            const noResults = page.locator('text="Google Maps can\'t find"');
            if (await noResults.isVisible()) {
                console.log(`[Scraper] Empty results confirmed.`);
                return []; // Return empty array naturally
            }
            logger_1.logger.warn('timeout', 'google.com', jobId, { message: "Timeout waiting for feed panel to attach." });
            throw new Error("Timeout waiting for feed panel to attach.");
        }
        await (0, delay_1.randomDelay)(minDelay, maxDelay);
        // 4. Scroll and collect URLs and partial data from the feed
        const placesMap = new Map();
        let retries = 0;
        while (placesMap.size < limit && retries < 5) {
            const itemSelector = 'div[role="feed"] a[href*="/maps/place/"]';
            const locators = await page.locator(itemSelector).all();
            if (locators.length === 0) {
                console.log(`[Scraper] 0 locators found. Dumping HTML for debugging.`);
                try {
                    await page.screenshot({ path: '/tmp/scraper-debug-screenshot.png' });
                    const html = await feed.innerHTML();
                    require('fs').writeFileSync('/tmp/scraper-debug-feed.html', html);
                }
                catch (e) { }
            }
            let added = false;
            for (let i = 0; i < locators.length; i++) {
                const freshLocators = await page.locator(itemSelector).all();
                if (i >= freshLocators.length)
                    break;
                const loc = freshLocators[i];
                const href = await loc.getAttribute('href');
                if (href && !placesMap.has(href)) {
                    const cardLocator = loc.locator('..');
                    try {
                        const baseData = await (0, parser_1.parseBusinessCard)(page, cardLocator);
                        const name = await cardLocator.evaluate(el => el.getAttribute('aria-label') || el.querySelector('.fontHeadlineSmall')?.textContent || '');
                        if (!baseData.name)
                            baseData.name = name;
                        placesMap.set(href, baseData);
                        added = true;
                    }
                    catch (e) {
                        console.error(`[Scraper] Base extracted failed for locator:`, e);
                    }
                }
                if (placesMap.size >= limit)
                    break;
            }
            console.log(`[Scraper] Discovered ${placesMap.size}/${limit} places from feed...`);
            if (placesMap.size >= limit)
                break;
            // Scroll down the feed smoothly and human-like
            const feedHandle = await feed.elementHandle();
            if (feedHandle) {
                const prevHeight = await feedHandle.evaluate(node => node.scrollHeight);
                // Human scrolling simulation inside the feed
                const scrollAmount = 1500;
                const steps = 4;
                for (let s = 0; s < steps; s++) {
                    await feedHandle.evaluate((node, stepSize) => node.scrollBy(0, stepSize), scrollAmount / steps);
                    // Randomly wiggle mouse to appear active
                    const rx = Math.floor(Math.random() * 800) + 100;
                    const ry = Math.floor(Math.random() * 600) + 100;
                    await page.mouse.move(rx, ry, { steps: 3 });
                    await (0, delay_1.randomDelay)(200, 600);
                }
                // Pause after full scroll
                await (0, delay_1.randomDelay)(minDelay, maxDelay);
                const newHeight = await feedHandle.evaluate(node => node.scrollHeight);
                const endIndicator = page.locator('text="You\'ve reached the end of the list."');
                if (await endIndicator.isVisible() || (newHeight === prevHeight && !added)) {
                    retries++;
                    if (retries >= 3) {
                        console.log(`[Scraper] Reached end of list or cannot scroll further.`);
                        break;
                    }
                }
                else {
                    retries = 0;
                }
            }
            else {
                break;
            }
        }
        console.log(`[Scraper] Discovered total ${placesMap.size} places. Extracting deep details...`);
        // 5. Navigate to each URL to extract full details including missing phone and website concurrently
        const extractQueue = new p_queue_1.default({ concurrency: 5 }); // 5 concurrent detail tabs per browser
        await Promise.all(Array.from(placesMap.entries()).map(([url, baseData]) => extractQueue.add(async () => {
            const detailPage = await context.newPage();
            try {
                const domainMatch = url.match(/^https?:\/\/([^/?#]+)(?:[/?#]|$)/i);
                const domain = domainMatch ? domainMatch[1] : 'google.com';
                metrics_1.metricsService.incrementRequest(domain);
                // Listen for blockages
                detailPage.on('response', (response) => {
                    if (response.status() === 429) {
                        metrics_1.metricsService.incrementBlocked();
                        logger_1.logger.error('request_blocked', domain, jobId, { url: response.url(), status: 429 });
                    }
                });
                await detailPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                logger_1.logger.info('page_fetched', domain, jobId, { business: baseData.name });
                // Wait for h1 to load
                await detailPage.waitForSelector('h1', { timeout: 10000 }).catch(() => { });
                await (0, delay_1.randomDelay)(1000, 2000);
                const deepDetails = await detailPage.evaluate(() => {
                    const phoneNode = document.querySelector('button[data-item-id^="phone:tel:"]');
                    let phone = null;
                    if (phoneNode) {
                        phone = phoneNode.getAttribute('data-item-id')?.replace('phone:tel:', '') || null;
                        if (!phone || phone.length < 3)
                            phone = phoneNode.getAttribute('aria-label');
                        if (phone && phone.includes(':'))
                            phone = phone.split(':')[1].trim();
                        if (!phone)
                            phone = phoneNode.textContent?.trim() || null;
                    }
                    const webNode = document.querySelector('a[data-item-id="authority"], a[data-tooltip="Open website"]');
                    const website = webNode ? webNode.getAttribute('href') : null;
                    const addrNode = document.querySelector('button[data-item-id="address"], button[data-tooltip="Copy address"]');
                    let address = addrNode ? addrNode.getAttribute('aria-label') : null;
                    if (address && address.includes(':'))
                        address = address.split(':')[1].trim();
                    if (!address && addrNode)
                        address = addrNode.textContent?.trim() || null;
                    if (address && address.toLowerCase().startsWith('address:')) {
                        address = address.substring(8).trim();
                    }
                    // Also grab rating/reviews just in case they were missing from list card
                    let rating = null;
                    let reviews = null;
                    const ratingText = document.querySelector('div.F7nice')?.textContent || '';
                    if (ratingText) {
                        const rMatch = ratingText.match(/([\d.]+)/);
                        if (rMatch)
                            rating = parseFloat(rMatch[1]);
                        const revMatch = ratingText.replace(/,/g, '').match(/\(([\d]+)\)/);
                        if (revMatch)
                            reviews = parseInt(revMatch[1], 10);
                    }
                    const catNode = document.querySelector('button.DkEaL');
                    let category = catNode ? catNode.textContent?.trim() : null;
                    return { phone, website, address, rating, reviews, category };
                });
                // Merge Data
                const merged = {
                    name: baseData.name || 'Unknown',
                    rating: baseData.rating || deepDetails.rating,
                    reviews: baseData.reviews || deepDetails.reviews,
                    category: baseData.category || deepDetails.category,
                    phone: deepDetails.phone?.length ? deepDetails.phone : (baseData.phone || null),
                    website: deepDetails.website?.length ? deepDetails.website : (baseData.website || null),
                    address: deepDetails.address?.length ? deepDetails.address : (baseData.address || null)
                };
                // Clean up missing strings
                if (merged.phone && merged.phone.length < 3)
                    merged.phone = null;
                if (merged.website && (merged.website.includes('google.com') || merged.website.length < 5))
                    merged.website = null;
                // If the URL has website starting with /, prepend map host
                if (merged.website && merged.website.startsWith('/')) {
                    merged.website = "https://www.google.com" + merged.website;
                }
                // Use lock mechanism or push safely
                results.push(merged);
                console.log(`[Scraper] Extracted details for: ${merged.name} (${extractQueue.size} items left in queue)`);
            }
            catch (e) {
                console.error(`[Scraper] Failed to extract details for ${url}:`, e);
                // push base data so we don't return nothing
                results.push({
                    name: baseData.name || 'Unknown',
                    rating: baseData.rating || null,
                    reviews: baseData.reviews || null,
                    category: baseData.category || null,
                    phone: baseData.phone || null,
                    website: baseData.website || null,
                    address: baseData.address || null
                });
            }
            finally {
                await detailPage.close().catch(() => { });
            }
        })));
    }
    catch (error) {
        console.error(`[Scraper] Error during scraping: ${error}`);
        throw error;
    }
    finally {
        console.log(`[Scraper] Closing original search page.`);
        await page.close().catch(() => { });
    }
    return results;
};
exports.scrapeGoogleMaps = scrapeGoogleMaps;
