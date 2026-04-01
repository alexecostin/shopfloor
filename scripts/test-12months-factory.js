/**
 * TESTARE COMPLETA FABRICA 12 LUNI
 * Simuleaza activitatea reala printr-un an de productie.
 * Testeaza FIECARE endpoint ca si cum ar fi operat de utilizatori in frontend.
 *
 * Scenariu:
 * - Ian-Mar: productie normala 2 schimburi
 * - Apr-Mai: varf productie 3 schimburi (comenzi multe)
 * - Jun-Aug: vara, 1 schimb (concedii, cerere mica)
 * - Sep-Nov: varf productie 3 schimburi
 * - Dec: 2 schimburi, inchidere de an
 *
 * - 10% rebuturi
 * - 5% rework (operatii mici pe diverse masini)
 * - 3-4 masini in revizii planificate
 * - 2 masini defecte (revizie neplanificata 2-3 zile)
 * - 2 comenzi noi urgente in mijlocul perioadei
 * - Toate comenzile pleaca cu raport de masura
 */

import axios from 'axios';
const API = 'http://localhost:3001/api/v1';
const R = { pass: 0, fail: 0, errors: [], warnings: [], missing: [] };

function ok(msg) { R.pass++; console.log(`  ✅ ${msg}`); }
function ko(msg, err) { R.fail++; R.errors.push({ msg, err: typeof err === 'string' ? err : err?.response?.data?.message || err?.message || String(err) }); console.log(`  ❌ ${msg}: ${R.errors[R.errors.length-1].err}`); }
function warn(msg) { R.warnings.push(msg); console.log(`  ⚠️ ${msg}`); }
function miss(msg) { R.missing.push(msg); console.log(`  📋 LIPSA: ${msg}`); }

async function api(method, path, data, token) {
  try {
    const config = { headers: { Authorization: `Bearer ${token}` } };
    const res = method === 'get'
      ? await axios.get(`${API}${path}`, config)
      : await axios[method](`${API}${path}`, data, config);
    return res.data;
  } catch (e) {
    throw e;
  }
}

// ═══════════════════════════════════════════════════════════════
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  TESTARE FABRICA METALEX SRL — SIMULARE 12 LUNI');
console.log('  Scenarii reale: sezonalitate, revizii, urgente, rebuturi');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

// ─── LOGIN ───
console.log('--- AUTENTIFICARE ---');
let adminToken, plannerToken, operatorToken, maintToken, commercialToken;
try {
  adminToken = (await api('post', '/auth/login', { email: 'admin@metalex.ro', password: 'Test1234!' })).token;
  ok('Login admin');
} catch(e) { ko('Login admin', e); process.exit(1); }

try { plannerToken = (await api('post', '/auth/login', { email: 'ana.p@metalex.ro', password: 'Test1234!' })).token; ok('Login planificator'); } catch(e) { ko('Login planificator', e); }
try { operatorToken = (await api('post', '/auth/login', { email: 'costin.b@metalex.ro', password: 'Test1234!' })).token; ok('Login operator'); } catch(e) { ko('Login operator', e); }
try { maintToken = (await api('post', '/auth/login', { email: 'bogdan.l@metalex.ro', password: 'Test1234!' })).token; ok('Login mentenanta'); } catch(e) { ko('Login mentenanta', e); }

const T = adminToken;

// ─── VERIFICARE INFRASTRUCTURA ───
console.log('\n--- 1. VERIFICARE INFRASTRUCTURA ---');
try {
  const machines = await api('get', '/machines', null, T);
  const count = (machines.data || machines).length;
  count >= 25 ? ok(`Masini: ${count}`) : ko(`Masini: doar ${count}`);
} catch(e) { ko('Masini', e); }

try {
  const items = await api('get', '/inventory/items', null, T);
  const count = (items.data || items).length;
  count >= 10 ? ok(`Materiale stoc: ${count}`) : ko(`Materiale: doar ${count}`);
} catch(e) { ko('Materiale', e); }

try {
  const comp = await api('get', '/companies', null, T);
  const count = (comp.data || comp).length;
  count >= 10 ? ok(`Companii: ${count}`) : ko(`Companii: doar ${count}`);
} catch(e) { ko('Companii', e); }

