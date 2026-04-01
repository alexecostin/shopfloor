/**
 * TESTARE COMPLETA FABRICA — Simulare 2 luni de activitate
 * Testeaza FIECARE flow prin API (echivalent frontend)
 * Raporteaza: ce merge, ce nu merge, ce lipseste
 */
import axios from 'axios';

const API = 'http://localhost:3001/api/v1';
const RESULTS = { pass: [], fail: [], missing: [] };

async function login(email) {
  try {
    const { data } = await axios.post(`${API}/auth/login`, { email, password: 'Test1234!' });
    return data.token;
  } catch (e) {
    RESULTS.fail.push({ test: `Login ${email}`, error: e.response?.data?.message || e.message });
    return null;
  }
}

function auth(token) { return { headers: { Authorization: `Bearer ${token}` } }; }

function pass(test, detail = '') { RESULTS.pass.push({ test, detail }); }
function fail(test, error) { RESULTS.fail.push({ test, error: typeof error === 'string' ? error : (error?.response?.data?.message || error?.message || String(error)) }); }
function missing(test, detail) { RESULTS.missing.push({ test, detail }); }

async function tryTest(name, fn) {
  try {
    await fn();
  } catch (e) {
    fail(name, e);
  }
}

// ═══════════════════════════════════════════════════════════════
console.log('═══ TESTARE COMPLETA FABRICA METALEX SRL ═══\n');

const adminToken = await login('admin@metalex.ro');
if (!adminToken) { console.log('FATAL: Nu pot loga admin'); process.exit(1); }
pass('Login admin');

const plannerToken = await login('ana.p@metalex.ro');
plannerToken ? pass('Login planificator') : fail('Login planificator', 'Nu se poate loga');

const operatorToken = await login('costin.b@metalex.ro');
operatorToken ? pass('Login operator') : fail('Login operator', 'Nu se poate loga');

const maintToken = await login('bogdan.l@metalex.ro');
maintToken ? pass('Login mentenanta') : fail('Login mentenanta', 'Nu se poate loga');

const shiftLeaderToken = await login('mihai.r@metalex.ro');
shiftLeaderToken ? pass('Login sef tura') : fail('Login sef tura', 'Nu se poate loga');

const T = auth(adminToken);

// ═══ FLOW 1: VERIFICARE INFRASTRUCTURA ═══
console.log('\n--- FLOW 1: Infrastructura ---');

await tryTest('Dashboard tasks', async () => {
  const { data } = await axios.get(`${API}/dashboard/tasks`, T);
  Array.isArray(data) ? pass('Dashboard tasks', `${data.length} sarcini`) : fail('Dashboard tasks', 'Nu e array');
});

await tryTest('Operator worksheet', async () => {
  const { data: machines } = await axios.get(`${API}/machines`, T);
  const m = (machines.data || machines)[0];
  if (!m) { fail('Operator worksheet', 'Nu exista masini'); return; }
  const { data } = await axios.get(`${API}/dashboard/operator-worksheet?machineId=${m.id}`, T);
  pass('Operator worksheet', data.hasWork ? 'Are lucru' : 'Fara lucru azi');
});

await tryTest('Masini', async () => {
  const { data } = await axios.get(`${API}/machines`, T);
  const count = (data.data || data).length;
  count >= 30 ? pass('Masini', `${count} masini`) : fail('Masini', `Doar ${count} masini (asteptam 30)`);
});

await tryTest('Materiale stoc', async () => {
  const { data } = await axios.get(`${API}/inventory/items`, T);
  const count = (data.data || data).length;
  count >= 10 ? pass('Materiale stoc', `${count} articole`) : fail('Materiale stoc', `Doar ${count}`);
});

await tryTest('Companii', async () => {
  const { data } = await axios.get(`${API}/companies`, T);
  const count = (data.data || data).length;
  count >= 10 ? pass('Companii', `${count} companii`) : fail('Companii', `Doar ${count}`);
});

