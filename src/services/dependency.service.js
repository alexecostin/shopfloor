import db from '../config/db.js';

/**
 * Build the full dependency tree for a product's operations.
 * Returns [{operation, dependsOn: [{operation, dependsOn: [...]}]}]
 */
export async function getDependencyTree(productId) {
  const operations = await db('bom.operations as op')
    .leftJoin('bom.products as outp', 'op.output_product_id', 'outp.id')
    .where('op.product_id', productId)
    .select('op.*', 'outp.name as output_product_name', 'outp.reference as output_product_reference')
    .orderBy('op.sequence');

  const deps = await db('bom.operation_dependencies as od')
    .join('bom.operations as dep', 'od.depends_on_operation_id', 'dep.id')
    .whereIn('od.operation_id', operations.map(o => o.id))
    .select('od.*', 'dep.name as depends_on_name', 'dep.sequence as depends_on_sequence');

  function buildTree(opId, visited = new Set()) {
    if (visited.has(opId)) return []; // prevent cycles
    visited.add(opId);
    const opDeps = deps.filter(d => d.operation_id === opId);
    return opDeps.map(d => ({
      operation: operations.find(o => o.id === d.depends_on_operation_id),
      dependency_type: d.dependency_type,
      lag_minutes: d.lag_minutes,
      dependsOn: buildTree(d.depends_on_operation_id, new Set(visited)),
    }));
  }

  return operations.map(op => ({
    operation: op,
    dependsOn: buildTree(op.id),
  }));
}

/**
 * Backward scheduling from a deadline.
 * Returns operations with latestStart and latestEnd.
 * @param {string} productId
 * @param {string} deadline - ISO date string
 * @param {number} quantity
 */
export async function calculateBackwardSchedule(productId, deadline, quantity) {
  const operations = await db('bom.operations')
    .where('product_id', productId)
    .orderBy('sequence', 'desc'); // process from last to first

  const deadlineMs = new Date(deadline).getTime();
  const WORKDAY_HOURS = 8;
  const WORKDAY_MS = WORKDAY_HOURS * 60 * 60 * 1000;

  // Map opId → scheduled times
  const scheduled = {};
  let currentEnd = deadlineMs;

  for (const op of operations) {
    // Calculate duration in ms
    const piecesPerHour = op.pieces_per_hour || 1;
    const setupMinutes = op.setup_time_minutes || 0;
    const productionHours = quantity / piecesPerHour;
    const totalMinutes = setupMinutes + productionHours * 60;
    const durationMs = totalMinutes * 60 * 1000;

    // Check if this op has a dependency that constrains its end time
    const depConstraints = await db('bom.operation_dependencies')
      .where('operation_id', op.id)
      .select('depends_on_operation_id', 'lag_minutes');

    let latestEnd = currentEnd;

    // If deps are already scheduled, constrain latestEnd
    for (const dep of depConstraints) {
      const depSched = scheduled[dep.depends_on_operation_id];
      if (depSched) {
        const depEnd = depSched.latestEnd + (dep.lag_minutes || 0) * 60000;
        if (depEnd < latestEnd) latestEnd = depEnd;
      }
    }

    const latestStart = latestEnd - durationMs;

    scheduled[op.id] = {
      operationId: op.id,
      operationName: op.name,
      sequence: op.sequence,
      machineType: op.machine_type,
      piecesNeeded: quantity,
      setupMinutes,
      productionHours: Math.round(productionHours * 100) / 100,
      latestStart: new Date(latestStart).toISOString(),
      latestEnd: new Date(latestEnd).toISOString(),
      transferType: op.transfer_type || 'direct',
    };

    currentEnd = latestStart; // previous op must finish before this one starts
  }

  return Object.values(scheduled).sort((a, b) => a.sequence - b.sequence);
}