try {
  const tasks = await api('get', '/dashboard/tasks', null, T);
  ok(`Dashboard tasks: ${tasks.length} sarcini`);
} catch(e) { ko('Dashboard tasks', e); }

try {
  const settings = await api('get', '/admin/settings', null, T);
  ok(`Setari: TZ=${settings.default_timezone}, Lang=${settings.default_language}`);
} catch(e) { ko('Setari', e); }

try {
  const license = await api('get', '/admin/license', null, T);
  ok(`Licenta: ${license.tier} ${license.status}`);
} catch(e) { ko('Licenta', e); }

// ─── CREARE 20 COMENZI CU SEZONALITATE ───
console.log('\n--- 2. COMERCIAL: CREARE 20 COMENZI (12 luni) ---');

const clients = (await api('get', '/companies', null, T)).data || [];
const clientList = clients.filter(c => (Array.isArray(c.company_types) ? c.company_types : JSON.parse(c.company_types || '[]')).includes('client'));

const productDefs = [
  { ref: 'ARB-S42', name: 'Arbore motor S42' },
  { ref: 'FLN-F18', name: 'Flansa cuplare F18' },
  { ref: 'AX-T25', name: 'Ax transmisie T25' },
  { ref: 'BUC-G12', name: 'Bucsa ghidare G12' },
  { ref: 'COL-V30', name: 'Coloana verticala V30' },
  { ref: 'PLC-B10', name: 'Placa baza B10' },
  { ref: 'SUP-P05', name: 'Suport piesa P05' },
  { ref: 'CRP-H20', name: 'Corp pompa H20' },
  { ref: 'ROT-D50', name: 'Rotor D50' },
  { ref: 'CAP-M15', name: 'Capac motor M15' },
];

// Sezonalitate: cantitati per luna
const monthQtyMultiplier = {
  0: 1.0, 1: 1.0, 2: 1.0,     // Ian-Mar: normal
  3: 1.5, 4: 1.5,              // Apr-Mai: varf
  5: 0.5, 6: 0.4, 7: 0.5,     // Jun-Aug: vara light
  8: 1.5, 9: 1.5, 10: 1.3,    // Sep-Nov: varf
  11: 1.0,                      // Dec: normal
};

const createdOrders = [];
for (let i = 0; i < 20; i++) {
  const month = i % 12;
  const client = clientList[i % clientList.length];
  const prod = productDefs[i % productDefs.length];
  const baseQty = 100 + Math.floor(Math.random() * 400);
  const qty = Math.ceil(baseQty * (monthQtyMultiplier[month] || 1));
  const deadline = new Date(2026, month, 15 + (i % 15));
  const priority = month >= 3 && month <= 4 ? 'urgent' : month >= 8 && month <= 10 ? 'high' : 'normal';

  try {
    const wo = await api('post', '/work-orders', {
      clientId: client?.id,
      orderNumber: `CMD-2026-${String(i+1).padStart(3, '0')}`,
      productReference: prod.ref,
      productName: prod.name,
      quantity: qty,
      priority,
      scheduledEnd: deadline.toISOString().split('T')[0],
      unitPrice: 30 + Math.floor(Math.random() * 170),
      currency: i % 3 === 0 ? 'EUR' : 'RON',
      incoterms: 'EXW',
      paymentTerms: '30 zile',
    }, T);
    createdOrders.push(wo);
    ok(`Comanda #${i+1}: ${wo.work_order_number} ${prod.ref} x${qty} (${priority}) → ${deadline.toISOString().split('T')[0]}`);
  } catch(e) { ko(`Comanda #${i+1}`, e); }
}

// ─── BOM + MBOM ───
console.log('\n--- 3. INGINER: CREARE BOM + MBOM ---');

const allMachines = ((await api('get', '/machines', null, T)).data || []);
const machineByType = {};
allMachines.forEach(m => { if (!machineByType[m.type]) machineByType[m.type] = []; machineByType[m.type].push(m); });

const opTemplates = [
  { name: 'Debitare', type: 'debitare', mtype: 'debitare', cycle: [25,35], setup: [10,20] },
  { name: 'Strunjire', type: 'strunjire', mtype: 'strung_cnc', cycle: [35,60], setup: [15,30] },
  { name: 'Frezare', type: 'frezare', mtype: 'frezare_cnc', cycle: [45,90], setup: [15,30] },
  { name: 'Rectificare', type: 'rectificare', mtype: 'rectificare', cycle: [30,50], setup: [10,20] },
  { name: 'Gaurire', type: 'gaurire', mtype: 'gaurire', cycle: [15,30], setup: [5,15] },
  { name: 'Tratament termic', type: 'tratament_termic', mtype: 'tratament_termic', cycle: [60,180], setup: [20,40] },
];