await tryTest('Ture', async () => {
  const { data } = await axios.get(`${API}/shifts/definitions`, T);
  data.length > 0 ? pass('Ture', `${data.length} definitii`) : missing('Ture', 'Nu exista ture definite');
});

await tryTest('Lookups', async () => {
  const { data } = await axios.get(`${API}/lookups`, T);
  data.length >= 10 ? pass('Lookups', `${data.length} tipuri`) : fail('Lookups', `Doar ${data.length}`);
});

await tryTest('Admin org', async () => {
  const { data } = await axios.get(`${API}/admin/org`, T);
  data.length > 0 ? pass('Admin org', `${data.length} unitati root`) : fail('Admin org', 'Org goala');
});

await tryTest('Admin setari', async () => {
  const { data } = await axios.get(`${API}/admin/settings`, T);
  data.default_timezone ? pass('Admin setari', `TZ: ${data.default_timezone}`) : fail('Admin setari', 'Setarile nu se incarca');
});

await tryTest('Admin licenta', async () => {
  const { data } = await axios.get(`${API}/admin/license`, T);
  data.status === 'active' ? pass('Admin licenta', `${data.tier} activa`) : fail('Admin licenta', `Status: ${data.status}`);
});

// ═══ FLOW 2: COMERCIAL — CREARE COMENZI ═══
console.log('\n--- FLOW 2: Comercial — Creare 20 comenzi ---');

const clientsResp = await axios.get(`${API}/companies`, T);
const clients = (clientsResp.data.data || clientsResp.data).filter(c => {
  const types = c.company_types || [];
  return (Array.isArray(types) ? types : JSON.parse(types || '[]')).includes('client');
});

const products = [
  { ref: 'ARB-S42', name: 'Arbore motor S42', qty: [200, 500, 300] },
  { ref: 'FLN-F18', name: 'Flansa cuplare F18', qty: [100, 250, 400] },
  { ref: 'AX-T25', name: 'Ax transmisie T25', qty: [150, 350] },
  { ref: 'BUC-G12', name: 'Bucsa ghidare G12', qty: [500, 1000] },
  { ref: 'COL-V30', name: 'Coloana verticala V30', qty: [80, 120] },
  { ref: 'PLC-B10', name: 'Placa baza B10', qty: [200, 300] },
  { ref: 'SUP-P05', name: 'Suport piesa P05', qty: [400] },
  { ref: 'CRP-H20', name: 'Corp pompa H20', qty: [60, 100] },
  { ref: 'ROT-D50', name: 'Rotor D50', qty: [150] },
  { ref: 'CAP-M15', name: 'Capac motor M15', qty: [300, 200] },
  { ref: 'DSP-CTR', name: 'Dispozitiv control', qty: [50] },
  { ref: 'MAT-FIX', name: 'Matrita fixare', qty: [30] },
];

const createdOrders = [];
let orderIdx = 0;
for (let i = 0; i < 20; i++) {
  const client = clients[i % clients.length];
  const prod = products[i % products.length];
  const qty = prod.qty[Math.min(i % prod.qty.length, prod.qty.length - 1)];
  const deadline = new Date(Date.now() + (14 + i * 3) * 86400000).toISOString().split('T')[0];

  await tryTest(`Comanda #${i+1}: ${prod.ref} x${qty}`, async () => {
    const { data } = await axios.post(`${API}/work-orders`, {
      clientId: client?.id || null,
      orderNumber: `CMD-2026-${String(i+1).padStart(3, '0')}`,
      productReference: prod.ref,
      productName: prod.name,
      quantity: qty,
      priority: i < 5 ? 'high' : i < 15 ? 'normal' : 'low',
      scheduledEnd: deadline,
      unitPrice: 50 + Math.floor(Math.random() * 200),
      currency: i % 3 === 0 ? 'EUR' : 'RON',
      incoterms: 'EXW',
      paymentTerms: '30 zile',
      notes: `Comanda test #${i+1} pentru simulare fabrica`,
    }, T);
    if (data.id) {
      createdOrders.push(data);
      pass(`Comanda #${i+1}`, `${data.work_order_number} - ${prod.ref} x${qty}`);
    } else {
      fail(`Comanda #${i+1}`, 'Nu s-a creat');
    }
  });
}

