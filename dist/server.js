"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const maps_1 = __importDefault(require("./routes/maps"));
const browserPool_1 = require("./services/browserPool");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});
// Maps Scraping API
app.use('/maps', maps_1.default);
// Global error handler
app.use((err, req, res, next) => {
    console.error('[Server] Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});
// Initialize dependencies and start server
const startServer = async () => {
    try {
        // Spin up Playwright instances in the background
        await browserPool_1.browserPool.init();
        app.listen(PORT, () => {
            console.log(`[Server] Listening on port ${PORT}`);
            console.log(`[Server] Press Ctrl+C to stop`);
        });
    }
    catch (error) {
        console.error('[Server] Failed to initialize:', error);
        process.exit(1);
    }
};
// Graceful shutdown
const shutdown = async () => {
    console.log('\\n[Server] Shutting down gracefully...');
    await browserPool_1.browserPool.destroy();
    process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
startServer();
