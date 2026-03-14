"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsService = void 0;
const os_1 = __importDefault(require("os"));
class MetricsService {
    jobs = new Map();
    metrics = {
        active_crawls: 0,
        queued_jobs: 0,
        completed_jobs: 0,
        failed_jobs: 0,
        requests_per_second: 0,
        avg_crawl_time: 0,
        timeouts: 0,
        retries: 0,
        blocked_requests: 0,
    };
    // For domain rate limiting tracking
    domainRequests = new Map();
    // For calculating requests per second
    totalRequestsInWindow = 0;
    windowStartTime = Date.now();
    totalCrawlTimeSeconds = 0;
    constructor() {
        // Reset rps window every 10 seconds
        setInterval(() => {
            const elapsedSeconds = (Date.now() - this.windowStartTime) / 1000;
            this.metrics.requests_per_second = elapsedSeconds > 0
                ? Number((this.totalRequestsInWindow / elapsedSeconds).toFixed(2))
                : 0;
            this.totalRequestsInWindow = 0;
            this.windowStartTime = Date.now();
        }, 10000);
    }
    // --- Job Management ---
    createJob(id, domain) {
        const job = {
            id,
            domain,
            status: 'queued',
            startedAt: null,
            finishedAt: null,
            duration: null
        };
        this.jobs.set(id, job);
        this.metrics.queued_jobs++;
        return job;
    }
    updateJobStatus(id, status) {
        const job = this.jobs.get(id);
        if (!job)
            return;
        // Transition logic
        if (job.status === 'queued' && status === 'running') {
            this.metrics.queued_jobs = Math.max(0, this.metrics.queued_jobs - 1);
            this.metrics.active_crawls++;
            job.startedAt = new Date();
        }
        if (['running'].includes(job.status) && ['completed', 'failed', 'timeout'].includes(status)) {
            this.metrics.active_crawls = Math.max(0, this.metrics.active_crawls - 1);
            job.finishedAt = new Date();
            if (job.startedAt) {
                job.duration = (job.finishedAt.getTime() - job.startedAt.getTime()) / 1000;
                // Update average crawl time
                if (status === 'completed') {
                    this.totalCrawlTimeSeconds += job.duration;
                    this.metrics.completed_jobs++;
                    this.metrics.avg_crawl_time = Number((this.totalCrawlTimeSeconds / this.metrics.completed_jobs).toFixed(2));
                }
            }
            if (status === 'failed')
                this.metrics.failed_jobs++;
            if (status === 'timeout') {
                this.metrics.timeouts++;
                this.metrics.failed_jobs++;
            }
        }
        job.status = status;
        this.jobs.set(id, job);
    }
    getJob(id) {
        return this.jobs.get(id);
    }
    getAllJobs() {
        return Array.from(this.jobs.values());
    }
    // --- Metrics Tracking ---
    incrementRequest(domain = 'google.com') {
        this.totalRequestsInWindow++;
        const currentCount = this.domainRequests.get(domain) || 0;
        this.domainRequests.set(domain, currentCount + 1);
    }
    incrementRetry() {
        this.metrics.retries++;
    }
    incrementBlocked() {
        this.metrics.blocked_requests++;
    }
    getCrawlerMetrics() {
        return { ...this.metrics };
    }
    getDomainMetrics() {
        return Object.fromEntries(this.domainRequests);
    }
    // --- OS Monitoring ---
    getSystemMetrics() {
        const totalMem = os_1.default.totalmem();
        const memoryUsage = process.memoryUsage();
        const usedMem = memoryUsage.rss; // Resident Set Size (memory allocated to this exact process)
        // Approximate CPU usage (a very simple representation, precise CPU % over time requires sampling)
        const loadAvg = os_1.default.loadavg();
        const cpuCount = os_1.default.cpus().length;
        const cpuPercent = (loadAvg[0] / cpuCount) * 100;
        return {
            memory_used: `${(usedMem / 1024 / 1024).toFixed(2)}MB`,
            memory_total: `${(totalMem / 1024 / 1024).toFixed(2)}MB`,
            cpu_usage: `${cpuPercent.toFixed(2)}%`,
            // Node.js alternative to "goroutines"
            active_handles: process._getActiveHandles ? process._getActiveHandles().length : 0,
            active_requests: process._getActiveRequests ? process._getActiveRequests().length : 0
        };
    }
}
exports.metricsService = new MetricsService();