// ═══ FLOW 3: INGINER — CREARE BOM + MBOM ═══
console.log('\n--- FLOW 3: Inginer — BOM si MBOM ---');

const machinesResp = await axios.get(`${API}/machines`, T);
const allMachines = (machinesResp.data.data || machinesResp.data);
const machineByType = {};
allMachines.forEach(m => {
  if (!machineByType[m.type]) machineByType[m.type] = [];
  machineByType[m.type].push(m);
});

const opDefs = [
  { name: 'Debitare', type: 'debitare', machineType: 'debitare', cycle: 30, setup: 15 },
  { name: 'Strunjire', type: 'strunjire', machineType: 'strung_cnc', cycle: 45, setup: 25 },
  { name: 'Frezare', type: 'frezare', machineType: 'frezare_cnc', cycle: 60, setup: 20 },
  { name: 'Rectificare', type: 'rectificare', machineType: 'rectificare', cycle: 40, setup: 15 },
  { name: 'Gaurire', type: 'gaurire', machineType: 'gaurire', cycle: 20, setup: 10 },
  { name: 'Tratament termic', type: 'tratament_termic', machineType: 'tratament_termic', cycle: 120, setup: 30 },
];

// Creare produse BOM unice
const uniqueProducts = [...new Set(createdOrders.map(o => o.product_reference))];
const bomProducts = {};

for (const ref of uniqueProducts) {
  await tryTest(`BOM produs: ${ref}`, async () => {
    const order = createdOrders.find(o => o.product_reference === ref);
    const { data } = await axios.post(`${API}/bom/products`, {
      reference: ref,
      name: order.product_name,
      productType: 'semi_finished',
    }, T);
    if (data.id) {
      bomProducts[ref] = data;
      pass(`BOM produs: ${ref}`, `ID: ${data.id}`);
    } else {
      fail(`BOM produs: ${ref}`, 'Nu s-a creat');
    }
  });
}

// Adauga operatii per produs (MBOM)
for (const [ref, product] of Object.entries(bomProducts)) {
  const numOps = 2 + Math.floor(Math.random() * 3); // 2-4 operatii per piesa
  for (let seq = 1; seq <= numOps; seq++) {
    const opDef = opDefs[(seq - 1) % opDefs.length];
    const machines = machineByType[opDef.machineType] || [];
    const machine = machines[0];

    await tryTest(`MBOM ${ref} Op${seq*10}: ${opDef.name}`, async () => {
      const { data } = await axios.post(`${API}/bom/products/${product.id}/operations`, {
        sequence: seq * 10,
        operationName: opDef.name,
        operationType: opDef.type,
        machineType: opDef.machineType,
        machineId: machine?.id || null,
        cycleTimeSeconds: opDef.cycle + Math.floor(Math.random() * 30),
        setupTimeMinutes: opDef.setup,
        cncProgram: machine ? `PRG-${ref}-OP${seq*10}.nc` : null,
        rawMaterialSpec: seq === 1 ? 'Bara rotunda OL C45 D50 L200' : null,
        minBatchBeforeNext: 10,
      }, T);
      data?.id ? pass(`MBOM ${ref} Op${seq*10}`, `${opDef.name} pe ${machine?.code || 'N/A'}`) : fail(`MBOM ${ref} Op${seq*10}`, 'Eroare creare');
    });
  }

  // Valideaza MBOM
  await tryTest(`Validare MBOM ${ref}`, async () => {
    const { data } = await axios.put(`${API}/bom/products/${product.id}/validate`, {}, T);
    data?.approval_status === 'active' ? pass(`Validare MBOM ${ref}`) : fail(`Validare MBOM ${ref}`, `Status: ${data?.approval_status}`);
  });
}

// ═══ FLOW 4: VERIFICARE TEHNICA ═══
console.log('\n--- FLOW 4: Verificare tehnica ---');

