import { BrowserContext } from 'playwright';
import { Business } from '../types/business';
import { parseBusinessCard } from '../utils/parser';
import { randomDelay } from '../utils/delay';

export const scrapeGoogleMaps = async (
    context: BrowserContext,
    query: string,
    limit: number = 20
): Promise<Business[]> => {
    const page = await context.newPage();
    const results: Business[] = [];
    const minDelay = parseInt(process.env.SCRAPER_DELAY_MIN || '1000', 10);
    const maxDelay = parseInt(process.env.SCRAPER_DELAY_MAX || '3000', 10);

    try {
        console.log(`[Scraper] Starting scrape for query: "${query}" (limit: ${limit})`);

        // 1. Navigate to Google Maps
        await page.goto('https://www.google.com/maps', { waitUntil: 'domcontentloaded' });
        await randomDelay(minDelay, maxDelay);

        // Accept cookies if present
        try {
            const consentButton = page.locator('button:has-text("Accept all"), button:has-text("I agree")');
            if (await consentButton.isVisible({ timeout: 2000 })) {
                await consentButton.click();
                await randomDelay(1000, 2000);
            }
        } catch (e) { }

        // 2. Search for the query
        const searchbox = page.locator('input#searchboxinput, input[name="q"]').first();
        await searchbox.waitFor({ state: 'visible', timeout: 10000 });
        await searchbox.fill(query);
        await randomDelay(500, 1000);
        await page.keyboard.press('Enter');

        console.log(`[Scraper] Search submitted. Waiting for results panel.`);

        // 3. Wait for the results pane to load.
        const feed = page.locator('div[role="feed"]');
        await feed.waitFor({ state: 'attached', timeout: 15000 });
        await randomDelay(minDelay, maxDelay);

        // 4. Scroll and collect URLs and partial data from the feed
        const placesMap = new Map<string, Partial<Business>>();
        let retries = 0;

        while (placesMap.size < limit && retries < 5) {
            const itemSelector = 'div[role="feed"] a[href*="/maps/place/"]';
            const locators = await page.locator(itemSelector).all();

            let added = false;
            for (let i = 0; i < locators.length; i++) {
                const freshLocators = await page.locator(itemSelector).all();
                if (i >= freshLocators.length) break;
                const loc = freshLocators[i];

                const href = await loc.getAttribute('href');
                if (href && !placesMap.has(href)) {
                    const cardLocator = loc.locator('..');
                    try {
                        const baseData = await parseBusinessCard(page, cardLocator);
                        const name = await cardLocator.evaluate(el => el.getAttribute('aria-label') || el.querySelector('.fontHeadlineSmall')?.textContent || '');
                        if (!baseData.name) baseData.name = name;
                        placesMap.set(href, baseData);
                        added = true;
                    } catch (e) { /* ignore parse error for one card */ }
                }
                if (placesMap.size >= limit) break;
            }

            console.log(`[Scraper] Discovered ${placesMap.size}/${limit} places from feed...`);

            if (placesMap.size >= limit) break;

            // Scroll down the feed
            const feedHandle = await feed.elementHandle();
            if (feedHandle) {
                const prevHeight = await feedHandle.evaluate(node => node.scrollHeight);

                await feedHandle.evaluate(node => node.scrollBy(0, 1500));
                await randomDelay(minDelay, maxDelay);

                const newHeight = await feedHandle.evaluate(node => node.scrollHeight);

                const endIndicator = page.locator('text="You\'ve reached the end of the list."');
                if (await endIndicator.isVisible() || (newHeight === prevHeight && !added)) {
                    retries++;
                    if (retries >= 3) {
                        console.log(`[Scraper] Reached end of list or cannot scroll further.`);
                        break;
                    }
                } else {
                    retries = 0;
                }
            } else {
                break;
            }
        }

        console.log(`[Scraper] Discovered total ${placesMap.size} places. Extracting deep details...`);

        // 5. Navigate to each URL to extract full details including missing phone and website
        for (const [url, baseData] of Array.from(placesMap.entries())) {
            const detailPage = await context.newPage();
            try {
                await detailPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Wait for h1 to load
                await detailPage.waitForSelector('h1', { timeout: 10000 }).catch(() => { });
                await randomDelay(1000, 2000);

                const deepDetails = await detailPage.evaluate(() => {
                    const phoneNode = document.querySelector('button[data-item-id^="phone:tel:"]');
                    let phone = null;
                    if (phoneNode) {
                        phone = phoneNode.getAttribute('data-item-id')?.replace('phone:tel:', '') || null;
                        if (!phone || phone.length < 3) phone = phoneNode.getAttribute('aria-label');
                        if (phone && phone.includes(':')) phone = phone.split(':')[1].trim();
                        if (!phone) phone = phoneNode.textContent?.trim() || null;
                    }

                    const webNode = document.querySelector('a[data-item-id="authority"], a[data-tooltip="Open website"]');
                    const website = webNode ? webNode.getAttribute('href') : null;

                    const addrNode = document.querySelector('button[data-item-id="address"], button[data-tooltip="Copy address"]');
                    let address = addrNode ? addrNode.getAttribute('aria-label') : null;
                    if (address && address.includes(':')) address = address.split(':')[1].trim();
                    if (!address && addrNode) address = addrNode.textContent?.trim() || null;
                    if (address && address.toLowerCase().startsWith('address:')) {
                        address = address.substring(8).trim();
                    }

                    // Also grab rating/reviews just in case they were missing from list card
                    let rating = null;
                    let reviews = null;
                    const ratingText = document.querySelector('div.F7nice')?.textContent || '';
                    if (ratingText) {
                        const rMatch = ratingText.match(/([\d.]+)/);
                        if (rMatch) rating = parseFloat(rMatch[1]);
                        const revMatch = ratingText.replace(/,/g, '').match(/\(([\d]+)\)/);
                        if (revMatch) reviews = parseInt(revMatch[1], 10);
                    }

                    const catNode = document.querySelector('button.DkEaL');
                    let category = catNode ? catNode.textContent?.trim() : null;

                    return { phone, website, address, rating, reviews, category };
                });

                // Merge Data
                const merged: Business = {
                    name: baseData.name || 'Unknown',
                    rating: baseData.rating || deepDetails.rating,
                    reviews: baseData.reviews || deepDetails.reviews,
                    category: baseData.category || deepDetails.category,
                    phone: deepDetails.phone?.length ? deepDetails.phone : (baseData.phone || null),
                    website: deepDetails.website?.length ? deepDetails.website : (baseData.website || null),
                    address: deepDetails.address?.length ? deepDetails.address : (baseData.address || null)
                };

                // Clean up missing strings
                if (merged.phone && merged.phone.length < 3) merged.phone = null;
                if (merged.website && (merged.website.includes('google.com') || merged.website.length < 5)) merged.website = null;

                // If the URL has website starting with /, prepend map host
                if (merged.website && merged.website.startsWith('/')) {
                    merged.website = "https://www.google.com" + merged.website;
                }

                results.push(merged);
                console.log(`[Scraper] Extracted details for: ${merged.name}`);

            } catch (e) {
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
            } finally {
                await detailPage.close().catch(() => { });
            }
        }

    } catch (error) {
        console.error(`[Scraper] Error during scraping: ${error}`);
        throw error;
    } finally {
        console.log(`[Scraper] Closing original search page.`);
        await page.close().catch(() => { });
    }

    return results;
};
