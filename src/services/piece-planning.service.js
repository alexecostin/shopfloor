import db from '../config/db.js';

/**
 * Aggregate all active work orders into pieces to produce.
 * Groups same product_reference across orders.
 * Returns pieces sorted by total quantity (biggest first).
 */
export async function aggregatePiecesFromOrders() {
  // Get all active work orders
  const orders = await db('production.work_orders')
    .whereIn('status', ['planned', 'released', 'in_progress'])
    .select('*');

  // Group by product_reference
  const pieceMap = {};
  for (const wo of orders) {
    const ref = wo.product_reference || wo.product_name || 'unknown';
    if (!pieceMap[ref]) {
      pieceMap[ref] = {
        productReference: ref,
        productName: wo.product_name,
        productId: wo.product_id,
        totalQuantity: 0,
        orders: [],
        operations: [],
        mbomStatus: 'unknown',
      };
    }
    pieceMap[ref].totalQuantity += (wo.quantity || 0);
    pieceMap[ref].orders.push({
      id: wo.id,
      orderNumber: wo.work_order_number || wo.order_number,
      clientName: wo.client_name,
      quantity: wo.quantity,
      deadline: wo.scheduled_end,
      priority: wo.priority,
      status: wo.status,
    });
  }

  // For each piece, get MBOM operations
  for (const piece of Object.values(pieceMap)) {
    const product = piece.productId
      ? await db('bom.products').where('id', piece.productId).first()
      : await db('bom.products').where('reference', piece.productReference).first();

    if (product) {
      piece.productId = product.id;
      piece.mbomStatus = product.approval_status;

      const ops = await db('bom.operations')
        .leftJoin('machines.machines as m', 'bom.operations.machine_id', 'm.id')
        .where('bom.operations.product_id', product.id)
        .where('bom.operations.is_active', true)
        .orderBy('bom.operations.sequence')
        .select('bom.operations.*', 'm.code as machine_code', 'm.name as machine_name');

      piece.operations = ops;

      // Calculate total production time for all pieces
      piece.totalProductionHours = ops.reduce((sum, op) => {
        const cycleTime = Number(op.cycle_time_seconds) || 0;
        const setupTime = Number(op.setup_time_minutes) || 0;
        return sum + (piece.totalQuantity * cycleTime / 3600) + (setupTime / 60);
      }, 0);
    }

    // Calculate already allocated/produced
    const [{ allocated }] = await db('planning.daily_allocations')
      .where('product_reference', piece.productReference)
      .whereNot('status', 'cancelled')
      .sum('planned_qty as allocated')
      .catch(() => [{ allocated: 0 }]);
    piece.allocatedQuantity = Number(allocated) || 0;
    piece.remainingQuantity = Math.max(0, piece.totalQuantity - piece.allocatedQuantity);

    // Earliest deadline from all orders
    const deadlines = piece.orders.map(o => o.deadline).filter(Boolean).sort();
    piece.earliestDeadline = deadlines[0] || null;

    // Highest priority from all orders
    const priorityRank = { urgent: 4, high: 3, normal: 2, low: 1 };
    piece.highestPriority = piece.orders.reduce((max, o) => {
      return (priorityRank[o.priority] || 0) > (priorityRank[max] || 0) ? o.priority : max;
    }, 'low');
  }

  // Sort: priority desc, then earliest deadline, then total qty desc
  return Object.values(pieceMap).sort((a, b) => {
    const pa = { urgent: 4, high: 3, normal: 2, low: 1 }[a.highestPriority] || 0;
    const pb = { urgent: 4, high: 3, normal: 2, low: 1 }[b.highestPriority] || 0;
    if (pb !== pa) return pb - pa;
    if (a.earliestDeadline && b.earliestDeadline) return String(a.earliestDeadline).localeCompare(String(b.earliestDeadline));
    return b.totalQuantity - a.totalQuantity;
  });
}

/**
 * Get setup optimization suggestions.
 * Groups pieces that use the same machine to minimize changeovers.
 */
export async function getSetupOptimization(machineId) {
  const pieces = await aggregatePiecesFromOrders();

  // Filter pieces that have operations on this machine
  const machineOps = [];
  for (const piece of pieces) {
    const ops = piece.operations.filter(op =>
      op.machine_id === machineId || op.machine_code === machineId
    );
    if (ops.length > 0) {
      machineOps.push({
        ...piece,
        machineOperations: ops,
        setupTimeMinutes: ops.reduce((s, o) => s + (Number(o.setup_time_minutes) || 0), 0),
        productionHours: ops.reduce((s, o) => s + (piece.remainingQuantity * (Number(o.cycle_time_seconds) || 0) / 3600), 0),
      });
    }
  }

  // Suggest order: group same product type together (minimize setup)
  // Simple: sort by operation_type then by remaining qty desc
  return machineOps.sort((a, b) => {
    const typeA = a.machineOperations[0]?.operation_type || '';
    const typeB = b.machineOperations[0]?.operation_type || '';
    if (typeA !== typeB) return typeA.localeCompare(typeB);
    return b.remainingQuantity - a.remainingQuantity;
  });
}
