import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import connectDB from './config/db';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import fileRoutes from './routes/fileRoutes';
import { errorHandler } from './middleware/errorMiddleware';
import { seedAdmin } from './controllers/authController';

dotenv.config();

// Connect to database
connectDB().then(() => {
  seedAdmin();
});

const app = express();

// Enable trust proxy for rate limiting behind Render load balancer
app.set('trust proxy', 1);

// Rate limiting for auth endpoints to prevent brute-forcing
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { message: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware - CORS configuration supporting Vercel frontend + Capacitor Android/iOS mobile app
const allowedOrigins = [
  process.env.FRONTEND_URL,          // https://driveflowrupam.vercel.app
  'http://localhost',                 // Capacitor Android WebView
  'http://localhost:3000',            // Local development
  'https://localhost',                // Capacitor HTTPS variant
  'capacitor://localhost',            // Capacitor iOS
  'ionic://localhost',                // Ionic fallback
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    // Allow any localhost port (e.g. http://localhost:8080)
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Log blocked origin for debugging
    console.warn(`[CORS] Blocked origin: ${origin}`);
    return callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} | Origin: ${req.headers.origin || 'none'}`);
  next();
});

// Health check
app.get('/api/auth/health', async (_req, res) => {
  try {
    const isConnected = mongoose.connection.readyState === 1;
    if (isConnected && mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
      res.json({ 
        status: 'ok', 
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({ 
        status: 'error', 
        database: 'disconnected',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      database: 'error',
      message: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/files', fileRoutes);

// Error Middleware
app.use(errorHandler);

const PORT = parseInt(process.env.PORT || '5000', 10);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} across all network interfaces`);
});