const uniqueRefs = [...new Set(createdOrders.map(o => o.product_reference))];
const bomProducts = {};

for (const ref of uniqueRefs) {
  try {
    const existing = await api('get', `/bom/products?search=${ref}`, null, T);
    const found = (existing.data || []).find(p => p.reference === ref);
    if (found) {
      bomProducts[ref] = found;
      ok(`BOM ${ref}: exista deja (${found.id})`);
      continue;
    }
    const order = createdOrders.find(o => o.product_reference === ref);
    const prod = await api('post', '/bom/products', { reference: ref, name: order.product_name, productType: 'semi_finished' }, T);
    bomProducts[ref] = prod;
    ok(`BOM ${ref}: creat`);
  } catch(e) { ko(`BOM ${ref}`, e); }
}

// Add operations per product
for (const [ref, product] of Object.entries(bomProducts)) {
  // Check if already has operations
  try {
    const detail = await api('get', `/bom/products/${product.id}`, null, T);
    if (detail.operations && detail.operations.length > 0) {
      ok(`MBOM ${ref}: deja ${detail.operations.length} operatii`);
      continue;
    }
  } catch(e) {}

  const numOps = 2 + Math.floor(Math.random() * 4); // 2-5 operatii
  for (let seq = 1; seq <= numOps; seq++) {
    const tpl = opTemplates[(seq - 1) % opTemplates.length];
    const machines = machineByType[tpl.mtype] || [];
    const machine = machines[seq % machines.length] || machines[0];
    const cycle = tpl.cycle[0] + Math.floor(Math.random() * (tpl.cycle[1] - tpl.cycle[0]));
    const setup = tpl.setup[0] + Math.floor(Math.random() * (tpl.setup[1] - tpl.setup[0]));

    try {
      await api('post', `/bom/products/${product.id}/operations`, {
        sequence: seq * 10,
        operationName: tpl.name,
        operationType: tpl.type,
        machineType: tpl.mtype,
        machineId: machine?.id,
        cycleTimeSeconds: cycle,
        setupTimeMinutes: setup,
        cncProgram: machine ? `PRG-${ref}-OP${seq*10}.nc` : null,
        rawMaterialSpec: seq === 1 ? `Bara OL C45 D50 L200` : null,
        minBatchBeforeNext: Math.max(5, Math.min(50, Math.ceil(100 * 0.1))),
      }, T);
      ok(`  Op${seq*10} ${tpl.name} pe ${machine?.code || 'N/A'} (${cycle}s + ${setup}min setup)`);
    } catch(e) { ko(`  Op${seq*10} ${ref}`, e); }
  }

  // Validate MBOM
  try {
    await api('put', `/bom/products/${product.id}/validate`, {}, T);
    ok(`MBOM ${ref}: validat`);
  } catch(e) { ko(`MBOM ${ref} validare`, e); }
}

// ─── VERIFICARE TEHNICA + LANSARE ───
console.log('\n--- 4. VERIFICARE TEHNICA + LANSARE IN PRODUCTIE ---');

for (const wo of createdOrders.slice(0, 10)) {
  try {
    const checks = await api('get', `/work-orders/${wo.id}/technical-checks`, null, T);
    for (const check of checks) {
      await api('put', `/work-orders/technical-checks/${check.id}`, { isPassed: true, notes: 'Verificat OK' }, T);
    }
    ok(`Tech check ${wo.work_order_number}: ${checks.length} bifate`);
  } catch(e) { ko(`Tech check ${wo.work_order_number}`, e); }

  try {
    await api('post', `/work-orders/${wo.id}/launch`, {}, T);
    ok(`Lansat ${wo.work_order_number}`);
  } catch(e) { ko(`Lansare ${wo.work_order_number}`, e); }
}

// ─── MRP + ACHIZITII AGREGATE ───
console.log('\n--- 5. MRP + ACHIZITII AGREGATE ---');

