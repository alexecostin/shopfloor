import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { globalLimiter } from './middleware/rateLimiter.js';
import errorHandler from './middleware/errorHandler.js';
import logger from './config/logger.js';
import authRoutes from './modules/auth/auth.routes.js';
import machinesRoutes from './modules/machines/machines.routes.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global rate limiter
app.use(globalLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/machines', machinesRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ statusCode: 404, error: 'NU_GASIT', message: 'Ruta nu exista.' });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;

// Only start server when run directly (not imported in tests)
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    logger.info(`Server pornit pe portul ${PORT}`, { env: process.env.NODE_ENV });
  });
}
