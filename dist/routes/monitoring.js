"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const metrics_1 = require("../services/metrics");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// GET /metrics
router.get('/metrics', (req, res) => {
    const crawlerMetrics = metrics_1.metricsService.getCrawlerMetrics();
    const systemMetrics = metrics_1.metricsService.getSystemMetrics();
    res.status(200).json({
        ...crawlerMetrics,
        ...systemMetrics
    });
});
// GET /jobs
router.get('/jobs', (req, res) => {
    const jobs = metrics_1.metricsService.getAllJobs();
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
router.get('/health', (req, res) => {
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
router.get('/logs', (req, res) => {
    const logs = logger_1.logger.getLogs(100); // Return last 100 logs
    res.status(200).json(logs);
});
// GET /domains - Extension for Task 6 to view domain rate limiting
router.get('/domains', (req, res) => {
    const domains = metrics_1.metricsService.getDomainMetrics();
    res.status(200).json(domains);
});
exports.default = router;