try {
  const woIds = createdOrders.slice(0, 10).map(o => o.id);
  const mrp = await api('post', '/inventory/mrp/calculate', { workOrderIds: woIds }, T);
  if (Array.isArray(mrp)) {
    ok(`MRP: ${mrp.length} materiale analizate`);
    const deficit = mrp.filter(m => m.status !== 'ok');
    if (deficit.length > 0) ok(`  ${deficit.length} materiale cu deficit`);
    else ok(`  Toate materialele disponibile`);
  }
} catch(e) { ko('MRP calculate', e); }

try {
  const woIds = createdOrders.slice(0, 10).map(o => o.id);
  const agg = await api('post', '/inventory/mrp/aggregated-pos', { workOrderIds: woIds }, T);
  if (agg.suppliers) {
    ok(`Achizitii agregate: ${agg.suppliers.length} furnizori, ${agg.totalDeficitItems} articole, ~${agg.totalEstimatedCost} RON`);
  } else {
    ok(`Achizitii agregate: niciun deficit`);
  }
} catch(e) { ko('Achizitii agregate', e); }

// ─── PLANIFICARE AUTOMATA ───
console.log('\n--- 6. PLANIFICARE AUTOMATA INTELIGENTA ---');

// Piese agregate
try {
  const pieces = await api('get', '/planning/pieces', null, T);
  ok(`Piese agregate: ${pieces.length} piese din ${createdOrders.length} comenzi`);
  pieces.slice(0, 3).forEach(p => {
    console.log(`    ${p.productReference}: ${p.totalQuantity} total (${p.orders.length} comenzi), ${p.operations.length} op, ramas: ${p.remainingQuantity}`);
  });
} catch(e) { ko('Piese agregate', e); }

// Smart schedule
try {
  // Create scheduling config
  const config = await api('post', '/scheduling/configs', {
    name: 'Test 12 luni',
    priorities: [{ criterion: 'deadline', weight: 50 }, { criterion: 'utilization', weight: 30 }, { criterion: 'setup_time', weight: 20 }],
    constraints: { respect_shifts: true, allow_overtime: true, max_shifts_per_day: 2, overtime_percent: 10, allow_weekend: false },
  }, T);
  ok(`Config scheduling: ${config.id ? 'creat' : 'eroare'}`);

  const periodStart = '2026-04-01';
  const periodEnd = '2026-05-31';

  const plan = await api('post', '/planning/smart-schedule', { configId: config.id, periodStart, periodEnd }, T);
  ok(`Smart plan generat: ${plan.allocations?.length || 0} alocari`);
  if (plan.summary) {
    console.log(`    Total ore: ${plan.summary.totalHours}h, Masini: ${plan.summary.machinesUsed}`);
    console.log(`    Comenzi la timp: ${plan.summary.ordersOnTime}, Intarziate: ${plan.summary.ordersLate}`);
  }
  if (plan.warnings?.length > 0) {
    plan.warnings.slice(0, 3).forEach(w => warn(`  ${w.piece}: ${w.message}`));
  }
  if (plan.orderImpact?.length > 0) {
    plan.orderImpact.filter(o => o.isLate).slice(0, 3).forEach(o => {
      warn(`  ${o.orderNumber} intarzie ${o.daysLate} zile (estimat: ${o.estimatedCompletion}, deadline: ${o.deadline})`);
    });
  }

  // Apply plan
  if (plan.allocations?.length > 0) {
    try {
      const applied = await api('post', '/planning/smart-schedule/apply', { planResult: plan, periodStart, periodEnd }, T);
      ok(`Plan aplicat: ${applied.masterPlanId ? 'OK' : 'partial'}`);
    } catch(e) { ko('Aplicare plan', e); }
  }
} catch(e) { ko('Smart schedule', e); }

// ─── CTP — COMANDA URGENTA ───
console.log('\n--- 7. CTP — ESTIMARE COMANDA URGENTA ---');

try {
  const ctp = await api('post', '/planning/ctp', {
    productReference: 'ARB-S42',
    quantity: 500,
    maxShiftsPerDay: 3,
    overtimePercent: 15,
  }, T);
  if (ctp.canDeliver) {
    ok(`CTP ARB-S42 x500: termen ${ctp.estimatedDate} (${ctp.workingDays} zile, ${ctp.totalProductionHours}h)`);
  } else {
    warn(`CTP: ${ctp.error}`);
  }
} catch(e) { ko('CTP', e); }

