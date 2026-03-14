import os from 'os';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'timeout';

export interface CrawlJob {
    id: string;
    domain: string;
    status: JobStatus;
    startedAt: Date | null;
    finishedAt: Date | null;
    duration: number | null; // in seconds
}

export interface CrawlerMetrics {
    active_crawls: number;
    queued_jobs: number;
    completed_jobs: number;
    failed_jobs: number;
    requests_per_second: number;
    avg_crawl_time: number; // in seconds
    timeouts: number;
    retries: number;
    blocked_requests: number;
}

class MetricsService {
    private jobs: Map<string, CrawlJob> = new Map();
    private metrics: CrawlerMetrics = {
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
    private domainRequests: Map<string, number> = new Map();

    // For calculating requests per second
    private totalRequestsInWindow: number = 0;
    private windowStartTime: number = Date.now();
    private totalCrawlTimeSeconds: number = 0;

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
    public createJob(id: string, domain: string): CrawlJob {
        const job: CrawlJob = {
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

    public updateJobStatus(id: string, status: JobStatus) {
        const job = this.jobs.get(id);
        if (!job) return;

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

            if (status === 'failed') this.metrics.failed_jobs++;
            if (status === 'timeout') {
                this.metrics.timeouts++;
                this.metrics.failed_jobs++;
            }
        }

        job.status = status;
        this.jobs.set(id, job);
    }

    public getJob(id: string): CrawlJob | undefined {
        return this.jobs.get(id);
    }

    public getAllJobs(): CrawlJob[] {
        return Array.from(this.jobs.values());
    }

    // --- Metrics Tracking ---
    public incrementRequest(domain: string = 'google.com') {
        this.totalRequestsInWindow++;
        const currentCount = this.domainRequests.get(domain) || 0;
        this.domainRequests.set(domain, currentCount + 1);
    }

    public incrementRetry() {
        this.metrics.retries++;
    }

    public incrementBlocked() {
        this.metrics.blocked_requests++;
    }

    public getCrawlerMetrics(): CrawlerMetrics {
        return { ...this.metrics };
    }

    public getDomainMetrics(): Record<string, number> {
        return Object.fromEntries(this.domainRequests);
    }

    // --- OS Monitoring ---
    public getSystemMetrics() {
        const totalMem = os.totalmem();
        const memoryUsage = process.memoryUsage();
        const usedMem = memoryUsage.rss; // Resident Set Size (memory allocated to this exact process)

        // Approximate CPU usage (a very simple representation, precise CPU % over time requires sampling)
        const loadAvg = os.loadavg();
        const cpuCount = os.cpus().length;
        const cpuPercent = (loadAvg[0] / cpuCount) * 100;

        return {
            memory_used: `${(usedMem / 1024 / 1024).toFixed(2)}MB`,
            memory_total: `${(totalMem / 1024 / 1024).toFixed(2)}MB`,
            cpu_usage: `${cpuPercent.toFixed(2)}%`,
            // Node.js alternative to "goroutines"
            active_handles: (process as any)._getActiveHandles ? (process as any)._getActiveHandles().length : 0,
            active_requests: (process as any)._getActiveRequests ? (process as any)._getActiveRequests().length : 0
        };
    }
}

export const metricsService = new MetricsService();
