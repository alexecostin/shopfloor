import rateLimit from 'express-rate-limit';

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: {
    statusCode: 429,
    error: 'PREA_MULTE_CERERI',
    message: 'Prea multe cereri. Incearca din nou peste un minut.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    statusCode: 429,
    error: 'PREA_MULTE_INCERCARI',
    message: 'Prea multe incercari de autentificare. Incearca din nou peste un minut.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
