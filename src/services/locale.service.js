import db from '../config/db.js';

// ─── Common timezones for industrial/EU context ───────────────────────────────
export const COMMON_TIMEZONES = [
  { value: 'Europe/Bucharest',    label: 'Bucuresti (EET/EEST) UTC+2/+3' },
  { value: 'Europe/London',       label: 'Londra (GMT/BST) UTC+0/+1' },
  { value: 'Europe/Paris',        label: 'Paris (CET/CEST) UTC+1/+2' },
  { value: 'Europe/Berlin',       label: 'Berlin (CET/CEST) UTC+1/+2' },
  { value: 'Europe/Warsaw',       label: 'Varsovia (CET/CEST) UTC+1/+2' },
  { value: 'Europe/Budapest',     label: 'Budapesta (CET/CEST) UTC+1/+2' },
  { value: 'Europe/Vienna',       label: 'Viena (CET/CEST) UTC+1/+2' },
  { value: 'Europe/Prague',       label: 'Praga (CET/CEST) UTC+1/+2' },
  { value: 'Europe/Bratislava',   label: 'Bratislava (CET/CEST) UTC+1/+2' },
  { value: 'Europe/Sofia',        label: 'Sofia (EET/EEST) UTC+2/+3' },
  { value: 'Europe/Istanbul',     label: 'Istanbul (TRT) UTC+3' },
  { value: 'Europe/Kyiv',         label: 'Kyiv (EET/EEST) UTC+2/+3' },
  { value: 'Europe/Moscow',       label: 'Moscova (MSK) UTC+3' },
  { value: 'Asia/Dubai',          label: 'Dubai (GST) UTC+4' },
  { value: 'Asia/Kolkata',        label: 'India (IST) UTC+5:30' },
  { value: 'Asia/Shanghai',       label: 'China (CST) UTC+8' },
  { value: 'America/New_York',    label: 'New York (ET) UTC-5/-4' },
  { value: 'America/Chicago',     label: 'Chicago (CT) UTC-6/-5' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PT) UTC-8/-7' },
  { value: 'UTC',                 label: 'UTC' },
];

export const DEFAULT_SETTINGS = {
  default_timezone: 'Europe/Bucharest',
  default_language: 'ro',
  default_currency: 'RON',
  date_format: 'DD/MM/YYYY',
  time_format: '24h',
  decimal_separator: ',',
  thousands_separator: '.',
  week_starts_on: 1,
};

// ─── Get locale settings for a tenant ────────────────────────────────────────
export async function getLocaleSettings(tenantId) {
  if (!tenantId) return { ...DEFAULT_SETTINGS };
  const tenant = await db('system.tenants')
    .where('id', tenantId)
    .select(
      'default_timezone', 'default_language', 'default_currency',
      'date_format', 'time_format', 'decimal_separator',
      'thousands_separator', 'week_starts_on'
    )
    .first();
  if (!tenant) return { ...DEFAULT_SETTINGS };
  return {
    default_timezone:    tenant.default_timezone    || DEFAULT_SETTINGS.default_timezone,
    default_language:    tenant.default_language    || DEFAULT_SETTINGS.default_language,
    default_currency:    tenant.default_currency    || DEFAULT_SETTINGS.default_currency,
    date_format:         tenant.date_format         || DEFAULT_SETTINGS.date_format,
    time_format:         tenant.time_format         || DEFAULT_SETTINGS.time_format,
    decimal_separator:   tenant.decimal_separator   || DEFAULT_SETTINGS.decimal_separator,
    thousands_separator: tenant.thousands_separator || DEFAULT_SETTINGS.thousands_separator,
    week_starts_on:      tenant.week_starts_on      ?? DEFAULT_SETTINGS.week_starts_on,
  };
}

// ─── Update locale settings ───────────────────────────────────────────────────
export async function updateLocaleSettings(tenantId, settings) {
  if (!tenantId) throw new Error('Tenant necunoscut');
  const allowed = [
    'default_timezone', 'default_language', 'default_currency',
    'date_format', 'time_format', 'decimal_separator',
    'thousands_separator', 'week_starts_on',
  ];
  const patch = {};
  for (const key of allowed) {
    if (settings[key] !== undefined) patch[key] = settings[key];
  }
  if (Object.keys(patch).length === 0) return getLocaleSettings(tenantId);
  await db('system.tenants').where('id', tenantId).update({ ...patch, updated_at: db.fn.now() });
  return getLocaleSettings(tenantId);
}

// ─── Resolve timezone for an org unit (walk up tree, then tenant default) ─────
export async function getTimezoneForOrgUnit(orgUnitId, tenantId) {
  if (!orgUnitId) {
    const settings = await getLocaleSettings(tenantId);
    return settings.default_timezone;
  }
  const visited = new Set();
  let currentId = orgUnitId;
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const unit = await db('org.units').where('id', currentId).select('timezone', 'parent_id').first();
    if (!unit) break;
    if (unit.timezone) return unit.timezone;
    currentId = unit.parent_id;
  }
  const settings = await getLocaleSettings(tenantId);
  return settings.default_timezone;
}

// ─── Format helpers (pure JS, no external deps) ──────────────────────────────

/**
 * Format a date/datetime value using Intl.DateTimeFormat.
 * @param {Date|string} date
 * @param {object} options  { timezone, format: 'date'|'datetime'|'time', locale }
 */
export function formatDate(date, options = {}) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const tz = options.timezone || 'Europe/Bucharest';
  const locale = options.locale || 'ro-RO';
  const fmt = options.format || 'date';

  const intlOpts = { timeZone: tz };
  if (fmt === 'date' || fmt === 'datetime') {
    intlOpts.day = '2-digit'; intlOpts.month = '2-digit'; intlOpts.year = 'numeric';
  }
  if (fmt === 'time' || fmt === 'datetime') {
    intlOpts.hour = '2-digit'; intlOpts.minute = '2-digit'; intlOpts.hour12 = false;
  }
  return new Intl.DateTimeFormat(locale, intlOpts).format(d);
}

/**
 * Format a number respecting locale separators.
 * @param {number} value
 * @param {object} opts  { decimalSeparator, thousandsSeparator, decimals }
 */
export function formatNumber(value, opts = {}) {
  if (value == null || isNaN(value)) return '';
  const decimals = opts.decimals ?? 2;
  const dec = opts.decimalSeparator || ',';
  const thou = opts.thousandsSeparator || '.';
  const parts = Number(value).toFixed(decimals).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thou);
  return parts.join(dec);
}

/**
 * Format a monetary amount.
 * @param {number} amount
 * @param {string} currencyCode  ISO 4217, e.g. 'RON'
 * @param {string} locale        BCP 47, e.g. 'ro-RO'
 */
export function formatCurrency(amount, currencyCode = 'RON', locale = 'ro-RO') {
  if (amount == null || isNaN(amount)) return '';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${Number(amount).toFixed(2)} ${currencyCode}`;
  }
}

export function listTimezones() {
  return COMMON_TIMEZONES;
}
