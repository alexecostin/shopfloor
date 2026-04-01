import db from '../config/db.js';
import { getTenantConfig } from './app-config.service.js';

async function createAlertIfNew(ruleCode, entityType, entityId, title, message, metadata = {}, suggestedActions = []) {
  // Check if an active alert already exists for this entity+rule
  const rule = await db('alerts.rule_definitions').where('code', ruleCode).first();
  if (!rule || !rule.is_active) return null;

  const existing = await db('alerts.alerts')
    .where({ rule_id: rule.id, entity_type: entityType, status: 'new' })
    .where(q => entityId ? q.where('entity_id', entityId) : q.whereNull('entity_id'))
    .first();
  if (existing) return null; // Already alerted

  const [alert] = await db('alerts.alerts').insert({
    rule_id: rule.id,
    entity_type: entityType,
    entity_id: entityId || null,
    title,
    message,
    severity: rule.severity,
    suggested_actions: JSON.stringify(suggestedActions),
    metadata: JSON.stringify(metadata),
  }).returning('*');

  // Send on configured channels
  const channels = await db('alerts.notification_channels').where({ rule_id: rule.id, is_active: true });
  for (const ch of channels) {
    if (ch.channel_type === 'email' && ch.recipient) {
      try {
        const { sendNotification } = await import('./email.service.js');
        await sendNotification('stock_low', ch.recipient, { title, message });
      } catch (e) { /* ignore */ }
    }
  }

  return alert;
}

