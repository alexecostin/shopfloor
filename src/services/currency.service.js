import db from '../config/db.js';

// Cache of currencies for the session
let _currencyCache = null;

async function getCurrencies() {
  if (_currencyCache) return _currencyCache;
  _currencyCache = await db('system.currencies').where({ is_active: true });
  setTimeout(() => { _currencyCache = null; }, 5 * 60 * 1000); // 5 min cache
  return _currencyCache;
}

export async function getCurrency(code) {
  const currencies = await getCurrencies();
  return currencies.find(c => c.code === code) || null;
}

export async function getExchangeRate(from, to, date) {
  if (from === to) return 1;
  const d = date || new Date().toISOString().slice(0, 10);
  const row = await db('system.exchange_rates')
    .where({ from_currency: from, to_currency: to })
    .where('valid_date', '<=', d)
    .orderBy('valid_date', 'desc')
    .first();
  return row ? Number(row.rate) : null;
}

export async function convert(amount, from, to, date) {
  if (!amount || from === to) return Number(amount) || 0;
  const rate = await getExchangeRate(from, to, date);
  if (!rate) return Number(amount); // can't convert, return as-is
  return Math.round(Number(amount) * rate * 100) / 100;
}

export async function formatCurrency(amount, currencyCode, locale = 'ro-RO') {
  const currency = await getCurrency(currencyCode);
  if (!currency) return `${amount} ${currencyCode}`;
  const num = Number(amount) || 0;
  const formatted = num.toLocaleString(locale, {
    minimumFractionDigits: currency.decimal_places,
    maximumFractionDigits: currency.decimal_places,
  });
  // Romanian: "1.234,56 lei", European: "€1.234,56"
  if (currencyCode === 'RON') return `${formatted} ${currency.symbol}`;
  return `${currency.symbol}${formatted}`;
}

export async function addExchangeRate(from, to, rate, date, source = 'manual') {
  const [row] = await db('system.exchange_rates').insert({
    from_currency: from,
    to_currency: to,
    rate,
    valid_date: date || new Date().toISOString().slice(0, 10),
    source,
  }).onConflict(['from_currency', 'to_currency', 'valid_date']).merge(['rate', 'source']).returning('*');
  return row;
}

export async function getLatestRates(from) {
  const today = new Date().toISOString().slice(0, 10);
  return db('system.exchange_rates')
    .where({ from_currency: from })
    .where('valid_date', '<=', today)
    .orderBy([{ column: 'to_currency' }, { column: 'valid_date', order: 'desc' }])
    .distinctOn('to_currency');
}