for (const wo of createdOrders.slice(0, 5)) {
  await tryTest(`Tech check ${wo.work_order_number}`, async () => {
    const { data: checks } = await axios.get(`${API}/work-orders/${wo.id}/technical-checks`, T);
    if (checks.length > 0) {
      // Bifam toate checkurile
      for (const check of checks) {
        await axios.put(`${API}/work-orders/technical-checks/${check.id}`, { isPassed: true, notes: 'OK' }, T);
      }
      pass(`Tech check ${wo.work_order_number}`, `${checks.length} bifate`);
    } else {
      fail(`Tech check ${wo.work_order_number}`, 'Nu s-au creat checkuri auto');
    }
  });
}

// ═══ FLOW 5: MRP — VERIFICARE MATERIALE ═══
console.log('\n--- FLOW 5: MRP ---');

await tryTest('MRP calculate', async () => {
  const ids = createdOrders.slice(0, 5).map(o => o.id);
  const { data } = await axios.post(`${API}/inventory/mrp/calculate`, { workOrderIds: ids }, T);
  if (Array.isArray(data)) {
    pass('MRP calculate', `${data.length} materiale analizate`);
    const deficit = data.filter(m => m.status === 'missing' || m.status === 'partial');
    if (deficit.length > 0) pass('MRP deficit detectat', `${deficit.length} materiale cu deficit`);
  } else {
    fail('MRP calculate', 'Raspuns invalid');
  }
});

// ═══ FLOW 6: MATERIAL STATUS PE COMANDA ═══
console.log('\n--- FLOW 6: Material status ---');

for (const wo of createdOrders.slice(0, 3)) {
  await tryTest(`Material status ${wo.work_order_number}`, async () => {
    const { data } = await axios.get(`${API}/work-orders/${wo.id}/material-status`, T);
    pass(`Material status ${wo.work_order_number}`, `${data.length} materiale`);
  });
}

// ═══ FLOW 7: LANSARE IN PRODUCTIE ═══
console.log('\n--- FLOW 7: Lansare in productie ---');

for (const wo of createdOrders.slice(0, 5)) {
  await tryTest(`Lansare ${wo.work_order_number}`, async () => {
    const { data } = await axios.post(`${API}/work-orders/${wo.id}/launch`, {}, T);
    (data.status === 'released' || data.launched_at) ? pass(`Lansare ${wo.work_order_number}`) : fail(`Lansare ${wo.work_order_number}`, `Status: ${data.status}`);
  });
}

// ═══ FLOW 8: PLANIFICARE ═══
console.log('\n--- FLOW 8: Planificare ---');

await tryTest('Creare plan saptamanal', async () => {
  const monday = new Date();
  monday.setDate(monday.getDate() - monday.getDay() + 1);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const { data } = await axios.post(`${API}/planning/master-plans`, {
    name: `Plan saptamana ${monday.toISOString().split('T')[0]}`,
    planType: 'weekly',
    year: monday.getFullYear(),
    weekNumber: Math.ceil((monday - new Date(monday.getFullYear(), 0, 1)) / (7 * 86400000)),
    startDate: monday.toISOString().split('T')[0],
    endDate: sunday.toISOString().split('T')[0],
  }, T);
  data.id ? pass('Creare plan', data.name) : fail('Creare plan', 'Nu s-a creat');
});

await tryTest('Allocation context', async () => {
  const str01 = allMachines.find(m => m.code === 'STR-01');
  if (!str01) { fail('Allocation context', 'STR-01 nu exista'); return; }
  const { data } = await axios.get(`${API}/planning/allocation-context/${str01.id}`, T);
  pass('Allocation context', `${data.availableOperations?.length || 0} operatii disponibile pe STR-01`);
});

await tryTest('Machine load', async () => {
  const str01 = allMachines.find(m => m.code === 'STR-01');
  if (!str01) { fail('Machine load', 'STR-01 nu exista'); return; }
  const from = new Date().toISOString().split('T')[0];
  const to = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const { data } = await axios.get(`${API}/planning/machine-load/${str01.id}?dateFrom=${from}&dateTo=${to}`, T);
  pass('Machine load', `${data.length} zile`);
});