export async function checkAllRules() {
  const results = { checked: 0, triggered: 0, errors: [] };
  const alertConfig = await getTenantConfig(null).catch(() => ({}));

  try {
    // 1. STOCK LOW
    const lowStock = await db('inventory.items as ii')
      .leftJoin('inventory.stock_levels as sl', 'ii.id', 'sl.item_id')
      .where(db.raw('COALESCE(sl.quantity, 0) <= ii.min_stock'))
      .select('ii.id', 'ii.code', 'ii.name', db.raw('COALESCE(sl.quantity, 0) as current_qty'), 'ii.min_stock');
    results.checked++;
    for (const item of lowStock) {
      const a = await createAlertIfNew('stock_low', 'item', item.id,
        `Stoc scazut: ${item.name}`,
        `Stocul pentru "${item.name}" (${item.code}) este ${item.current_qty} ${item.unit || 'buc'}, sub minimul de ${item.min_stock}.`,
        { item_id: item.id, current_qty: item.current_qty, min_stock: item.min_stock },
        ['Comanda materiale suplimentare', 'Verifica cerinte materiale pentru comenzile active']
      );
      if (a) results.triggered++;
    }
  } catch (e) { results.errors.push(`stock_low: ${e.message}`); }

  try {
    // 2. ORDER AT RISK — orders active with no recent production
    const noReportDays = alertConfig.alertNoReportDays || 3;
    const orderInactiveDays = alertConfig.alertOrderInactiveDays || 7;
    const stuckOrders = await db('production.orders as o')
      .where('o.status', 'active')
      .whereNotExists(
        db('production.reports as r')
          .where('r.order_id', db.raw('o.id'))
          .where('r.reported_at', '>=', db.raw(`NOW() - INTERVAL '${noReportDays} days'`))
      )
      .where('o.created_at', '<=', db.raw(`NOW() - INTERVAL '${orderInactiveDays} days'`))
      .select('o.id', 'o.order_number', 'o.product_name');
    results.checked++;
    for (const order of stuckOrders) {
      const a = await createAlertIfNew('order_at_risk', 'order', order.id,
        `Comanda la risc: ${order.order_number}`,
        `Comanda ${order.order_number} (${order.product_name}) nu are rapoarte de productie in ultimele ${noReportDays} zile.`,
        { order_id: order.id },
        ['Verifica statusul comenzii', 'Contacteaza seful de tura']
      );
      if (a) results.triggered++;
    }
  } catch (e) { results.errors.push(`order_at_risk: ${e.message}`); }

  try {
    // 3. OEE LOW — last N shifts average OEE below threshold
    const oeeCheckShifts = alertConfig.alertOeeCheckShifts || 3;
    const oeeThreshold = alertConfig.oeeAlertThreshold || 60;
    const machines = await db('machines.machines').where('status', 'active').select('id', 'code', 'name');
    results.checked++;
    for (const machine of machines) {
      const recentReports = await db('production.reports as r')
        .join('production.orders as o', 'r.order_id', 'o.id')
        .where('r.machine_id', machine.id)
        .orderBy('r.reported_at', 'desc')
        .limit(oeeCheckShifts)
        .select('r.good_pieces', 'r.scrap_pieces');
      if (recentReports.length < oeeCheckShifts) continue;
      const totalPieces = recentReports.reduce((s, r) => s + Number(r.good_pieces) + Number(r.scrap_pieces), 0);
      const goodPieces = recentReports.reduce((s, r) => s + Number(r.good_pieces), 0);
      const quality = totalPieces > 0 ? goodPieces / totalPieces : 0;
      // Simplified OEE: just quality rate (no availability/performance data readily available)
      const oee = quality * 100;
      if (oee < oeeThreshold) {
        const a = await createAlertIfNew('oee_low', 'machine', machine.id,
          `OEE scazut: ${machine.code}`,
          `Masina ${machine.code} are OEE estimat de ${oee.toFixed(1)}% in ultimele ${oeeCheckShifts} ture (sub pragul de ${oeeThreshold}%).`,
          { machine_id: machine.id, oee },
          ['Analizeaza cauzele de rebut', 'Verifica parametrii de productie', 'Planifica mentenanta preventiva']
        );
        if (a) results.triggered++;
      }
    }
  } catch (e) { results.errors.push(`oee_low: ${e.message}`); }

  try {
    // 4. TOOL CYCLES HIGH
    const tools = await db('machines.tools')
      .where('tracking_mode', 'tracked')
      .where('status', 'active')
      .whereNotNull('maintenance_interval_cycles');
    results.checked++;
    const toolCyclesThreshold = alertConfig.alertToolCyclesPercent || 90;
    for (const tool of tools) {
      const pct = (tool.current_cycles / tool.maintenance_interval_cycles) * 100;
      if (pct >= toolCyclesThreshold) {
        const a = await createAlertIfNew('tool_cycles_high', 'machine', tool.current_machine_id,
          `Scula aproape de limita: ${tool.code}`,
          `Scula ${tool.code} a atins ${pct.toFixed(0)}% din intervalul de mentenanta (${tool.current_cycles}/${tool.maintenance_interval_cycles} cicluri).`,
          { tool_id: tool.id, current_cycles: tool.current_cycles, interval: tool.maintenance_interval_cycles },
          ['Planifica mentenanta sculei', 'Pregateste scula de rezerva']
        );
        if (a) results.triggered++;
      }
    }
  } catch (e) { results.errors.push(`tool_cycles_high: ${e.message}`); }

  try {
    // 5. MAINTENANCE APPROACHING — next_due_date within configured look-ahead days
    const maintenanceLookAhead = alertConfig.alertMaintenanceLookAheadDays || 14;
    const approachingMaintenances = await db('machines.maintenance_schedules as ms')
      .join('machines.machines as m', 'ms.machine_id', 'm.id')
      .whereNotNull('ms.next_due_date')
      .whereRaw(`ms.next_due_date <= CURRENT_DATE + INTERVAL '${maintenanceLookAhead} days'`)
      .whereRaw('ms.next_due_date >= CURRENT_DATE')
      .where('ms.is_active', true)
      .select('ms.*', 'm.name as machine_name', 'm.code as machine_code')
      .catch(() => []);
    results.checked++;
    for (const ms of approachingMaintenances) {
      const existing = await db('alerts.alerts')
        .where({ rule_id: null, status: 'new' })
        .whereRaw("context->>'scheduleId' = ?", [ms.id])
        .whereRaw("title LIKE 'Mentenanta%'")
        .first().catch(() => null);
      if (!existing) {
        await db('alerts.alerts').insert({
          title: `Mentenanta planificata se apropie: ${ms.machine_name}`,
          message: `Intervalul "${ms.schedule_name}" pe masina ${ms.machine_code} este scadent pe ${ms.next_due_date}`,
          severity: 'warning',
          status: 'new',
          context: JSON.stringify({ scheduleId: ms.id, machineId: ms.machine_id }),
        }).catch(() => {});
        results.triggered++;
      }
    }
  } catch (e) { results.errors.push(`maintenance_approaching: ${e.message}`); }

  try {
    // 6. MAINTENANCE OVERDUE — next_due_date < today
    const overdueMaintenances = await db('machines.maintenance_schedules as ms')
      .join('machines.machines as m', 'ms.machine_id', 'm.id')
      .whereNotNull('ms.next_due_date')
      .whereRaw('ms.next_due_date < CURRENT_DATE')
      .where('ms.is_active', true)
      .select('ms.*', 'm.name as machine_name', 'm.code as machine_code')
      .catch(() => []);
    results.checked++;
    for (const ms of overdueMaintenances) {
      const existing = await db('alerts.alerts')
        .where({ rule_id: null, status: 'new' })
        .whereRaw("context->>'scheduleId' = ?", [ms.id])
        .whereRaw("title LIKE 'Mentenanta intarziata%'")
        .first().catch(() => null);
      if (!existing) {
        await db('alerts.alerts').insert({
          title: `Mentenanta intarziata: ${ms.machine_name}`,
          message: `Intervalul "${ms.schedule_name}" pe masina ${ms.machine_code} era scadent pe ${ms.next_due_date} si nu a fost efectuat`,
          severity: 'critical',
          status: 'new',
          context: JSON.stringify({ scheduleId: ms.id, machineId: ms.machine_id }),
        }).catch(() => {});
        results.triggered++;
      }
    }
  } catch (e) { results.errors.push(`maintenance_overdue: ${e.message}`); }

  return results;
}
