import db from '../config/db.js';

export async function getTasksForUser(userId, role, tenantId) {
  const tasks = [];
  const today = new Date().toISOString().split('T')[0];

  try {
    if (['admin', 'production_manager'].includes(role)) {
      // Orders without MBOM
      const ordersNoMbom = await db('production.work_orders')
        .whereIn('status', ['planned', 'released'])
        .whereNotExists(function () {
          this.select('*')
            .from('bom.products')
            .whereRaw(
              'bom.products.reference = production.work_orders.product_reference OR bom.products.reference = production.work_orders.product_code'
            )
            .where('bom.products.approval_status', 'active');
        })
        .count('* as c')
        .catch(() => [{ c: 0 }]);
      const noMbomCount = Number(ordersNoMbom[0]?.c) || 0;
      if (noMbomCount > 0)
        tasks.push({
          severity: 'warning',
          message: `${noMbomCount} comenzi fara MBOM definit — defineste operatiile`,
          actionUrl: '/bom',
          category: 'production',
        });

      // Plans still in draft
      const draftPlans = await db('planning.master_plans')
        .where('status', 'draft')
        .count('* as c')
        .catch(() => [{ c: 0 }]);
      const draftCount = Number(draftPlans[0]?.c) || 0;
      if (draftCount > 0)
        tasks.push({
          severity: 'warning',
          message: `${draftCount} planuri in ciorna — activeaza-le`,
          actionUrl: '/planning',
          category: 'planning',
        });

      // Overloaded machines
      const overloaded = await db('planning.capacity_load')
        .where('load_percent', '>', 100)
        .where('plan_date', '>=', today)
        .count('* as c')
        .catch(() => [{ c: 0 }]);
      const overCount = Number(overloaded[0]?.c) || 0;
      if (overCount > 0)
        tasks.push({
          severity: 'critical',
          message: `${overCount} sloturi supraincarcate (>100%) — redistribuie`,
          actionUrl: '/planning',
          category: 'planning',
        });

      // Low stock alerts
      const lowStock = await db('inventory.items')
        .whereRaw('current_stock <= min_stock')
        .where('is_active', true)
        .count('* as c')
        .catch(() => [{ c: 0 }]);
      const lowCount = Number(lowStock[0]?.c) || 0;
      if (lowCount > 0)
        tasks.push({
          severity: 'warning',
          message: `${lowCount} articole sub stocul minim — comanda materiale`,
          actionUrl: '/inventory',
          category: 'logistics',
        });

      // Pending approvals
      const pendingApprovals = await db('approvals.approval_requests')
        .where('status', 'pending')
        .count('* as c')
        .catch(() => [{ c: 0 }]);
      const pendAppr = Number(pendingApprovals[0]?.c) || 0;
      if (pendAppr > 0)
        tasks.push({
          severity: 'info',
          message: `${pendAppr} aprobari in asteptare`,
          actionUrl: '/approvals',
          category: 'quality',
        });

      // Unassigned maintenance requests
      const openMaint = await db('maintenance.requests')
        .where('status', 'open')
        .count('* as c')
        .catch(() => [{ c: 0 }]);
      const openMaintCount = Number(openMaint[0]?.c) || 0;
      if (openMaintCount > 0)
        tasks.push({
          severity: 'warning',
          message: `${openMaintCount} cereri mentenanta nepreluate`,
          actionUrl: '/maintenance',
          category: 'maintenance',
        });
    }

    if (['shift_leader'].includes(role)) {
      // Open stops
      const openStops = await db('production.stops')
        .whereNull('ended_at')
        .count('* as c')
        .catch(() => [{ c: 0 }]);
      const stopCount = Number(openStops[0]?.c) || 0;
      if (stopCount > 0)
        tasks.push({
          severity: 'warning',
          message: `${stopCount} opriri nerezolvate — investigheaza`,
          actionUrl: '/production',
          category: 'production',
        });

      // Today's production progress
      const todayReports = await db('production.reports')
        .where('created_at', '>=', today)
        .sum('good_pieces as total')
        .catch(() => [{ total: 0 }]);
      const produced = Number(todayReports[0]?.total) || 0;
      tasks.push({
        severity: 'success',
        message: `Productie azi: ${produced} piese bune`,
        actionUrl: '/production',
        category: 'production',
      });
    }

    if (['maintenance'].includes(role)) {
      // Critical unassigned requests
      const critical = await db('maintenance.requests')
        .where('status', 'open')
        .whereIn('priority', ['high', 'critical'])
        .count('* as c')
        .catch(() => [{ c: 0 }]);
      const critCount = Number(critical[0]?.c) || 0;
      if (critCount > 0)
        tasks.push({
          severity: 'critical',
          message: `${critCount} cereri critice nepreluate — preia imediat`,
          actionUrl: '/maintenance',
          category: 'maintenance',
        });

      // Expired calibrations
      const expiredCal = await db('machines.tools')
        .where('calibration_status', 'expired')
        .count('* as c')
        .catch(() => [{ c: 0 }]);
      const expCount = Number(expiredCal[0]?.c) || 0;
      if (expCount > 0)
        tasks.push({
          severity: 'warning',
          message: `${expCount} instrumente cu calibrare expirata`,
          actionUrl: '/tools',
          category: 'maintenance',
        });

      // Planned maintenance upcoming
      const upcoming = await db('maintenance.planned_interventions')
        .where('status', 'confirmed')
        .where('planned_start_date', '<=', new Date(Date.now() + 3 * 86400000))
        .count('* as c')
        .catch(() => [{ c: 0 }]);
      const upCount = Number(upcoming[0]?.c) || 0;
      if (upCount > 0)
        tasks.push({
          severity: 'info',
          message: `${upCount} interventii planificate in urmatoarele 3 zile`,
          actionUrl: '/maintenance',
          category: 'maintenance',
        });
    }

    // Success message if nothing critical
    if (tasks.filter((t) => t.severity === 'critical' || t.severity === 'warning').length === 0) {
      tasks.push({
        severity: 'success',
        message: 'Totul este la zi! Nicio actiune urgenta.',
        actionUrl: '/',
        category: 'general',
      });
    }
  } catch (e) {
    console.error('[DailyAssistant] Error:', e.message);
  }

  return tasks;
}

