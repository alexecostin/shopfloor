import db from '../src/config/db.js';

const tid = '7e484f46-f168-4a8e-ab23-fa289c417253'; // Metalex

console.log('=== CURATARE BAZA DE DATE ===');

// Stergem in ordine inversa dependintelor
await db('planning.daily_allocations').del().catch(()=>{});
await db('planning.capacity_load').del().catch(()=>{});
await db('planning.customer_demands').del().catch(()=>{});
await db('planning.scheduled_operations').del().catch(()=>{});
await db('planning.scheduling_runs').del().catch(()=>{});
await db('planning.master_plans').del().catch(()=>{});
console.log('  Planning: sters');

await db('production.rework_queue').del().catch(()=>{});
await db('production.reports').del().catch(()=>{});
await db('production.stops').del().catch(()=>{});
await db('production.technical_checks').del().catch(()=>{});
await db('production.hr_allocations').del().catch(()=>{});
await db('production.work_order_operations').del().catch(()=>{});
await db('production.work_orders').del().catch(()=>{});
console.log('  Production: sters');

await db('purchasing.po_receipts').del().catch(()=>{});
await db('purchasing.purchase_order_lines').del().catch(()=>{});
await db('purchasing.purchase_orders').del().catch(()=>{});
console.log('  Purchasing: sters');

await db('shipments.shipment_documents').del().catch(()=>{});
await db('shipments.shipment_packages').del().catch(()=>{});
await db('shipments.shipments').del().catch(()=>{});
console.log('  Shipments: sters');

await db('quality.capa').del().catch(()=>{});
await db('quality.ncr').del().catch(()=>{});
await db('quality.spc_data').del().catch(()=>{});
await db('quality.measurements').del().catch(()=>{});
await db('quality.measurement_plans').del().catch(()=>{});
console.log('  Quality: sters');

await db('traceability.production_lot_usage').del().catch(()=>{});
await db('traceability.serial_numbers').del().catch(()=>{});
await db('traceability.lot_tracking').del().catch(()=>{});
console.log('  Traceability: sters');

await db('maintenance.requests').del().catch(()=>{});
await db('maintenance.planned_interventions').del().catch(()=>{});
console.log('  Maintenance: sters');

await db('audit.business_actions').del().catch(()=>{});
await db('audit.change_log').del().catch(()=>{});
console.log('  Audit: sters');

await db('bom.operation_alternatives').del().catch(()=>{});
await db('bom.operation_dependencies').del().catch(()=>{});
await db('bom.operations').del().catch(()=>{});
await db('bom.materials').del().catch(()=>{});
await db('bom.assembly_components').del().catch(()=>{});
await db('bom.products').del().catch(()=>{});
console.log('  BOM: sters');

await db('inventory.barcodes').del().catch(()=>{});
console.log('  Barcodes: sters');

await db.raw("SELECT setval('production.work_order_seq', 1, false)").catch(()=>{});
await db.raw("SELECT setval('maintenance.request_number_seq', 1, false)").catch(()=>{});
console.log('  Sequences: resetate');

// ═══ MASINI ═══
console.log('\n=== CONFIGURARE MASINI (30 + 3 asamblare) ===');
await db('machines.machine_operators').del().catch(()=>{});
await db('machines.machines').where('tenant_id', tid).del().catch(()=>{});
await db('machines.machines').whereNull('tenant_id').del().catch(()=>{});
await db('machines.machines').del().catch(()=>{}); // try full delete

const clujFactory = '81a1ed5f-9673-47df-b191-06b83b484e16';
const sectiaCNC = 'a66c8b8e-5572-46e3-b815-1ef1faf66792';
const sectiaAsm = '565aea15-8f15-45b4-8c97-75789d6d7150';
const sectiaDeb = 'a4e3b245-10a1-4a8a-8a7e-83406bc6138f';

