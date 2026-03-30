export async function seed(knex) {
  // delete existing global defaults
  await knex('system.email_templates').whereNull('tenant_id').del();

  const tpl = (type, lang, subject, body_html, variables) => ({
    tenant_id: null, template_type: type, lang, subject, body_html,
    variables: JSON.stringify(variables), is_active: true, updated_at: new Date()
  });

  const templates = [
    // maintenance_new - ro
    tpl('maintenance_new', 'ro',
      '[URGENT] Cerere mentenanta: {machineCode} — {problemType}',
      `<h2>Cerere noua mentenanta — {requestNumber}</h2><p><b>Masina:</b> {machineCode}</p><p><b>Problema:</b> {problemType}</p><p><b>Prioritate:</b> {priority}</p><p><b>Descriere:</b> {description}</p><hr/><p><small>ShopFloor.ro</small></p>`,
      ['requestNumber','machineCode','problemType','priority','description']
    ),
    // maintenance_new - en
    tpl('maintenance_new', 'en',
      '[URGENT] Maintenance request: {machineCode} — {problemType}',
      `<h2>New maintenance request — {requestNumber}</h2><p><b>Machine:</b> {machineCode}</p><p><b>Problem:</b> {problemType}</p><p><b>Priority:</b> {priority}</p><p><b>Description:</b> {description}</p><hr/><p><small>ShopFloor.ro</small></p>`,
      ['requestNumber','machineCode','problemType','priority','description']
    ),
    // machine_stop - ro
    tpl('machine_stop', 'ro',
      'Oprire masina: {machineCode} — {reason}',
      `<h2>Masina oprita: {machineCode}</h2><p><b>Motiv:</b> {reason}</p><p><b>Categorie:</b> {category}</p><hr/><p><small>ShopFloor.ro</small></p>`,
      ['machineCode','reason','category']
    ),
    // machine_stop - en
    tpl('machine_stop', 'en',
      'Machine stop: {machineCode} — {reason}',
      `<h2>Machine stopped: {machineCode}</h2><p><b>Reason:</b> {reason}</p><p><b>Category:</b> {category}</p><hr/><p><small>ShopFloor.ro</small></p>`,
      ['machineCode','reason','category']
    ),
    // stock_low - ro
    tpl('stock_low', 'ro',
      'ALERTA STOC: {itemName} — {currentQty}/{minStock}',
      `<h2>Alerta stoc minim</h2><p><b>Articol:</b> {itemName}</p><p><b>Stoc curent:</b> {currentQty}</p><p><b>Stoc minim:</b> {minStock}</p><hr/><p><small>ShopFloor.ro</small></p>`,
      ['itemName','currentQty','minStock']
    ),
    // stock_low - en
    tpl('stock_low', 'en',
      'STOCK ALERT: {itemName} — {currentQty}/{minStock}',
      `<h2>Low stock alert</h2><p><b>Item:</b> {itemName}</p><p><b>Current stock:</b> {currentQty}</p><p><b>Minimum stock:</b> {minStock}</p><hr/><p><small>ShopFloor.ro</small></p>`,
      ['itemName','currentQty','minStock']
    ),
    // oee_low - ro
    tpl('oee_low', 'ro',
      'OEE scazut: {machineCode} — {oeePercent}%',
      `<h2>OEE sub 60%: {machineCode}</h2><p><b>OEE:</b> {oeePercent}%</p><p>Verificati motivele de oprire si rebuturile pentru aceasta masina.</p><hr/><p><small>ShopFloor.ro</small></p>`,
      ['machineCode','oeePercent']
    ),
    // oee_low - en
    tpl('oee_low', 'en',
      'Low OEE: {machineCode} — {oeePercent}%',
      `<h2>OEE below 60%: {machineCode}</h2><p><b>OEE:</b> {oeePercent}%</p><p>Please check the stop reasons and scrap for this machine.</p><hr/><p><small>ShopFloor.ro</small></p>`,
      ['machineCode','oeePercent']
    ),
  ];

  await knex('system.email_templates').insert(templates);
  console.log('[seed:email_templates] Inserted', templates.length, 'templates');
}
