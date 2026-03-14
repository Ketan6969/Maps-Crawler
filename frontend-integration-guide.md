# Frontend Integration Guide for Google Maps Crawler API

This document provides the necessary cURL commands to test the newly implemented metrics API endpoints, and a ready-to-use prompt that you can copy-paste to another AI agent to have it build a frontend dashboard using these endpoints.

## Test cURL Commands

You can run these commands from your terminal to verify that the backend is properly exposing metrics, jobs, and logs.

```bash
# Get overall crawler performance and system resource metrics
curl -s http://localhost:3000/metrics | jq

# Get the list of all active, queued, and completed jobs with their durations
curl -s http://localhost:3000/jobs | jq

# Get the structured JSON crawler event logs (last 100 events)
curl -s http://localhost:3000/logs | jq

# Get domain rate-limiting and request-counting statistics
curl -s http://localhost:3000/domains | jq

# Get a basic server health check (includes uptime and API version)
curl -s http://localhost:3000/health | jq
```

---

## Prompt for Frontend Agent

Copy and paste the text below to your frontend agent.

```text
I have a Node.js/Express backend running locally on `http://localhost:3000` that scrapes Google Maps and tracks detailed performance metrics. I want you to build an interactive Frontend Dashboard (e.g. using React/Next.js/Vite with modern styling like Tailwind) to visualize this data. 

The backend provides the following 4 JSON endpoints. Please implement a dashboard that polls these endpoints every 3-5 seconds to provide a "live view" of the scraper engine.

1. **`GET /metrics`**
   - Returns: `{ "active_crawls": number, "queued_jobs": number, "completed_jobs": number, "failed_jobs": number, "requests_per_second": number, "avg_crawl_time": number, "timeouts": number, "retries": number, "blocked_requests": number, "memory_used": string, "memory_total": string, "cpu_usage": string, "active_handles": number, "active_requests": number }`
   - Goal: Create a "Server Health" card group (CPU, Memory) and a "Scraper Performance" card group (Active/Queued/Completed speeds).

2. **`GET /jobs`**
   - Returns array: `[{ "id": string, "domain": string, "status": "queued" | "running" | "completed" | "failed", "duration": number }]`
   - Goal: Build a real-time table showing active and recent job states. Use color-coded badges for statuses (e.g. Green for completed, Yellow for running).

3. **`GET /logs`**
   - Returns array of objects: `[{ "timestamp": string, "level": "INFO"|"WARN"|"ERROR", "event": string, "domain"?: string, "job_id"?: string, "details"?: object }]`
   - Goal: Build a scrolling terminal-like window on the dashboard showing the raw logs as they stream in.

4. **`GET /domains`**
   - Returns: `{ "google.com": number, "other-domain.com": number }`
   - Goal: Create a simple list or bar chart showing the breakdown of requests by domain.

Design constraints:
- Use a dark mode aesthetic suitable for a monitoring tool.
- Ensure the layout is clean with a grid of stat cards at the top and the jobs table/logs window taking up the bottom.
```
