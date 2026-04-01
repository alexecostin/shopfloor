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

      // ═══ VERIFICARI INTEGRITATE DATE PER COMANDA ═══
      // Comenzi fara produs BOM asociat
      const ordersNoProduct = await db('production.work_orders')
        .whereIn('status', ['planned', 'released'])
        .where(q => q.whereNull('product_id').orWhere('product_id', ''))
        .whereNotExists(function() {
          this.select('*').from('bom.products')
            .whereRaw("bom.products.reference = production.work_orders.product_reference");
        })
        .select('work_order_number', 'product_name', 'product_reference')
        .limit(5)
        .catch(() => []);
      for (const wo of ordersNoProduct) {
        tasks.push({
          severity: 'warning',
          message: `Comanda ${wo.work_order_number} (${wo.product_name || wo.product_reference}) nu are produs in catalog BOM — inginerul tehnolog trebuie sa creeze produsul si sa defineasca MBOM`,
          actionUrl: '/bom',
          category: 'production',
          assignTo: 'inginer_tehnolog',
        });
      }

      // Comenzi cu BOM dar fara operatii definite (MBOM gol)
      const ordersEmptyMbom = await db('production.work_orders as wo')
        .join('bom.products as bp', function() {
          this.on('bp.reference', '=', 'wo.product_reference')
            .orOn('bp.id', '=', 'wo.product_id');
        })
        .whereIn('wo.status', ['planned', 'released'])
        .whereNotExists(function() {
          this.select('*').from('bom.operations').whereRaw('bom.operations.product_id = bp.id');
        })
        .select('wo.work_order_number', 'wo.product_name', 'bp.reference as bom_ref')
        .limit(5)
        .catch(() => []);
      for (const wo of ordersEmptyMbom) {
        tasks.push({
          severity: 'warning',
          message: `Comanda ${wo.work_order_number} (${wo.product_name}) are produs BOM dar fara operatii — inginerul tehnolog trebuie sa defineasca MBOM (operatii, masini, timpi)`,
          actionUrl: '/bom',
          category: 'production',
          assignTo: 'inginer_tehnolog',
        });
      }

      // Operatii BOM fara masina alocata
      const opsNoMachine = await db('bom.operations as o')
        .join('bom.products as p', 'o.product_id', 'p.id')
        .whereNull('o.machine_id')
        .where('p.approval_status', 'active')
        .where('o.is_active', true)
        .select('p.reference', 'o.operation_name', 'o.sequence')
        .limit(5)
        .catch(() => []);
      if (opsNoMachine.length > 0) {
        tasks.push({
          severity: 'info',
          message: `${opsNoMachine.length} operatii din MBOM nu au masina alocata (ex: ${opsNoMachine[0]?.reference} → ${opsNoMachine[0]?.operation_name}) — inginerul sa aloce masini`,
          actionUrl: '/bom',
          category: 'production',
          assignTo: 'inginer_tehnolog',
        });
      }

      // Comenzi cu verificare tehnica incompleta
      const ordersNoTechCheck = await db('production.work_orders')
        .whereIn('status', ['planned'])
        .where(q => q.whereNull('technical_check_status').orWhere('technical_check_status', 'not_checked'))
        .select('work_order_number', 'product_name')
        .limit(5)
        .catch(() => []);
      if (ordersNoTechCheck.length > 0) {
        tasks.push({
          severity: 'info',
          message: `${ordersNoTechCheck.length} comenzi fara verificare tehnica — inginerul trebuie sa completeze checklist-ul inainte de lansare in productie`,
          actionUrl: '/work-orders',
          category: 'production',
          assignTo: 'inginer_tehnolog',
        });
      }

      // Materiale necesare dar lipsa din stoc (MRP check)
      const activeOrders = await db('production.work_orders')
        .whereIn('status', ['planned', 'released'])
        .select('id', 'work_order_number', 'product_reference', 'product_id', 'quantity')
        .limit(10)
        .catch(() => []);
      let materialsDeficit = 0;
      for (const wo of activeOrders) {
        const product = wo.product_id
          ? await db('bom.products').where('id', wo.product_id).first().catch(() => null)
          : await db('bom.products').where('reference', wo.product_reference).first().catch(() => null);
        if (!product) continue;
        const materials = await db('bom.materials').where('product_id', product.id).catch(() => []);
        for (const mat of materials) {
          const item = await db('inventory.items').where('code', mat.material_code).first().catch(() => null);
          const stock = item ? await db('inventory.stock_levels').where('item_id', item.id).first().catch(() => null) : null;
          const needed = Math.ceil((mat.qty_per_piece || 1) * (wo.quantity || 1) * (mat.waste_factor || 1));
          const available = Number(stock?.current_qty) || 0;
          if (available < needed) materialsDeficit++;
        }
      }
      if (materialsDeficit > 0) {
        tasks.push({
          severity: 'critical',
          message: `${materialsDeficit} materiale insuficiente pentru comenzile active — logistica trebuie sa lanseze comenzi de aprovizionare`,
          actionUrl: '/purchasing',
          category: 'logistics',
          assignTo: 'logistica',
        });
      }

      // Comenzi fara client asociat
      const ordersNoClient = await db('production.work_orders')
        .whereIn('status', ['planned', 'released'])
        .whereNull('client_id')
        .count('* as c')
        .catch(() => [{ c: 0 }]);
      const noClientCount = Number(ordersNoClient[0]?.c) || 0;
      if (noClientCount > 0) {
        tasks.push({
          severity: 'info',
          message: `${noClientCount} comenzi fara client asociat — comercialul trebuie sa completeze informatiile clientului`,
          actionUrl: '/client-orders',
          category: 'commercial',
          assignTo: 'comercial',
        });
      }
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
