export async function seed(knex) {
  // Get first org_unit to attach shifts to (factory level, or first available)
  const orgUnit = await knex('org.units')
    .whereIn('unit_type', ['factory', 'plant', 'facility'])
    .first()
    .catch(() => null)
    || await knex('org.units').orderBy('level').first().catch(() => null);

  if (!orgUnit) {
    console.log('[seed:shifts] No org_unit found — skipping shifts seed');
    return;
  }

  const tenant = await knex('system.tenants').first().catch(() => null);
  const tenantId = tenant?.id || null;

  // Clean up existing seed data for this org_unit
  await knex('shifts.schedule_exceptions').where({ org_unit_id: orgUnit.id }).delete().catch(() => {});
  await knex('shifts.weekly_schedule').where({ org_unit_id: orgUnit.id }).delete().catch(() => {});
  await knex('shifts.shift_definitions').where({ org_unit_id: orgUnit.id }).delete().catch(() => {});

  // Create 3 standard shifts
  const [t1, t2, t3] = await knex('shifts.shift_definitions').insert([
    { tenant_id: tenantId, org_unit_id: orgUnit.id, shift_name: 'Tura I',   shift_code: 'T1', start_time: '06:00', end_time: '14:00', crosses_midnight: false, break_minutes: 30, sort_order: 1 },
    { tenant_id: tenantId, org_unit_id: orgUnit.id, shift_name: 'Tura II',  shift_code: 'T2', start_time: '14:00', end_time: '22:00', crosses_midnight: false, break_minutes: 30, sort_order: 2 },
    { tenant_id: tenantId, org_unit_id: orgUnit.id, shift_name: 'Tura III', shift_code: 'T3', start_time: '22:00', end_time: '06:00', crosses_midnight: true,  break_minutes: 30, sort_order: 3 },
  ]).returning('id');

  const t1id = t1.id, t2id = t2.id, t3id = t3.id;

  // Weekly schedule: Mon-Fri (0-4) = T1+T2+T3, Sat (5) = T1+T2, Sun (6) = nothing
  const weekRows = [];
  for (let day = 0; day <= 4; day++) {
    weekRows.push(
      { tenant_id: tenantId, org_unit_id: orgUnit.id, day_of_week: day, shift_definition_id: t1id },
      { tenant_id: tenantId, org_unit_id: orgUnit.id, day_of_week: day, shift_definition_id: t2id },
      { tenant_id: tenantId, org_unit_id: orgUnit.id, day_of_week: day, shift_definition_id: t3id },
    );
  }
  // Saturday (5) = T1+T2
  weekRows.push(
    { tenant_id: tenantId, org_unit_id: orgUnit.id, day_of_week: 5, shift_definition_id: t1id },
    { tenant_id: tenantId, org_unit_id: orgUnit.id, day_of_week: 5, shift_definition_id: t2id },
  );
  await knex('shifts.weekly_schedule').insert(weekRows);

  // Exception: 1 Mai = closed (recurring)
  await knex('shifts.schedule_exceptions').insert({
    tenant_id: tenantId,
    org_unit_id: orgUnit.id,
    exception_date: '2026-05-01',
    exception_type: 'holiday',
    name: '1 Mai — Ziua Muncii',
    active_shifts: JSON.stringify([]),
    is_recurring: true,
  });

  console.log(`[seed:shifts] Created 3 shifts, weekly schedule and 1 exception for org_unit "${orgUnit.name}"`);
}