await tryTest('Planning dashboard', async () => {
  const { data } = await axios.get(`${API}/planning/dashboard?weekStart=${new Date().toISOString().split('T')[0]}`, T);
  pass('Planning dashboard', `Load: ${data.kpis?.avgLoad}%, Planned: ${data.kpis?.totalPlanned}`);
});

// ═══ FLOW 9: SCHEDULING AUTO ═══
console.log('\n--- FLOW 9: Scheduling auto ---');

await tryTest('Creare config scheduling', async () => {
  const { data } = await axios.post(`${API}/scheduling/configs`, {
    name: 'Standard - Deadline First',
    description: 'Prioritizeaza comenzile cu deadline apropiat',
    priorities: [{ criterion: 'deadline', weight: 50 }, { criterion: 'utilization', weight: 30 }, { criterion: 'setup_time', weight: 20 }],
    constraints: { respect_shifts: true, allow_overtime: false },
  }, T);
  data.id ? pass('Config scheduling', data.name) : fail('Config scheduling', 'Nu s-a creat');
});

// ═══ FLOW 10: OPERATOR — RAPORTARE PRODUCTIE ═══
console.log('\n--- FLOW 10: Operator — Raportare ---');

const OT = auth(operatorToken || adminToken);
const firstMachine = allMachines.find(m => m.code === 'STR-01');

await tryTest('Raport productie', async () => {
  if (!firstMachine) { fail('Raport productie', 'Nu exista STR-01'); return; }
  const { data } = await axios.post(`${API}/production/reports`, {
    machineId: firstMachine.id,
    shift: 'Tura I',
    goodPieces: 45,
    scrapPieces: 5,
    scrapReasonCode: 'cota_in_afara',
    reworkPieces: 3,
    reworkReasonCode: 'bavura',
  }, OT);
  data.id ? pass('Raport productie', `${data.good_pieces} bune, ${data.scrap_pieces} rebut`) : fail('Raport productie', 'Nu s-a creat');
});

await tryTest('Oprire masina', async () => {
  if (!firstMachine) { fail('Oprire masina', 'Nu exista STR-01'); return; }
  const { data } = await axios.post(`${API}/production/stops`, {
    machineId: firstMachine.id,
    category: 'lipsa_material',
    reason: 'Asteptam material de la debitare',
    shift: 'Tura I',
  }, OT);
  data.id ? pass('Oprire masina', `Stop ID: ${data.id}`) : fail('Oprire masina', 'Nu s-a creat');
});

// ═══ FLOW 11: MENTENANTA ═══
console.log('\n--- FLOW 11: Mentenanta ---');

const MT = auth(maintToken || adminToken);

await tryTest('Cerere mentenanta', async () => {
  if (!firstMachine) { fail('Cerere mentenanta', 'Nu exista masina'); return; }
  const { data } = await axios.post(`${API}/maintenance`, {
    machineId: firstMachine.id,
    problemType: 'Vibratie anormala la turatie mare',
    description: 'Se simte o vibratie puternica la turatii peste 2000 rpm. Posibil rulment uzat.',
    priority: 'high',
  }, MT);
  data.id ? pass('Cerere mentenanta', data.request_number) : fail('Cerere mentenanta', 'Nu s-a creat');
});

await tryTest('Mentenanta planificata', async () => {
  const frz01 = allMachines.find(m => m.code === 'FRZ-01');
  if (!frz01) { fail('Mentenanta planificata', 'FRZ-01 nu exista'); return; }
  const { data } = await axios.post(`${API}/maintenance/planned`, {
    machineId: frz01.id,
    interventionType: 'preventive',
    title: 'Revizie generala FRZ-01',
    plannedStartDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    plannedEndDate: new Date(Date.now() + 9 * 86400000).toISOString().split('T')[0],
    executorType: 'internal',
    estimatedCost: 1500,
  }, T);
  data.id ? pass('Mentenanta planificata', data.title) : fail('Mentenanta planificata', 'Nu s-a creat');
});