/**
 * Get the operator's current work sheet — what they should be working on RIGHT NOW.
 */
export async function getOperatorWorkSheet(userId, machineId) {
  if (!machineId) return null;

  const today = new Date().toISOString().split('T')[0];

  // Find today's allocation on this machine
  const allocation = await db('planning.daily_allocations')
    .where('machine_id', machineId)
    .where('plan_date', today)
    .whereNot('status', 'cancelled')
    .orderBy('created_at', 'desc')
    .first()
    .catch(() => null);

  if (!allocation)
    return { hasWork: false, message: 'Nicio operatie planificata azi pe aceasta masina.' };

  // Find the BOM product and operation
  const product = allocation.product_reference
    ? await db('bom.products').where('reference', allocation.product_reference).first().catch(() => null)
    : null;

  let operation = null;
  if (product) {
    // Get machine type for matching
    const machine = await db('machines.machines').where('id', machineId).first().catch(() => null);
    // Find the operation for this machine
    operation = await db('bom.operations')
      .where('product_id', product.id)
      .where((q) =>
        q.where('machine_id', machineId).orWhere('machine_type', machine?.type)
      )
      .orderBy('sequence')
      .first()
      .catch(() => null);
  }

  // Get today's production on this machine for this product
  const todayProduction = await db('production.reports')
    .where('machine_id', machineId)
    .where('created_at', '>=', today)
    .sum('good_pieces as good')
    .sum('scrap_pieces as scrap')
    .catch(() => [{ good: 0, scrap: 0 }]);

  const produced = Number(todayProduction[0]?.good) || 0;
  const scrapped = Number(todayProduction[0]?.scrap) || 0;
  const totalQty = allocation.planned_qty || 0;
  const remaining = Math.max(0, totalQty - produced);

  // Get machine info
  const machine = await db('machines.machines').where('id', machineId).first().catch(() => null);

  // Get order info
  let order = null;
  if (allocation.order_id) {
    order = await db('production.work_orders')
      .where('id', allocation.order_id)
      .first()
      .catch(() => null);
  }

  return {
    hasWork: true,
    machine: { id: machine?.id, code: machine?.code, name: machine?.name },
    order: order
      ? { id: order.id, orderNumber: order.order_number, clientName: order.client_name }
      : null,
    product: { reference: allocation.product_reference, name: allocation.product_name },
    operation: operation
      ? {
          name: operation.operation_name,
          type: operation.operation_type,
          sequence: operation.sequence,
          cncProgram: operation.cnc_program,
          rawMaterialSpec: operation.raw_material_spec,
          toolsConfig: operation.tools_config || [],
          machineParameters: operation.machine_parameters || [],
          consumables: operation.consumables || [],
          attentionPoints: operation.attention_points || [],
          cycleTimeSeconds: operation.cycle_time_seconds,
          setupTimeMinutes: operation.setup_time_minutes,
        }
      : null,
    quantities: {
      total: totalQty,
      produced,
      scrapped,
      remaining,
      progressPercent: totalQty > 0 ? Math.round((produced / totalQty) * 100) : 0,
    },
    shift: allocation.shift,
  };
}