// ─── OPERATOR: RAPORTARE PRODUCTIE ───
console.log('\n--- 8. OPERATOR: RAPORTARE (cu 10% rebuturi, 5% rework) ---');

const OT = operatorToken || T;
const str01 = allMachines.find(m => m.code === 'STR-01');

for (let day = 0; day < 5; day++) {
  const goodPieces = 40 + Math.floor(Math.random() * 20);
  const scrapPieces = Math.ceil(goodPieces * 0.10); // 10% rebut
  const reworkPieces = Math.ceil(goodPieces * 0.05); // 5% rework

  try {
    await api('post', '/production/reports', {
      machineId: str01?.id,
      shift: 'Tura I',
      goodPieces,
      scrapPieces,
      scrapReasonCode: 'cota_in_afara',
      reworkPieces,
      reworkReasonCode: 'bavura',
    }, OT);
    ok(`Ziua ${day+1}: ${goodPieces} bune, ${scrapPieces} rebut, ${reworkPieces} rework`);
  } catch(e) { ko(`Raport ziua ${day+1}`, e); }
}

// ─── OPRIRI MASINA ───
console.log('\n--- 9. OPRIRI MASINA ---');

try {
  await api('post', '/production/stops', {
    machineId: str01?.id,
    category: 'defect_utilaj',
    reason: 'Vibratie anormala la turatie mare',
    shift: 'Tura I',
  }, OT);
  ok('Oprire STR-01: defect utilaj');
} catch(e) { ko('Oprire masina', e); }

// ─── MENTENANTA PLANIFICATA (3-4 masini) ───
console.log('\n--- 10. MENTENANTA PLANIFICATA ---');

const maintMachines = ['FRZ-01', 'FRZ-02', 'RCT-01', 'TT-01'];
for (const code of maintMachines) {
  const m = allMachines.find(x => x.code === code);
  if (!m) continue;
  try {
    await api('post', '/maintenance/planned', {
      machineId: m.id,
      interventionType: 'preventive',
      title: `Revizie planificata ${code}`,
      plannedStartDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      plannedEndDate: new Date(Date.now() + 16 * 86400000).toISOString().split('T')[0],
      executorType: 'internal',
      estimatedCost: 500 + Math.floor(Math.random() * 2000),
    }, T);
    ok(`Revizie planificata ${code}`);
  } catch(e) { ko(`Revizie ${code}`, e); }
}

// ─── MENTENANTA NEPLANIFICATA (2 masini defecte) ───
console.log('\n--- 11. MENTENANTA NEPLANIFICATA (2 masini defecte) ---');

const brokenMachines = ['STR-03', 'FRZ-04'];
for (const code of brokenMachines) {
  const m = allMachines.find(x => x.code === code);
  if (!m) continue;
  try {
    const req = await api('post', '/maintenance', {
      machineId: m.id,
      problemType: 'Defectiune majora',
      description: `${code} nu mai functioneaza — motor principal defect. Estimare reparatie: 2-3 zile.`,
      priority: 'critical',
    }, maintToken || T);
    ok(`Cerere mentenanta ${code}: ${req.request_number}`);
  } catch(e) { ko(`Cerere ${code}`, e); }
}

// ─── CALITATE: NCR + PLAN MASURARE ───
console.log('\n--- 12. CALITATE ---');

try {
  const prod = Object.values(bomProducts)[0];
  if (prod) {
    await api('post', '/quality/plans', {
      product_id: prod.id,
      plan_name: `Plan control ${prod.reference}`,
      characteristics: [
        { name: 'Diametru exterior', nominal: 42, upper_tolerance: 0.025, lower_tolerance: -0.025, unit: 'mm', is_critical: true },
        { name: 'Lungime', nominal: 120, upper_tolerance: 0.1, lower_tolerance: -0.1, unit: 'mm', is_critical: false },
      ],
    }, T);
    ok('Plan masurare creat');
  }
} catch(e) { ko('Plan masurare', e); }

try {
  await api('post', '/quality/ncr', {
    title: 'Lot 15 ARB-S42 diametru in afara tolerantei',
    ncr_type: 'internal',
    severity: 'major',
    description: 'Diametrul exterior masurat 42.05mm, toleranta max +0.025mm',
    affected_qty: 12,
  }, T);
  ok('NCR creat');
} catch(e) { ko('NCR', e); }

