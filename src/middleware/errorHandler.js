import logger from '../config/logger.js';

export default function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;

  logger.error(err.message, {
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  const response = {
    statusCode,
    error: err.code || 'EROARE_INTERNA',
    message: err.message || 'A aparut o eroare interna.',
  };

  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
