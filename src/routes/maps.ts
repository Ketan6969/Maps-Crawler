import { Router, Request, Response } from 'express';
import PQueue from 'p-queue';
import { browserPool } from '../services/browserPool';
import { scrapeGoogleMaps } from '../services/mapsScraper';
import { Business } from '../types/business';

const router = Router();

// Create a concurrency queue to ensure we don't overwhelm the browser pool or system memory.
// It will process up to MAX_BROWSERS jobs concurrently.
const maxConcurrency = parseInt(process.env.MAX_BROWSERS || '3', 10);
const queue = new PQueue({ concurrency: maxConcurrency });

// Define 
interface SearchRequestBody {
    query: string;
    limit?: number;
}

router.post('/search', async (req: Request, res: Response): Promise<void> => {

    const { query, limit = 50 } = req.body as SearchRequestBody;

    if (!query) {
        res.status(400).json({ error: 'Query parameter is required' });
        return;
    }

    const parsedLimit = parseInt(limit as any, 10);
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
        res.status(400).json({ error: 'Limit must be a positive integer' });
        return;
    }

    // Adding job to queue
    console.log(`[API] Queueing search request for: "${query}" (limit: ${parsedLimit})`);

    try {
        const results = await queue.add(async (): Promise<Business[]> => {
            // 1. Acquire a browser context
            const context = await browserPool.acquireContext();
            try {
                // 2. Execute scraping job
                return await scrapeGoogleMaps(context, query, parsedLimit);
            } finally {
                // 3. Always release context back to pool!
                await browserPool.releaseContext(context);
            }
        });

        res.status(200).json({
            query,
            count: results?.length || 0,
            results
        });
    } catch (error: any) {
        console.error(`[API] Job failed with error: ${error.message}`);
        res.status(500).json({
            error: 'Scraping job failed',
            details: error.message
        });
    }
});

export default router;
