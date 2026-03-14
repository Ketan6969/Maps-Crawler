"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const p_queue_1 = __importDefault(require("p-queue"));
const browserPool_1 = require("../services/browserPool");
const mapsScraper_1 = require("../services/mapsScraper");
const metrics_1 = require("../services/metrics");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// Create a concurrency queue to ensure we don't overwhelm the browser pool or system memory.
// It will process up to MAX_BROWSERS jobs concurrently.
const maxConcurrency = parseInt(process.env.MAX_BROWSERS || '3', 10);
const queue = new p_queue_1.default({ concurrency: maxConcurrency });
router.post('/search', async (req, res) => {
    const { query, limit = 50 } = req.body;
    if (!query) {
        res.status(400).json({ error: 'Query parameter is required' });
        return;
    }
    const parsedLimit = parseInt(limit, 10);
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
        res.status(400).json({ error: 'Limit must be a positive integer' });
        return;
    }
    // Adding job to queue
    const jobId = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    metrics_1.metricsService.createJob(jobId, query);
    logger_1.logger.info('job_queued', 'google.com', jobId, { query, limit: parsedLimit });
    console.log(`[API] Queueing search request for: "${query}" (limit: ${parsedLimit})`);
    try {
        const results = await queue.add(async () => {
            metrics_1.metricsService.updateJobStatus(jobId, 'running');
            // 1. Acquire a browser context
            const context = await browserPool_1.browserPool.acquireContext();
            try {
                // 2. Execute scraping job
                return await (0, mapsScraper_1.scrapeGoogleMaps)(context, query, parsedLimit, jobId);
            }
            finally {
                // 3. Always release context back to pool!
                await browserPool_1.browserPool.releaseContext(context);
            }
        });
        metrics_1.metricsService.updateJobStatus(jobId, 'completed');
        logger_1.logger.info('crawl_completed', 'google.com', jobId, { count: results?.length });
        res.status(200).json({
            query,
            count: results?.length || 0,
            results
        });
    }
    catch (error) {
        metrics_1.metricsService.updateJobStatus(jobId, 'failed');
        logger_1.logger.error('crawl_failed', 'google.com', jobId, { error: error.message });
        console.error(`[API] Job failed with error: ${error.message}`);
        res.status(500).json({
            error: 'Scraping job failed',
            details: error.message
        });
    }
});
exports.default = router;
