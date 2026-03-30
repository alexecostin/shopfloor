export async function up(knex) {
  // ALTER companies.companies: replace company_type with company_types JSONB
  const hasCompanyType = await knex.schema.withSchema('companies').hasColumn('companies', 'company_type');
  if (hasCompanyType) {
    await knex.schema.withSchema('companies').table('companies', t => {
      t.dropColumn('company_type');
    });
  }
  const hasCompanyTypes = await knex.schema.withSchema('companies').hasColumn('companies', 'company_types');
  if (!hasCompanyTypes) {
    await knex.schema.withSchema('companies').table('companies', t => {
      t.jsonb('company_types').defaultTo('["client"]');
    });
  }

  // ALTER companies.contacts: add relationship_type, context_tags, department
  const hasRelType = await knex.schema.withSchema('companies').hasColumn('contacts', 'relationship_type');
  if (!hasRelType) {
    await knex.schema.withSchema('companies').table('contacts', t => {
      t.string('relationship_type', 20).defaultTo('client_contact');
      t.jsonb('context_tags').defaultTo('[]');
      t.string('department', 100);
    });
  }

  // CREATE companies.contact_assignments
  const hasAssignments = await knex.schema.withSchema('companies').hasTable('contact_assignments');
  if (!hasAssignments) {
    await knex.schema.withSchema('companies').createTable('contact_assignments', t => {
      t.uuid('id').defaultTo(knex.raw('gen_random_uuid()')).primary();
      t.uuid('contact_id').references('id').inTable('companies.contacts').onDelete('CASCADE');
      t.string('entity_type', 50).notNullable();
      t.uuid('entity_id').notNullable();
      t.string('role_in_context', 100);
      t.timestamp('assigned_at', { useTz: true }).defaultTo(knex.fn.now());
      t.uuid('assigned_by');
      t.index(['entity_type', 'entity_id']);
    });
  }

  // CREATE inventory.item_suppliers
  const hasItemSuppliers = await knex.schema.withSchema('inventory').hasTable('item_suppliers');
  if (!hasItemSuppliers) {
    await knex.schema.withSchema('inventory').createTable('item_suppliers', t => {
      t.uuid('id').defaultTo(knex.raw('gen_random_uuid()')).primary();
      t.uuid('item_id').references('id').inTable('inventory.items').onDelete('CASCADE');
      t.uuid('supplier_company_id').references('id').inTable('companies.companies').notNullable();
      t.uuid('supplier_contact_id').references('id').inTable('companies.contacts');
      t.boolean('is_primary').defaultTo(false);
      t.integer('priority').defaultTo(1);
      t.decimal('unit_cost', 12, 4).notNullable();
      t.string('currency', 3).defaultTo('EUR');
      t.decimal('min_order_qty', 12, 2);
      t.integer('lead_time_days');
      t.date('last_purchase_date');
      t.decimal('last_purchase_cost', 12, 4);
      t.text('notes');
      t.boolean('is_active').defaultTo(true);
      t.unique(['item_id', 'supplier_company_id']);
    });
  }

  // CREATE inventory.purchase_history
  const hasPurchaseHistory = await knex.schema.withSchema('inventory').hasTable('purchase_history');
  if (!hasPurchaseHistory) {
    await knex.schema.withSchema('inventory').createTable('purchase_history', t => {
      t.uuid('id').defaultTo(knex.raw('gen_random_uuid()')).primary();
      t.uuid('item_id').references('id').inTable('inventory.items').onDelete('CASCADE');
      t.uuid('supplier_company_id').references('id').inTable('companies.companies');
      t.uuid('supplier_contact_id').references('id').inTable('companies.contacts');
      t.decimal('qty', 12, 2).notNullable();
      t.decimal('unit_cost', 12, 4).notNullable();
      t.decimal('total_cost', 12, 2);
      t.string('currency', 3).defaultTo('EUR');
      t.string('invoice_number', 100);
      t.date('purchase_date').notNullable();
      t.date('delivery_date');
      t.string('lot_number', 100);
      t.boolean('quality_ok').defaultTo(true);
      t.text('notes');
      t.uuid('movement_id');
      t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      t.index(['item_id', 'purchase_date']);
    });
  }

  // ALTER machines.tools: add supplier fields
  const hasToolSupplier = await knex.schema.withSchema('machines').hasColumn('tools', 'supplier_company_id');
  if (!hasToolSupplier) {
    await knex.schema.withSchema('machines').table('tools', t => {
      t.uuid('supplier_company_id').references('id').inTable('companies.companies');
      t.decimal('purchase_cost', 12, 2);
      t.date('purchase_date');
      t.string('invoice_number', 100);
      t.date('warranty_until');
    });
  }

  // ADD client_contact_id to production.orders if it exists
  const hasOrders = await knex.schema.withSchema('production').hasTable('orders');
  if (hasOrders) {
    const hasContactId = await knex.schema.withSchema('production').hasColumn('orders', 'client_contact_id');
    if (!hasContactId) {
      await knex.schema.withSchema('production').table('orders', t => {
        t.uuid('client_contact_id');
      });
    }
  }
}

export async function down(knex) {
  await knex.schema.withSchema('production').table('orders', t => { t.dropColumn('client_contact_id'); }).catch(() => {});
  await knex.schema.withSchema('machines').table('tools', t => {
    t.dropColumn('supplier_company_id'); t.dropColumn('purchase_cost'); t.dropColumn('purchase_date'); t.dropColumn('invoice_number'); t.dropColumn('warranty_until');
  }).catch(() => {});
  await knex.schema.withSchema('inventory').dropTableIfExists('purchase_history');
  await knex.schema.withSchema('inventory').dropTableIfExists('item_suppliers');
  await knex.schema.withSchema('companies').dropTableIfExists('contact_assignments');
  await knex.schema.withSchema('companies').table('contacts', t => {
    t.dropColumn('relationship_type'); t.dropColumn('context_tags'); t.dropColumn('department');
  }).catch(() => {});
  await knex.schema.withSchema('companies').table('companies', t => { t.dropColumn('company_types'); }).catch(() => {});
}