const machines = [
  { code: 'STR-01', name: 'Strung CNC Okuma LB3000', type: 'strung_cnc', org_unit_id: sectiaCNC },
  { code: 'STR-02', name: 'Strung CNC Mazak QT-250', type: 'strung_cnc', org_unit_id: sectiaCNC },
  { code: 'STR-03', name: 'Strung CNC DMG CLX 350', type: 'strung_cnc', org_unit_id: sectiaCNC },
  { code: 'STR-04', name: 'Strung CNC Haas ST-20', type: 'strung_cnc', org_unit_id: sectiaCNC },
  { code: 'STR-05', name: 'Strung CNC Doosan Puma', type: 'strung_cnc', org_unit_id: sectiaCNC },
  { code: 'STR-06', name: 'Strung CNC Nakamura WT-150', type: 'strung_cnc', org_unit_id: sectiaCNC },
  { code: 'FRZ-01', name: 'Centru frezare Haas VF-2', type: 'frezare_cnc', org_unit_id: sectiaCNC },
  { code: 'FRZ-02', name: 'Centru frezare DMG CMX 600', type: 'frezare_cnc', org_unit_id: sectiaCNC },
  { code: 'FRZ-03', name: 'Centru frezare Mazak VCN-530', type: 'frezare_cnc', org_unit_id: sectiaCNC },
  { code: 'FRZ-04', name: 'Centru frezare Okuma MB-46', type: 'frezare_cnc', org_unit_id: sectiaCNC },
  { code: 'FRZ-05', name: 'Centru frezare Brother S700', type: 'frezare_cnc', org_unit_id: sectiaCNC },
  { code: 'FRZ-06', name: 'Centru frezare Fanuc Robodrill', type: 'frezare_cnc', org_unit_id: sectiaCNC },
  { code: 'RCT-01', name: 'Rectificator Jones & Shipman', type: 'rectificare', org_unit_id: sectiaCNC },
  { code: 'RCT-02', name: 'Rectificator Studer S33', type: 'rectificare', org_unit_id: sectiaCNC },
  { code: 'RCT-03', name: 'Rectificator Kellenberger', type: 'rectificare', org_unit_id: sectiaCNC },
  { code: 'DEB-01', name: 'Fierastrau banda Behringer', type: 'debitare', org_unit_id: sectiaDeb },
  { code: 'DEB-02', name: 'Fierastrau banda Kasto', type: 'debitare', org_unit_id: sectiaDeb },
  { code: 'DEB-03', name: 'Debitare laser Trumpf', type: 'debitare_laser', org_unit_id: sectiaDeb },
  { code: 'DEB-04', name: 'Debitare plasma Hypertherm', type: 'debitare_plasma', org_unit_id: sectiaDeb },
  { code: 'GAU-01', name: 'Masina gaurit Alzmetall', type: 'gaurire', org_unit_id: sectiaCNC },
  { code: 'GAU-02', name: 'CNC Gaurire Heller', type: 'gaurire', org_unit_id: sectiaCNC },
  { code: 'TT-01', name: 'Cuptor tratament Nabertherm', type: 'tratament_termic', org_unit_id: sectiaCNC },
  { code: 'TT-02', name: 'Cuptor calire Ipsen', type: 'tratament_termic', org_unit_id: sectiaCNC },
  { code: 'SUD-01', name: 'Robot sudura Kuka MIG/MAG', type: 'sudura', org_unit_id: sectiaCNC },
  { code: 'SUD-02', name: 'Sudura TIG Fronius', type: 'sudura', org_unit_id: sectiaCNC },
  { code: 'CMM-01', name: 'CMM Zeiss Contura', type: 'masurare', org_unit_id: sectiaCNC },
  { code: 'CMM-02', name: 'CMM Mitutoyo Crysta', type: 'masurare', org_unit_id: sectiaCNC },
  { code: 'ASM-01', name: 'Statie asamblare manuala 1', type: 'asamblare', org_unit_id: sectiaAsm },
  { code: 'ASM-02', name: 'Statie asamblare manuala 2', type: 'asamblare', org_unit_id: sectiaAsm },
  { code: 'ASM-03', name: 'Statie asamblare semi-auto', type: 'asamblare', org_unit_id: sectiaAsm },
];

for (const m of machines) {
  await db('machines.machines').insert({
    ...m, tenant_id: tid, status: 'active', location: 'Hala Productie Cluj',
  }).onConflict('code').merge();
}
console.log('  ' + machines.length + ' masini create');

// ═══ MATERIALE ═══
console.log('\n=== MATERIALE IN STOC ===');
await db('inventory.stock_levels').whereIn('item_id', db('inventory.items').where('tenant_id', tid).select('id')).del().catch(()=>{});
await db('inventory.items').where('tenant_id', tid).del().catch(()=>{});

