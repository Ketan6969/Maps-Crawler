import { Router, Request, Response } from 'express';
import { metricsService } from '../services/metrics';
import { logger } from '../utils/logger';
import os from 'os';

const router = Router();

// GET /metrics
router.get('/metrics', (req: Request, res: Response) => {
    const crawlerMetrics = metricsService.getCrawlerMetrics();
    const systemMetrics = metricsService.getSystemMetrics();

    res.status(200).json({
        ...crawlerMetrics,
        ...systemMetrics
    });
});

// GET /jobs
router.get('/jobs', (req: Request, res: Response) => {
    const jobs = metricsService.getAllJobs();

    // Map to required JSON output format
    const response = jobs.map(job => ({
        id: job.id,
        domain: job.domain,
        status: job.status,
        duration: job.duration
    }));

    res.status(200).json(response);
});

// GET /health
router.get('/health', (req: Request, res: Response) => {
    const uptimeSeconds = process.uptime();
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);

    res.status(200).json({
        status: 'ok',
        uptime: `${hours}h${minutes}m`,
        version: 'v1'
    });
});

// GET /logs
router.get('/logs', (req: Request, res: Response) => {
    const logs = logger.getLogs(100); // Return last 100 logs
    res.status(200).json(logs);
});

// GET /domains - Extension for Task 6 to view domain rate limiting
router.get('/domains', (req: Request, res: Response) => {
    const domains = metricsService.getDomainMetrics();
    res.status(200).json(domains);
});

export default router;
