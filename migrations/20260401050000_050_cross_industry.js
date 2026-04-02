/**
 * Migration 050: Cross-Industry Support
 * Adds all fields needed for multi-industry support:
 * - Machine controller type + operator certification
 * - Depot locations (raw material, WIP, finished goods)
 * - Usable remnants/scraps
 * - Operator allocation modes + involvement per operation
 * - nr_cavities active in planning
 */
export async function up(knex) {
  // ═══ MACHINES: add controller type ═══
  await knex.raw("ALTER TABLE machines.machines ADD COLUMN IF NOT EXISTS controller_type VARCHAR(50)"); // Fanuc, Siemens, Heidenhain, Mazatrol, etc.
  await knex.raw("ALTER TABLE machines.machines ADD COLUMN IF NOT EXISTS controller_model VARCHAR(100)");

  // ═══ OPERATOR CERTIFICATION per machine type + controller ═══
  await knex.schema.withSchema('auth').createTable('operator_certifications', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable();
    t.string('machine_type', 50).notNullable(); // strung_cnc, frezare_cnc, etc.
    t.string('controller_type', 50); // Fanuc, Siemens, etc. (null = all controllers)
    t.string('certification_level', 30).defaultTo('operator'); // operator, advanced, expert
    t.date('certified_date').notNullable();
    t.date('expiry_date'); // null = no expiry
    t.string('certified_by', 255);
    t.text('certificate_url');
    t.boolean('is_active').defaultTo(true);
    t.uuid('tenant_id');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
  await knex.raw('CREATE INDEX idx_op_cert_user ON auth.operator_certifications(user_id)');
  await knex.raw('CREATE INDEX idx_op_cert_type ON auth.operator_certifications(machine_type, controller_type)');

  // Certification exceptions (positive or negative per specific machine)
  await knex.schema.withSchema('auth').createTable('certification_exceptions', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable();
    t.uuid('machine_id').notNullable();
    t.string('exception_type', 10).notNullable().defaultTo('allow'); // allow or deny
    t.text('reason');
    t.uuid('tenant_id');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // ═══ ORG UNITS: operator allocation mode per section ═══
  await knex.raw("ALTER TABLE org.units ADD COLUMN IF NOT EXISTS operator_allocation_mode VARCHAR(20) DEFAULT 'per_machine'"); // per_machine, per_zone, per_line

  // ═══ BOM OPERATIONS: operator requirements ═══
  await knex.raw("ALTER TABLE bom.operations ADD COLUMN IF NOT EXISTS required_operators INTEGER DEFAULT 1");
  await knex.raw("ALTER TABLE bom.operations ADD COLUMN IF NOT EXISTS operator_involvement VARCHAR(20) DEFAULT 'active'"); // active, supervision, none
  await knex.raw("ALTER TABLE bom.operations ADD COLUMN IF NOT EXISTS operator_involvement_percent INTEGER DEFAULT 100"); // 0-100
  await knex.raw("ALTER TABLE bom.operations ADD COLUMN IF NOT EXISTS required_skills JSONB DEFAULT '[]'"); // [{machineType, controllerType, minLevel}]
  await knex.raw("ALTER TABLE bom.operations ADD COLUMN IF NOT EXISTS operation_mode VARCHAR(20) DEFAULT 'machine'"); // machine, workstation, space, waiting

  // ═══ BOM OPERATIONS: scrap/residue per operation ═══
  await knex.raw("ALTER TABLE bom.operations ADD COLUMN IF NOT EXISTS scrap_percent NUMERIC(5,2) DEFAULT 0");
  await knex.raw("ALTER TABLE bom.operations ADD COLUMN IF NOT EXISTS scrap_type VARCHAR(30)"); // recyclable_internal, sellable, waste
  await knex.raw("ALTER TABLE bom.operations ADD COLUMN IF NOT EXISTS scrap_value_per_kg NUMERIC(10,2) DEFAULT 0");

  // ═══ INVENTORY: depot locations ═══
  await knex.schema.withSchema('inventory').createTable('locations', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('code', 50).notNullable();
    t.string('name', 255).notNullable();
    t.string('location_type', 30).notNullable(); // raw_material, wip, finished_goods, scrap, remnants
    t.string('zone', 100); // Hala 1, Zona CNC, etc.
    t.integer('capacity'); // max units/kg/pallets
    t.string('capacity_unit', 20); // pieces, kg, pallets, m2
    t.integer('current_occupancy').defaultTo(0);
    t.uuid('org_unit_id');
    t.uuid('tenant_id');
    t.boolean('is_active').defaultTo(true);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
  await knex.raw('CREATE INDEX idx_inv_loc_type ON inventory.locations(location_type)');

  // Add location_id to stock levels and items
  await knex.raw("ALTER TABLE inventory.items ADD COLUMN IF NOT EXISTS default_location_id UUID");

  // ═══ INVENTORY: usable remnants ═══
  await knex.schema.withSchema('inventory').createTable('remnants', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('source_item_id'); // original material
    t.string('material_code', 100);
    t.string('material_name', 255);
    t.string('material_grade', 100); // C45, 42CrMo4, etc.
    t.string('shape', 30); // bar, plate, tube, block
    t.decimal('dimension_length', 10, 2); // mm
    t.decimal('dimension_width', 10, 2); // mm (for plates)
    t.decimal('dimension_diameter', 10, 2); // mm (for bars/tubes)
    t.decimal('dimension_thickness', 10, 2); // mm (for plates/tubes)
    t.decimal('weight_kg', 10, 3);
    t.integer('quantity').defaultTo(1);
    t.string('status', 20).defaultTo('available'); // available, reserved, used, scrapped
    t.uuid('source_work_order_id'); // which order produced this remnant
    t.uuid('source_operation_id'); // which operation
    t.uuid('location_id'); // where it's stored
    t.uuid('tenant_id');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
  await knex.raw('CREATE INDEX idx_remnants_material ON inventory.remnants(material_code, material_grade)');
  await knex.raw('CREATE INDEX idx_remnants_status ON inventory.remnants(status)');
  await knex.raw('CREATE INDEX idx_remnants_dims ON inventory.remnants(shape, dimension_diameter, dimension_length)');

  // ═══ BOM ASSEMBLY: multi-level support ═══
  // Already exists but ensure component_product_id can reference any product (recursive)
  // Add level field for tree depth
  await knex.raw("ALTER TABLE bom.assembly_components ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1");

  // ═══ CONTRACTS: framework contracts ═══
  await knex.schema.withSchema('production').createTable('framework_contracts', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('client_id').notNullable();
    t.string('contract_number', 100).notNullable();
    t.string('product_reference', 100);
    t.string('product_name', 255);
    t.integer('total_quantity');
    t.decimal('unit_price', 12, 2);
    t.string('currency', 3).defaultTo('RON');
    t.string('delivery_frequency', 20); // weekly, biweekly, monthly
    t.integer('quantity_per_delivery');
    t.date('start_date').notNullable();
    t.date('end_date').notNullable();
    t.string('status', 20).defaultTo('active'); // draft, active, completed, cancelled
    t.text('notes');
    t.uuid('tenant_id');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
}

export async function down(knex) {
  await knex.schema.withSchema('production').dropTableIfExists('framework_contracts');
  await knex.schema.withSchema('inventory').dropTableIfExists('remnants');
  await knex.schema.withSchema('inventory').dropTableIfExists('locations');
  await knex.schema.withSchema('auth').dropTableIfExists('certification_exceptions');
  await knex.schema.withSchema('auth').dropTableIfExists('operator_certifications');

  const opCols = ['required_operators','operator_involvement','operator_involvement_percent','required_skills','operation_mode','scrap_percent','scrap_type','scrap_value_per_kg'];
  for (const c of opCols) await knex.raw(`ALTER TABLE bom.operations DROP COLUMN IF EXISTS ${c}`);
  await knex.raw("ALTER TABLE machines.machines DROP COLUMN IF EXISTS controller_type");
  await knex.raw("ALTER TABLE machines.machines DROP COLUMN IF EXISTS controller_model");
  await knex.raw("ALTER TABLE org.units DROP COLUMN IF EXISTS operator_allocation_mode");
  await knex.raw("ALTER TABLE inventory.items DROP COLUMN IF EXISTS default_location_id");
  await knex.raw("ALTER TABLE bom.assembly_components DROP COLUMN IF EXISTS level");
}
