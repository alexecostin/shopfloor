export async function up(knex) {
  await knex.raw("ALTER TABLE planning.master_plans DROP CONSTRAINT IF EXISTS master_plans_plan_type_check");
  await knex.raw("ALTER TABLE planning.master_plans ADD CONSTRAINT master_plans_plan_type_check CHECK (plan_type IN ('daily','3day','weekly','biweekly','monthly','quarterly','custom','auto'))");
}

export async function down(knex) {
  await knex.raw("ALTER TABLE planning.master_plans DROP CONSTRAINT IF EXISTS master_plans_plan_type_check");
  await knex.raw("ALTER TABLE planning.master_plans ADD CONSTRAINT master_plans_plan_type_check CHECK (plan_type IN ('weekly','monthly'))");
}
