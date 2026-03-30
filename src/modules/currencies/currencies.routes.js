import { Router } from 'express';
import * as currencyService from '../../services/currency.service.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import db from '../../config/db.js';

const router = Router();
const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };

router.use(authenticate);

// GET /currencies
router.get('/', wrap(async (req, res) => {
  const currencies = await db('system.currencies').where({ is_active: true }).orderBy('code');
  res.json(currencies);
}));

// GET /exchange-rates?from=EUR&to=RON
router.get('/exchange-rates', wrap(async (req, res) => {
  const { from, to } = req.query;
  if (from && to) {
    const rate = await currencyService.getExchangeRate(from, to);
    return res.json({ from, to, rate, date: new Date().toISOString().slice(0, 10) });
  }
  // List all latest rates
  const rates = await db('system.exchange_rates')
    .orderBy([{ column: 'from_currency' }, { column: 'to_currency' }, { column: 'valid_date', order: 'desc' }])
    .limit(100);
  res.json(rates);
}));

// GET /exchange-rates/latest?from=EUR&to=RON
router.get('/exchange-rates/latest', wrap(async (req, res) => {
  const { from, to } = req.query;
  const rate = await currencyService.getExchangeRate(from, to);
  res.json({ from, to, rate });
}));

// POST /exchange-rates (admin)
router.post('/exchange-rates', authorize('admin', 'production_manager'), wrap(async (req, res) => {
  const { from, to, rate, date } = req.body;
  const row = await currencyService.addExchangeRate(from, to, rate, date);
  res.status(201).json(row);
}));

export default router;
