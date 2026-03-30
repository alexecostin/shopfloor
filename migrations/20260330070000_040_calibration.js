export async function up(knex) {
  await knex.raw("ALTER TABLE machines.tools ADD COLUMN IF NOT EXISTS calibration_interval_months INTEGER");
  await knex.raw("ALTER TABLE machines.tools ADD COLUMN IF NOT EXISTS last_calibrated_at TIMESTAMP WITH TIME ZONE");
  await knex.raw("ALTER TABLE machines.tools ADD COLUMN IF NOT EXISTS next_calibration_date DATE");
  await knex.raw("ALTER TABLE machines.tools ADD COLUMN IF NOT EXISTS calibration_status VARCHAR(30) DEFAULT 'not_applicable'");
  await knex.raw("ALTER TABLE machines.tools ADD COLUMN IF NOT EXISTS calibration_certificate_url TEXT");
  await knex.raw("ALTER TABLE machines.tools ADD COLUMN IF NOT EXISTS calibrated_by VARCHAR(255)");
}

export async function down(knex) {
  const cols = ['calibration_interval_months','last_calibrated_at','next_calibration_date','calibration_status','calibration_certificate_url','calibrated_by'];
  for (const c of cols) await knex.raw(`ALTER TABLE machines.tools DROP COLUMN IF EXISTS ${c}`);
}