const materials = [
  { code: 'OL-C45', name: 'Otel C45 rotund', category: 'raw_material', unit: 'kg', min_stock: 500, current_stock: 2000 },
  { code: 'OL-42CRMO4', name: 'Otel 42CrMo4 rotund', category: 'raw_material', unit: 'kg', min_stock: 300, current_stock: 1500 },
  { code: 'OL-S235', name: 'Otel S235 plat', category: 'raw_material', unit: 'kg', min_stock: 400, current_stock: 1800 },
  { code: 'AL-6061', name: 'Aluminiu 6061-T6', category: 'raw_material', unit: 'kg', min_stock: 200, current_stock: 800 },
  { code: 'INOX-304', name: 'Inox AISI 304', category: 'raw_material', unit: 'kg', min_stock: 100, current_stock: 400 },
  { code: 'BRONZ-CU', name: 'Bronz CuSn8', category: 'raw_material', unit: 'kg', min_stock: 50, current_stock: 150 },
  { code: 'TEAVA-40', name: 'Teava otel D40x3 L6m', category: 'raw_material', unit: 'buc', min_stock: 50, current_stock: 200 },
  { code: 'TEAVA-60', name: 'Teava otel D60x4 L6m', category: 'raw_material', unit: 'buc', min_stock: 30, current_stock: 100 },
  { code: 'PLACA-20', name: 'Placa otel 20mm grosime', category: 'raw_material', unit: 'buc', min_stock: 20, current_stock: 80 },
  { code: 'SURUB-M6', name: 'Surub M6x20 DIN 912', category: 'raw_material', unit: 'buc', min_stock: 1000, current_stock: 5000 },
  { code: 'SURUB-M8', name: 'Surub M8x25 DIN 912', category: 'raw_material', unit: 'buc', min_stock: 1000, current_stock: 4000 },
  { code: 'SURUB-M10', name: 'Surub M10x30 DIN 912', category: 'raw_material', unit: 'buc', min_stock: 500, current_stock: 2000 },
  { code: 'PIULITA-M8', name: 'Piulita M8 DIN 934', category: 'raw_material', unit: 'buc', min_stock: 1000, current_stock: 3000 },
  { code: 'STIFT-6', name: 'Stift cilindric D6x24', category: 'raw_material', unit: 'buc', min_stock: 500, current_stock: 2000 },
  { code: 'RULMENT-6205', name: 'Rulment SKF 6205', category: 'spare_part', unit: 'buc', min_stock: 10, current_stock: 25 },
  { code: 'ORING-40', name: 'O-ring D40x3 NBR', category: 'raw_material', unit: 'buc', min_stock: 100, current_stock: 500 },
  { code: 'ULEI-HYD', name: 'Ulei hidraulic ISO 46', category: 'consumable', unit: 'litri', min_stock: 100, current_stock: 400 },
  { code: 'LIQ-RACIRE', name: 'Lichid racire Castrol', category: 'consumable', unit: 'litri', min_stock: 200, current_stock: 800 },
];

for (const m of materials) {
  const [item] = await db('inventory.items').insert({
    code: m.code, name: m.name, category: m.category, unit: m.unit, min_stock: m.min_stock,
    tenant_id: tid, is_active: true,
  }).returning('id');
  await db('inventory.stock_levels').insert({
    item_id: item.id, current_qty: m.current_stock, reserved_qty: 0,
  }).onConflict('item_id').merge();
}
console.log('  ' + materials.length + ' materiale cu stoc');

// ═══ COMPANII ═══
console.log('\n=== COMPANII ===');
await db('companies.contacts').whereIn('company_id', db('companies.companies').where('tenant_id', tid).select('id')).del().catch(()=>{});
await db('companies.companies').where('tenant_id', tid).del().catch(()=>{});

const companies = [
  { name: 'AutoParts GmbH', types: ['client'], country: 'Germania', city: 'Stuttgart' },
  { name: 'Continental Automotive', types: ['client'], country: 'Romania', city: 'Timisoara' },
  { name: 'Dacia Renault', types: ['client'], country: 'Romania', city: 'Mioveni' },
  { name: 'Bosch Engineering', types: ['client'], country: 'Germania', city: 'Stuttgart' },
  { name: 'Festo Romania', types: ['client'], country: 'Romania', city: 'Bucuresti' },
  { name: 'Siemens Industrial', types: ['client'], country: 'Germania', city: 'Erlangen' },
  { name: 'Schaeffler Group', types: ['client'], country: 'Germania', city: 'Herzogenaurach' },
  { name: 'ZF Friedrichshafen', types: ['client'], country: 'Germania', city: 'Friedrichshafen' },
  { name: 'Magna International', types: ['client', 'furnizor'], country: 'Austria', city: 'Graz' },
  { name: 'Valeo Romania', types: ['client'], country: 'Romania', city: 'Timisoara' },
  { name: 'ArcelorMittal Romania', types: ['furnizor'], country: 'Romania', city: 'Galati' },
  { name: 'Sandvik Coromant', types: ['furnizor'], country: 'Suedia', city: 'Stockholm' },
  { name: 'Iscar Romania', types: ['furnizor'], country: 'Romania', city: 'Bucuresti' },
  { name: 'SKF Romania', types: ['furnizor'], country: 'Romania', city: 'Brasov' },
  { name: 'ThyssenKrupp Materials', types: ['furnizor'], country: 'Germania', city: 'Essen' },
];

for (const c of companies) {
  await db('companies.companies').insert({
    name: c.name, company_types: JSON.stringify(c.types),
    country: c.country, city: c.city, tenant_id: tid, is_active: true,
  });
}
console.log('  ' + companies.length + ' companii (10 clienti + 5 furnizori)');

console.log('\n=== BAZA DE DATE CURATATA SI PREGATITA ===');
console.log('  Masini: 30');
console.log('  Materiale: ' + materials.length);
console.log('  Companii: ' + companies.length);
console.log('  Utilizatori: pastrati');
console.log('  Ture: pastrate');
console.log('\nGata pentru simulare!');

await db.destroy();
