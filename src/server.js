import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import logger from './config/logger.js';

const app = express();
const PORT = process.env.PORT || 3001;

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
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'PREA_MULTE_CERERI', message: 'Prea multe cereri. Incearca din nou peste un minut.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  logger.error(err.message, { stack: err.stack, path: req.path, method: req.method });

  res.status(statusCode).json({
    statusCode,
    error: err.code || 'EROARE_INTERNA',
    message: err.message || 'A aparut o eroare interna.',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ statusCode: 404, error: 'NU_GASIT', message: 'Ruta nu exista.' });
});

app.listen(PORT, () => {
  logger.info(`Server pornit pe portul ${PORT}`, { env: process.env.NODE_ENV });
});

export default app;
