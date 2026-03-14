export type LogLevel = 'INFO' | 'WARN' | 'ERROR';
export type LogEvent = 'crawl_started' | 'page_fetched' | 'robots_block' | 'timeout' | 'retry' | 'crawl_completed' | 'crawl_failed' | 'app_start' | 'job_queued' | 'request_blocked';

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    event: LogEvent;
    domain?: string;
    job_id?: string;
    details?: any;
}

class Logger {
    private logs: LogEntry[] = [];
    private readonly MAX_LOGS = 1000;

    private log(level: LogLevel, event: LogEvent, domain?: string, job_id?: string, details?: any) {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            event,
            ...(domain && { domain }),
            ...(job_id && { job_id }),
            ...(details && { details })
        };

        // Output to console with structured format
        if (level === 'ERROR') {
            console.error(JSON.stringify(entry));
        } else if (level === 'WARN') {
            console.warn(JSON.stringify(entry));
        } else {
            console.log(JSON.stringify(entry));
        }

        // Store internally
        this.logs.push(entry);

        // Manage buffer size
        if (this.logs.length > this.MAX_LOGS) {
            this.logs.shift(); // Remove oldest
        }
    }

    public info(event: LogEvent, domain?: string, job_id?: string, details?: any) {
        this.log('INFO', event, domain, job_id, details);
    }

    public warn(event: LogEvent, domain?: string, job_id?: string, details?: any) {
        this.log('WARN', event, domain, job_id, details);
    }

    public error(event: LogEvent, domain?: string, job_id?: string, details?: any) {
        this.log('ERROR', event, domain, job_id, details);
    }

    public getLogs(limit: number = 100): LogEntry[] {
        return this.logs.slice(-limit);
    }
}

export const logger = new Logger();
