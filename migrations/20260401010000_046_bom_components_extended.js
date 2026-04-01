export async function up(knex) {
  // Extend assembly_components with position, material, dimensions
  await knex.raw("ALTER TABLE bom.assembly_components ADD COLUMN IF NOT EXISTS position_code VARCHAR(50)");
  await knex.raw("ALTER TABLE bom.assembly_components ADD COLUMN IF NOT EXISTS material_code VARCHAR(100)");
  await knex.raw("ALTER TABLE bom.assembly_components ADD COLUMN IF NOT EXISTS material_grade VARCHAR(100)");
  await knex.raw("ALTER TABLE bom.assembly_components ADD COLUMN IF NOT EXISTS raw_dimensions VARCHAR(100)");
  await knex.raw("ALTER TABLE bom.assembly_components ADD COLUMN IF NOT EXISTS component_type VARCHAR(30) DEFAULT 'fabricated'");
  await knex.raw("ALTER TABLE bom.assembly_components ADD COLUMN IF NOT EXISTS supplier_code VARCHAR(100)");
  await knex.raw("ALTER TABLE bom.assembly_components ADD COLUMN IF NOT EXISTS standard_reference VARCHAR(100)");
  await knex.raw("ALTER TABLE bom.assembly_components ADD COLUMN IF NOT EXISTS inventory_item_id UUID");

  // Extend operations with transport time and deposit location
  await knex.raw("ALTER TABLE bom.operations ADD COLUMN IF NOT EXISTS transport_time_minutes INTEGER DEFAULT 0");
  await knex.raw("ALTER TABLE bom.operations ADD COLUMN IF NOT EXISTS deposit_location VARCHAR(100)");
  await knex.raw("ALTER TABLE bom.operations ADD COLUMN IF NOT EXISTS reject_action VARCHAR(30) DEFAULT 'scrap'");
  await knex.raw("ALTER TABLE bom.operations ADD COLUMN IF NOT EXISTS time_unit VARCHAR(10) DEFAULT 'seconds'");
  await knex.raw("ALTER TABLE bom.operations ADD COLUMN IF NOT EXISTS input_material_id UUID");
  await knex.raw("ALTER TABLE bom.operations ADD COLUMN IF NOT EXISTS drawing_url TEXT");
}

export async function down(knex) {
  const compCols = ['position_code','material_code','material_grade','raw_dimensions','component_type','supplier_code','standard_reference','inventory_item_id'];
  for (const c of compCols) await knex.raw(`ALTER TABLE bom.assembly_components DROP COLUMN IF EXISTS ${c}`);
  const opCols = ['transport_time_minutes','deposit_location','reject_action','time_unit','input_material_id','drawing_url'];
  for (const c of opCols) await knex.raw(`ALTER TABLE bom.operations DROP COLUMN IF EXISTS ${c}`);
}
