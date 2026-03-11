import express from 'express';
import dotenv from 'dotenv';
import mapsRouter from './routes/maps';
import { browserPool } from './services/browserPool';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Maps Scraping API
app.use('/maps', mapsRouter);

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Server] Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

// Initialize dependencies and start server
const startServer = async () => {
    try {
        // Spin up Playwright instances in the background
        await browserPool.init();

        app.listen(PORT, () => {
            console.log(`[Server] Listening on port ${PORT}`);
            console.log(`[Server] Press Ctrl+C to stop`);
        });
    } catch (error) {
        console.error('[Server] Failed to initialize:', error);
        process.exit(1);
    }
};

// Graceful shutdown
const shutdown = async () => {
    console.log('\\n[Server] Shutting down gracefully...');
    await browserPool.destroy();
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startServer();
