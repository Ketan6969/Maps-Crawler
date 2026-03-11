"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const browserPool_1 = require("./services/browserPool");
const mapsScraper_1 = require("./services/mapsScraper");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function test() {
    console.log("Initializing browser pool...");
    await browserPool_1.browserPool.init();
    const context = await browserPool_1.browserPool.acquireContext();
    try {
        console.log("Scraping...");
        const results = await (0, mapsScraper_1.scrapeGoogleMaps)(context, "restaurant in vadodara, India", 5);
        console.log("Scrape successful. Results:");
        console.log(JSON.stringify(results, null, 2));
    }
    catch (e) {
        console.error("Error", e);
    }
    finally {
        console.log("Cleaning up...");
        await browserPool_1.browserPool.releaseContext(context);
        await browserPool_1.browserPool.destroy();
    }
}
test();
