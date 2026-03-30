/**
 * Replanificare automata — cand o masina e blocata (mentenanta),
 * muta alocatiile pe alte masini compatibile si creeaza un plan revizuit
 * care necesita aprobare.
 */
import db from '../config/db.js';

/**
 * Replanifica automat productia cand o masina e scoasa din uz.
 * @param {string} machineId  - masina blocata
 * @param {string} startDate  - de cand e indisponibila (YYYY-MM-DD)
 * @param {string} endDate    - pana cand (YYYY-MM-DD)
 * @param {string} reason     - motivul (ex: "Mentenanta preventiva MT-0005")
 * @param {string} userId     - cine a initiat
 * @returns {{ replanId, movedCount, failedCount, details[] }}
 */
export async function replanForMachineDowntime(machineId, startDate, endDate, reason, userId) {
  // 1. Find affected allocations
  const affected = await db('planning.daily_allocations')
    .where('machine_id', machineId)
    .where('plan_date', '>=', startDate)
    .where('plan_date', '<=', endDate)
    .whereNot('status', 'cancelled')
    .orderBy('plan_date');

  if (affected.length === 0) {
    return { replanId: null, movedCount: 0, failedCount: 0, details: [], message: 'Nicio alocare afectata in aceasta perioada.' };
  }

  // 2. Get the blocked machine info (type, capabilities)
  const blockedMachine = await db('machines.machines').where('id', machineId).first();
  const machineType = blockedMachine?.type || null;

  // 3. Find alternative machines of the same type
  const alternatives = await db('machines.machines')
    .where('status', 'active')
    .whereNot('id', machineId)
    .modify(q => { if (machineType) q.where('type', machineType); })
    .select('id', 'code', 'name', 'type');

  // 4. Create a replan record (new plan revision)
  const originalPlanIds = [...new Set(affected.map(a => a.master_plan_id).filter(Boolean))];
  const originalPlan = originalPlanIds.length > 0
    ? await db('planning.master_plans').where('id', originalPlanIds[0]).first()
    : null;

  const [replanRecord] = await db('planning.master_plans').insert({
    name: `Replanificare — ${blockedMachine?.code || 'Masina'} indisponibila ${startDate}`,
    plan_type: 'replan',
    start_date: startDate,
    end_date: endDate,
    revision: originalPlan ? (originalPlan.revision || 0) + 1 : 1,
    status: 'pending_approval',
    notes: `Replanificare automata: ${reason}\nMasina ${blockedMachine?.code} indisponibila ${startDate} — ${endDate}.\nAlocatii afectate: ${affected.length}`,
    created_by: userId,
  }).returning('*');

  // 5. Try to redistribute each allocation
  const details = [];
  let movedCount = 0;
  let failedCount = 0;

  for (const alloc of affected) {
    // Check which alternatives have capacity on this date
    let assigned = false;

    for (const alt of alternatives) {
      // Get current load for this alternative on the same date
      const existing = await db('planning.daily_allocations')
        .where('machine_id', alt.id)
        .where('plan_date', alloc.plan_date)
        .whereNot('status', 'cancelled')
        .sum('planned_hours as total');

      const currentLoad = Number(existing[0]?.total) || 0;
      const maxHours = 22; // max hours/day (safety margin)
      const needed = Number(alloc.planned_hours) || 8;

      if (currentLoad + needed <= maxHours) {
        // Create new allocation on alternative machine
        await db('planning.daily_allocations').insert({
          master_plan_id: replanRecord.id,
          plan_date: alloc.plan_date,
          shift: alloc.shift,
          machine_id: alt.id,
          product_id: alloc.product_id,
          product_reference: alloc.product_reference,
          product_name: alloc.product_name,
          order_id: alloc.order_id,
          planned_qty: alloc.planned_qty,
          planned_hours: alloc.planned_hours,
          status: 'pending',
          notes: `Mutat de pe ${blockedMachine?.code} (mentenanta). Original: ${alloc.id}`,
        });

        // Mark original as cancelled
        await db('planning.daily_allocations')
          .where('id', alloc.id)
          .update({ status: 'cancelled', notes: `Anulat — masina in mentenanta. Mutat pe ${alt.code}` });

        details.push({
          date: alloc.plan_date,
          product: alloc.product_reference || alloc.product_name,
          qty: alloc.planned_qty,
          from: blockedMachine?.code,
          to: alt.code,
          hours: alloc.planned_hours,
          status: 'moved',
        });
        movedCount++;
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      // No capacity — flag as failed
      await db('planning.daily_allocations')
        .where('id', alloc.id)
        .update({ notes: `ATENTIE: Masina in mentenanta, nu s-a gasit alternativa!` });

      details.push({
        date: alloc.plan_date,
        product: alloc.product_reference || alloc.product_name,
        qty: alloc.planned_qty,
        from: blockedMachine?.code,
        to: null,
        hours: alloc.planned_hours,
        status: 'no_alternative',
      });
      failedCount++;
    }
  }

  // 6. Update replan notes with summary
  await db('planning.master_plans').where('id', replanRecord.id).update({
    notes: replanRecord.notes + `\n\nRezultat: ${movedCount} mutate, ${failedCount} fara alternativa.`,
  });

  return {
    replanId: replanRecord.id,
    replanName: replanRecord.name,
    movedCount,
    failedCount,
    affectedTotal: affected.length,
    details,
    status: 'pending_approval',
    message: failedCount > 0
      ? `${movedCount} alocatii mutate, ${failedCount} NU au putut fi mutate (lipsa capacitate). Revizuiti planul manual.`
      : `Toate ${movedCount} alocatiile au fost redistribuite. Planul necesita aprobare.`,
  };
}

/**
 * Replanifica inapoi cand masina revine activa — muta alocatiile
 * care fusesera distribuite pe alte masini inapoi pe masina originala.
 */
export async function replanForMachineRestored(machineId, userId) {
  const machine = await db('machines.machines').where('id', machineId).first();
  if (!machine) return { replanId: null, movedCount: 0, details: [], message: 'Masina negasita.' };

  // Find allocations that were moved FROM this machine (cancelled with note pattern)
  const cancelled = await db('planning.daily_allocations')
    .where('machine_id', machineId)
    .where('status', 'cancelled')
    .where('notes', 'like', '%masina in mentenanta%')
    .where('plan_date', '>=', new Date().toISOString().split('T')[0])
    .orderBy('plan_date');

  if (cancelled.length === 0) {
    return { replanId: null, movedCount: 0, details: [], message: 'Nicio alocare de restaurat.' };
  }

  // Create restore plan
  const [restorePlan] = await db('planning.master_plans').insert({
    name: `Restaurare plan — ${machine.code} revine activa`,
    plan_type: 'replan',
    start_date: cancelled[0].plan_date,
    end_date: cancelled[cancelled.length - 1].plan_date,
    revision: 1,
    status: 'pending_approval',
    notes: `Masina ${machine.code} a revenit activa. Alocatiile originale pot fi restaurate.\nAlocatii de restaurat: ${cancelled.length}`,
    created_by: userId,
  }).returning('*');

  const details = [];
  let movedCount = 0;

  for (const orig of cancelled) {
    // Find the replacement allocation (the one that took over)
    const replacement = await db('planning.daily_allocations')
      .where('plan_date', orig.plan_date)
      .where('product_reference', orig.product_reference)
      .where('notes', 'like', `%Original: ${orig.id}%`)
      .whereNot('status', 'cancelled')
      .first();

    // Re-create on original machine
    await db('planning.daily_allocations').insert({
      master_plan_id: restorePlan.id,
      plan_date: orig.plan_date,
      shift: orig.shift,
      machine_id: machineId,
      product_id: orig.product_id,
      product_reference: orig.product_reference,
      product_name: orig.product_name,
      order_id: orig.order_id,
      planned_qty: orig.planned_qty,
      planned_hours: orig.planned_hours,
      status: 'pending',
      notes: `Restaurat pe ${machine.code} (masina revine activa).`,
    });

    // Cancel the replacement (if exists and still active)
    if (replacement) {
      const replacementMachine = await db('machines.machines').where('id', replacement.machine_id).first();
      await db('planning.daily_allocations')
        .where('id', replacement.id)
        .update({ status: 'cancelled', notes: replacement.notes + ` [Anulat — ${machine.code} revine activa]` });

      details.push({
        date: orig.plan_date,
        product: orig.product_reference || orig.product_name,
        qty: orig.planned_qty,
        from: replacementMachine?.code || '?',
        to: machine.code,
        status: 'restored',
      });
    } else {
      details.push({
        date: orig.plan_date,
        product: orig.product_reference || orig.product_name,
        qty: orig.planned_qty,
        from: '—',
        to: machine.code,
        status: 'restored',
      });
    }

    // Mark original cancelled as restored
    await db('planning.daily_allocations').where('id', orig.id)
      .update({ status: 'cancelled', notes: orig.notes + ' [Restaurat in plan nou]' });

    movedCount++;
  }

  await db('planning.master_plans').where('id', restorePlan.id).update({
    notes: restorePlan.notes + `\n\nRezultat: ${movedCount} alocatii restaurate pe ${machine.code}.`,
  });

  return {
    replanId: restorePlan.id,
    replanName: restorePlan.name,
    movedCount,
    details,
    status: 'pending_approval',
    message: `${movedCount} alocatii restaurate pe ${machine.code}. Planul necesita aprobare.`,
  };
}

/**
 * Aproba un plan de replanificare.
 */
export async function approveReplan(replanId, userId) {
  const plan = await db('planning.master_plans').where('id', replanId).first();
  if (!plan) throw Object.assign(new Error('Plan negasit'), { statusCode: 404 });
  if (plan.status !== 'pending_approval') throw Object.assign(new Error('Planul nu e in asteptare'), { statusCode: 400 });

  await db('planning.master_plans').where('id', replanId).update({
    status: 'active',
    notes: plan.notes + `\n\nAprobat de ${userId} la ${new Date().toISOString()}`,
    updated_at: new Date(),
  });

  // Activate all pending allocations
  await db('planning.daily_allocations')
    .where('master_plan_id', replanId)
    .where('status', 'pending')
    .update({ status: 'planned' });

  return { approved: true };
}

/**
 * Respinge un plan de replanificare — restaureaza alocatiile originale.
 */
export async function rejectReplan(replanId, userId, reason) {
  const plan = await db('planning.master_plans').where('id', replanId).first();
  if (!plan) throw Object.assign(new Error('Plan negasit'), { statusCode: 404 });

  // Delete the new allocations
  await db('planning.daily_allocations').where('master_plan_id', replanId).del();

  // Restore cancelled originals (find them by notes pattern)
  const cancelled = await db('planning.daily_allocations')
    .where('status', 'cancelled')
    .where('notes', 'like', '%masina in mentenanta%');

  for (const alloc of cancelled) {
    await db('planning.daily_allocations').where('id', alloc.id).update({
      status: 'planned',
      notes: alloc.notes + ' [Replanificare respinsa — restaurat]',
    });
  }

  await db('planning.master_plans').where('id', replanId).update({
    status: 'cancelled',
    notes: plan.notes + `\n\nRespins de ${userId}: ${reason || 'fara motiv'}`,
    updated_at: new Date(),
  });

  return { rejected: true };
}
