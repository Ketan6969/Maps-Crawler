"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
class Logger {
    logs = [];
    MAX_LOGS = 1000;
    log(level, event, domain, job_id, details) {
        const entry = {
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
        }
        else if (level === 'WARN') {
            console.warn(JSON.stringify(entry));
        }
        else {
            console.log(JSON.stringify(entry));
        }
        // Store internally
        this.logs.push(entry);
        // Manage buffer size
        if (this.logs.length > this.MAX_LOGS) {
            this.logs.shift(); // Remove oldest
        }
    }
    info(event, domain, job_id, details) {
        this.log('INFO', event, domain, job_id, details);
    }
    warn(event, domain, job_id, details) {
        this.log('WARN', event, domain, job_id, details);
    }
    error(event, domain, job_id, details) {
        this.log('ERROR', event, domain, job_id, details);
    }
    getLogs(limit = 100) {
        return this.logs.slice(-limit);
    }
}
exports.logger = new Logger();
