"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const db_1 = __importDefault(require("./config/db"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const fileRoutes_1 = __importDefault(require("./routes/fileRoutes"));
const errorMiddleware_1 = require("./middleware/errorMiddleware");
const authController_1 = require("./controllers/authController");
dotenv_1.default.config();
// Connect to database
(0, db_1.default)().then(() => {
    (0, authController_1.seedAdmin)();
});
const app = (0, express_1.default)();
// Enable trust proxy for rate limiting behind Render load balancer
app.set('trust proxy', 1);
// Rate limiting for auth endpoints to prevent brute-forcing
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { message: 'Too many requests from this IP, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
});
// Middleware - CORS open for all origins to allow Capacitor Android app access
app.use((0, cors_1.default)({
    origin: true,
    credentials: true,
}));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} | Origin: ${req.headers.origin || 'none'}`);
    next();
});
// Health check
app.get('/api/auth/health', async (_req, res) => {
    try {
        const isConnected = mongoose_1.default.connection.readyState === 1;
        if (isConnected && mongoose_1.default.connection.db) {
            await mongoose_1.default.connection.db.admin().ping();
            res.json({
                status: 'ok',
                database: 'connected',
                timestamp: new Date().toISOString()
            });
        }
        else {
            res.status(500).json({
                status: 'error',
                database: 'disconnected',
                timestamp: new Date().toISOString()
            });
        }
    }
    catch (error) {
        res.status(500).json({
            status: 'error',
            database: 'error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
// Routes
app.use('/api/auth', authLimiter, authRoutes_1.default);
app.use('/api/users', userRoutes_1.default);
app.use('/api/files', fileRoutes_1.default);
// Error Middleware
app.use(errorMiddleware_1.errorHandler);
const PORT = parseInt(process.env.PORT || '5000', 10);
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} across all network interfaces`);
});
//# sourceMappingURL=index.js.map