// ═══ FLOW 12: ACHIZITII ═══
console.log('\n--- FLOW 12: Achizitii ---');

const suppliers = (clientsResp.data.data || clientsResp.data).filter(c => {
  const types = c.company_types || [];
  return (Array.isArray(types) ? types : JSON.parse(types || '[]')).includes('furnizor');
});

await tryTest('Creare PO', async () => {
  const supplier = suppliers[0];
  if (!supplier) { missing('Creare PO', 'Nu exista furnizori'); return; }
  const { data } = await axios.post(`${API}/purchasing/orders`, {
    supplierId: supplier.id,
    currency: 'EUR',
    notes: 'Comanda aprovizionare otel C45',
  }, T);
  if (data.id) {
    // Adauga linie
    await axios.post(`${API}/purchasing/orders/${data.id}/lines`, {
      description: 'Otel C45 rotund D50',
      quantity: 500,
      unit: 'kg',
      unitPrice: 2.8,
    }, T);
    pass('Creare PO', `${data.po_number} la ${supplier.name}`);
  } else {
    fail('Creare PO', 'Nu s-a creat');
  }
});

// ═══ FLOW 13: CALITATE ═══
console.log('\n--- FLOW 13: Calitate ---');

await tryTest('Plan masurare', async () => {
  const prod = Object.values(bomProducts)[0];
  if (!prod) { missing('Plan masurare', 'Nu exista produse BOM'); return; }
  const { data } = await axios.post(`${API}/quality/plans`, {
    product_id: prod.id,
    plan_name: `Plan control ${prod.reference}`,
    characteristics: JSON.stringify([
      { name: 'Diametru exterior', nominal: 42, upper_tolerance: 0.025, lower_tolerance: -0.025, unit: 'mm', is_critical: true },
      { name: 'Lungime totala', nominal: 120, upper_tolerance: 0.1, lower_tolerance: -0.1, unit: 'mm', is_critical: false },
      { name: 'Rugozitate Ra', nominal: 0.8, upper_tolerance: 0.4, lower_tolerance: 0, unit: 'um', is_critical: true },
    ]),
  }, T);
  data.id ? pass('Plan masurare', data.plan_name) : fail('Plan masurare', 'Nu s-a creat');
});

await tryTest('NCR', async () => {
  const { data } = await axios.post(`${API}/quality/ncr`, {
    title: 'Diametru in afara tolerantei pe lot 15',
    ncr_type: 'internal',
    severity: 'major',
    description: 'Lotul 15 ARBORE-S42 are diametrul exterior la 42.05mm, peste toleranta de +0.025',
    affected_qty: 12,
  }, T);
  data.id ? pass('NCR', data.ncr_number) : fail('NCR', 'Nu s-a creat');
});

// ═══ FLOW 14: TRASABILITATE ═══
console.log('\n--- FLOW 14: Trasabilitate ---');

await tryTest('Creare lot', async () => {
  const { data } = await axios.post(`${API}/traceability/lots`, {
    lotNumber: 'LOT-2026-0001',
    quantity: 500,
    unit: 'kg',
    receivedDate: new Date().toISOString().split('T')[0],
  }, T);
  data.id ? pass('Creare lot', data.lot_number) : fail('Creare lot', typeof data === 'object' ? JSON.stringify(data).substring(0, 100) : 'Eroare');
});

// ═══ FLOW 15: EXPEDITII ═══
console.log('\n--- FLOW 15: Expeditii ---');

await tryTest('Creare expeditie', async () => {
  const { data } = await axios.post(`${API}/shipments`, {
    orderId: createdOrders[0]?.id || null,
    quantityShipped: 100,
    deliveryAddress: 'AutoParts GmbH, Stuttgart, Germania',
    transportType: 'courier',
  }, T);
  data.id ? pass('Creare expeditie', data.shipment_number) : fail('Creare expeditie', 'Nu s-a creat');
});

