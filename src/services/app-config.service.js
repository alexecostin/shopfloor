import db from '../config/db.js';

// Cache tenant settings for 5 minutes
let _cache = {};
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

export async function getTenantConfig(tenantId) {
  const now = Date.now();
  const key = tenantId || 'default';
  if (_cache[key] && (now - _cacheTime) < CACHE_TTL) return _cache[key];

  let settings = {};
  if (tenantId) {
    const tenant = await db('system.tenants').where('id', tenantId).first();
    settings = tenant?.settings || {};
  }

  const config = {
    // Shift defaults (overridden by shift_definitions when available)
    defaultHoursPerShift: Number(settings.hours_per_shift) || 7.5,
    defaultShiftDurationMinutes: Number(settings.shift_duration_minutes) || 450,
    defaultMaxHoursPerDay: Number(settings.max_hours_per_day) || 22,
    defaultMaxShiftsPerDay: Number(settings.max_shifts_per_day) || 2,

    // OEE thresholds
    oeeAlertThreshold: Number(settings.oee_alert_threshold) || 60,
    oeeGoodThreshold: Number(settings.oee_good_threshold) || 85,

    // Cost defaults
    defaultMachineHourlyRate: Number(settings.default_machine_hourly_rate) || 25,
    defaultLaborHourlyRate: Number(settings.default_labor_hourly_rate) || 15,

    // Planning defaults
    defaultDeadlineDays: Number(settings.default_deadline_days) || 30,
    defaultPiecesPerHour: Number(settings.default_pieces_per_hour) || 10,
    defaultOvertimePercent: Number(settings.default_overtime_percent) || 10,

    // Lot transfer
    lotTransferMinPieces: Number(settings.lot_transfer_min) || 5,
    lotTransferMaxPieces: Number(settings.lot_transfer_max) || 100,
    lotTransferPercent: Number(settings.lot_transfer_percent) || 10,

    // Alert thresholds
    alertMaintenanceLookAheadDays: Number(settings.alert_maintenance_days) || 14,
    alertOrderInactiveDays: Number(settings.alert_order_inactive_days) || 7,
    alertNoReportDays: Number(settings.alert_no_report_days) || 3,
    alertOeeCheckShifts: Number(settings.alert_oee_check_shifts) || 3,
    alertToolCyclesPercent: Number(settings.alert_tool_cycles_percent) || 90,
    alertPriceIncreasePercent: Number(settings.alert_price_increase_percent) || 10,

    // Certification
    certificationExpiryWarningDays: Number(settings.certification_expiry_warning_days) || 30,

    // Currency & locale
    defaultCurrency: settings.default_currency || 'RON',
    defaultTimezone: settings.default_timezone || 'Europe/Bucharest',
    defaultLanguage: settings.default_language || 'ro',
    defaultCountry: settings.default_country || 'Romania',
    defaultPaymentTermsDays: Number(settings.default_payment_terms_days) || 30,

    // Monthly estimate
    defaultMonthlyPiecesEstimate: Number(settings.monthly_pieces_estimate) || 1000,

    // Default operator hourly rate fallback
    defaultOperatorHourlyRate: Number(settings.default_operator_hourly_rate) || 10,
  };

  _cache[key] = config;
  _cacheTime = now;
  return config;
}

export function invalidateCache() {
  _cache = {};
  _cacheTime = 0;
}