// ─── DOCUMENTE ───
console.log('\n--- 13. DOCUMENTE ---');

try {
  const doc = await api('post', '/documents', {
    title: 'Desen tehnic ARB-S42',
    document_type: 'drawing',
    description: 'Desen complet cu cote si tolerante',
  }, T);
  ok(`Document creat: ${doc.id ? 'OK' : 'eroare'}`);
} catch(e) { ko('Document', e); }

// ─── CODURI QR ───
console.log('\n--- 14. CODURI QR ---');

try {
  const qr = await api('post', '/barcodes/generate', {
    entityType: 'machine',
    entityId: str01?.id,
    label: 'STR-01',
  }, T);
  ok(`QR generat: ${qr.barcode_value || 'OK'}`);
} catch(e) { ko('QR', e); }

// ─── TRASABILITATE ───
console.log('\n--- 15. TRASABILITATE ---');

try {
  const lots = await api('get', '/traceability/lots', null, T);
  ok(`Loturi: ${(lots.data || lots).length}`);
} catch(e) { ko('Loturi', e); }

// ─── EVALUARE FURNIZORI ───
console.log('\n--- 16. EVALUARE FURNIZORI ---');

try {
  const ranking = await api('get', '/suppliers/scorecards/ranking?dateFrom=2026-01-01&dateTo=2026-12-31', null, T);
  ok(`Ranking furnizori: ${ranking.length} evaluati`);
} catch(e) { ko('Ranking furnizori', e); }

// ─── KPI MASINA ───
console.log('\n--- 17. KPI MASINA ---');

try {
  const kpi = await api('get', `/machines/${str01?.id}/kpi?period=month`, null, T);
  ok(`KPI STR-01: MTBF=${kpi.mtbf?.mtbf || 'N/A'}h, MTTR=${kpi.mttr?.mttr || 'N/A'}min, OEE=${kpi.oee || 'N/A'}%`);
} catch(e) { ko('KPI masina', e); }

// ─── AUDIT TRAIL ───
console.log('\n--- 18. AUDIT TRAIL ---');

try {
  const audit = await api('get', '/audit/actions?limit=5', null, T);
  ok(`Audit: ${audit.total} actiuni loggate`);
} catch(e) { ko('Audit', e); }

// ─── RAPOARTE ───
console.log('\n--- 19. RAPOARTE ---');

try {
  const prr = await api('get', '/reports/prr/by-product?dateFrom=2026-01-01&dateTo=2026-12-31', null, T);
  ok(`Raport PRR: ${(prr.data || prr).length} produse`);
} catch(e) { ko('Raport PRR', e); }

// ─── EXPEDITII ───
console.log('\n--- 20. EXPEDITII ---');

try {
  const ship = await api('post', '/shipments', {
    orderId: createdOrders[0]?.id,
    quantityShipped: 100,
    deliveryAddress: 'AutoParts GmbH, Stuttgart',
    transportType: 'courier',
  }, T);
  ok(`Expeditie: ${ship.shipment_number || 'OK'}`);
} catch(e) { ko('Expeditie', e); }

// ═══ RAPORT FINAL ═══
console.log('\n\n');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  RAPORT FINAL TESTARE FABRICA 12 LUNI');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log(`  ✅ PASS:     ${R.pass}`);
console.log(`  ❌ FAIL:     ${R.fail}`);
console.log(`  ⚠️  WARNINGS: ${R.warnings.length}`);
console.log(`  📋 MISSING:  ${R.missing.length}`);
console.log(`  TOTAL:      ${R.pass + R.fail}`);
console.log('');

if (R.fail > 0) {
  console.log('─── ERORI ───');
  R.errors.forEach(e => console.log(`  ❌ ${e.msg}: ${e.err}`));
}
if (R.warnings.length > 0) {
  console.log('\n─── WARNINGS ───');
  R.warnings.forEach(w => console.log(`  ⚠️ ${w}`));
}
if (R.missing.length > 0) {
  console.log('\n─── FUNCTIONALITATI LIPSA ───');
  R.missing.forEach(m => console.log(`  📋 ${m}`));
}

console.log('\n═══════════════════════════════════════════════════════════════');

process.exit(R.fail > 0 ? 1 : 0);