// ═══ FLOW 16: DOCUMENTE ═══
console.log('\n--- FLOW 16: Documente ---');

await tryTest('Creare document', async () => {
  const { data } = await axios.post(`${API}/documents`, {
    title: 'Desen tehnic ARBORE-S42',
    document_type: 'drawing',
    description: 'Desen tehnic complet cu toate cotele si tolerantele',
    tags: JSON.stringify(['arbore', 'desen', 'S42']),
  }, T);
  data.id ? pass('Creare document', data.title) : fail('Creare document', 'Nu s-a creat');
});

// ═══ FLOW 17: RAPOARTE ═══
console.log('\n--- FLOW 17: Rapoarte ---');

await tryTest('Raport PRR per produs', async () => {
  const from = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const to = new Date().toISOString().split('T')[0];
  const { data } = await axios.get(`${API}/reports/prr/by-product?dateFrom=${from}&dateTo=${to}`, T);
  pass('Raport PRR per produs', `${(data.data || data).length} produse`);
});

await tryTest('Raport costuri per masina', async () => {
  const from = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const to = new Date().toISOString().split('T')[0];
  const { data } = await axios.get(`${API}/costs/by-machine?dateFrom=${from}&dateTo=${to}`, T);
  pass('Raport costuri', `${data.length} masini`);
});

// ═══ FLOW 18: AUDIT ═══
console.log('\n--- FLOW 18: Audit ---');

await tryTest('Audit trail', async () => {
  const { data } = await axios.get(`${API}/audit/actions?limit=10`, T);
  pass('Audit trail', `${data.total} actiuni inregistrate`);
});

// ═══ FLOW 19: CODURI QR ═══
console.log('\n--- FLOW 19: Coduri QR ---');

await tryTest('Generare QR', async () => {
  if (!firstMachine) { fail('Generare QR', 'Nu exista masina'); return; }
  const { data } = await axios.post(`${API}/barcodes/generate`, {
    entityType: 'machine',
    entityId: firstMachine.id,
    label: firstMachine.code,
  }, T);
  data.barcode_value ? pass('Generare QR', data.barcode_value) : fail('Generare QR', 'Nu s-a generat');
});

// ═══ FLOW 20: INTEGRARI ═══
console.log('\n--- FLOW 20: Integrari ---');

await tryTest('Webhooks', async () => {
  const { data } = await axios.get(`${API}/integrations/webhooks`, T);
  pass('Webhooks list', `${data.length} webhooks`);
});

await tryTest('Export templates', async () => {
  const { data } = await axios.get(`${API}/integrations/templates`, T);
  pass('Export templates', `${data.length} templates`);
});

// ═══ RAPORT FINAL ═══
console.log('\n\n');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  RAPORT TESTARE COMPLETA — FABRICA METALEX SRL');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log(`  ✅ PASS:    ${RESULTS.pass.length}`);
console.log(`  ❌ FAIL:    ${RESULTS.fail.length}`);
console.log(`  ⚠️  MISSING: ${RESULTS.missing.length}`);
console.log(`  TOTAL:     ${RESULTS.pass.length + RESULTS.fail.length + RESULTS.missing.length}`);
console.log('');

if (RESULTS.fail.length > 0) {
  console.log('─── FAILURES ───');
  RESULTS.fail.forEach(f => console.log(`  ❌ ${f.test}: ${f.error}`));
  console.log('');
}

if (RESULTS.missing.length > 0) {
  console.log('─── MISSING FEATURES ───');
  RESULTS.missing.forEach(m => console.log(`  ⚠️  ${m.test}: ${m.detail}`));
  console.log('');
}

console.log('─── ALL PASSING TESTS ───');
RESULTS.pass.forEach(p => console.log(`  ✅ ${p.test}${p.detail ? ' — ' + p.detail : ''}`));

console.log('\n═══════════════════════════════════════════════════════════════');

process.exit(RESULTS.fail.length > 0 ? 1 : 0);
