import { browserPool } from './services/browserPool';
import { scrapeGoogleMaps } from './services/mapsScraper';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    console.log("Initializing browser pool...");
    await browserPool.init();
    const context = await browserPool.acquireContext();
    try {
        console.log("Scraping...");
        const results = await scrapeGoogleMaps(context, "mobile repair in Vadodara, India", 2);
        console.log("Scrape successful. Results:");
        console.log(JSON.stringify(results, null, 2));
    } catch (e) {
        console.error("Error", e);
    } finally {
        console.log("Cleaning up...");
        await browserPool.releaseContext(context);
        await browserPool.destroy();
    }
}

test();
