"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
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
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
// Health check
app.get('/api/auth/health', (_req, res) => res.json({ status: 'ok' }));
// Routes
app.use('/api/auth', authRoutes_1.default);
app.use('/api/users', userRoutes_1.default);
app.use('/api/files', fileRoutes_1.default);
// Error Middleware
app.use(errorMiddleware_1.errorHandler);
const PORT = parseInt(process.env.PORT || '5000', 10);
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} across all network interfaces`);
});
//# sourceMappingURL=index.js.map