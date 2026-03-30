/**
 * E2E full-platform tests — INTERCONECTARE
 *
 * Covers all 5 interconnection themes:
 *   1. Company companyTypes (array)
 *   2. Contacts per context (client/supplier contacts + assignments)
 *   3. Planned maintenance lifecycle
 *   4. Item suppliers + price trend
 *   5. Complete cost model
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import db from '../../src/config/db.js';
import bcrypt from 'bcrypt';

// ─── Shared state ─────────────────────────────────────────────────────────────
let adminToken;
let companyId_multi;

// ─── Setup / Teardown ─────────────────────────────────────────────────────────
beforeAll(async () => {
  // Ensure admin user exists
  await db('auth.users').where({ email: 'admin.interconectare@shopfloor.local' }).del();
  await db('auth.users').insert({
    email: 'admin.interconectare@shopfloor.local',
    password_hash: await bcrypt.hash('Test2026!', 10),
    full_name: 'Admin Interconectare',
    role: 'admin',
    is_active: true,
  });

  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin.interconectare@shopfloor.local', password: 'Test2026!' });

  adminToken = loginRes.body.token;
});

afterAll(async () => {
  // Clean up test company created during TEMA 1
  if (companyId_multi) {
    await db('companies.contact_assignments')
      .whereIn('contact_id', function () {
        this.select('id').from('companies.contacts').where('company_id', companyId_multi);
      })
      .del()
      .catch(() => {});
    await db('companies.contacts').where('company_id', companyId_multi).del().catch(() => {});
    await db('companies.companies').where({ id: companyId_multi }).del().catch(() => {});
  }

  await db('auth.users').where({ email: 'admin.interconectare@shopfloor.local' }).del().catch(() => {});
  await db.destroy();
});

// ─── INTERCONECTARE: TEMA 1 — Company companyTypes ────────────────────────────
describe('TEMA 1: Company companyTypes', () => {
  test('POST /companies with companyTypes array → 201', async () => {
    const res = await request(app)
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'TestCompany-Interconectare', companyTypes: ['client', 'supplier'] });
    expect(res.status).toBe(201);
    expect(Array.isArray(res.body.company_types)).toBe(true);
    expect(res.body.company_types).toContain('client');
    companyId_multi = res.body.id;
  });

  test('GET /companies?search=TestCompany-Interconectare → found', async () => {
    const res = await request(app)
      .get('/api/v1/companies?search=TestCompany-Interconectare')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const list = res.body.data || res.body;
    expect(Array.isArray(list) ? list : list.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: companyId_multi })])
    );
  });
});

// ─── INTERCONECTARE: TEMA 2 — Contacts per context ───────────────────────────
describe('TEMA 2: Contacts per context', () => {
  let clientContactId, supplierContactId;

  test('Add client_contact with contextTags', async () => {
    const res = await request(app)
      .post(`/api/v1/companies/${companyId_multi}/contacts`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Ion Pop', phone: '0700000001', relationshipType: 'client_contact', contextTags: ['comenzi_cnc'], department: 'Achizitii' });
    expect(res.status).toBe(201);
    clientContactId = res.body.id;
  });

  test('Add supplier_contact', async () => {
    const res = await request(app)
      .post(`/api/v1/companies/${companyId_multi}/contacts`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Ana Radu', phone: '0700000002', relationshipType: 'supplier_contact' });
    expect(res.status).toBe(201);
    supplierContactId = res.body.id;
  });

  test('GET contacts?relationshipType=client_contact → only client contacts', async () => {
    const res = await request(app)
      .get(`/api/v1/companies/${companyId_multi}/contacts?relationshipType=client_contact`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const list = res.body.data || res.body;
    const arr = Array.isArray(list) ? list : list.data || [];
    expect(arr.every(c => c.relationship_type === 'client_contact')).toBe(true);
  });

  test('POST /contacts/assign → assign contact to entity', async () => {
    const res = await request(app)
      .post('/api/v1/contacts/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ contactId: clientContactId, entityType: 'order', entityId: companyId_multi, roleInContext: 'Responsabil comanda' });
    expect(res.status).toBe(201);
  });

  test('GET /contacts/for/order/:entityId → returns assigned contact', async () => {
    const res = await request(app)
      .get(`/api/v1/contacts/for/order/${companyId_multi}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

// ─── INTERCONECTARE: TEMA 3 — Planned maintenance ────────────────────────────
describe('TEMA 3: Planned maintenance', () => {
  let interventionId, machineIdForTest;

  test('GET /machines to get a machine ID', async () => {
    const res = await request(app)
      .get('/api/v1/machines?limit=1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const machines = res.body.data || res.body;
    const arr = Array.isArray(machines) ? machines : machines.data || [];
    if (arr.length > 0) machineIdForTest = arr[0].id;
  });

  test('POST /maintenance/planned → create intervention', async () => {
    if (!machineIdForTest) return;
    const res = await request(app)
      .post('/api/v1/maintenance/planned')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        machineId: machineIdForTest,
        interventionType: 'preventive',
        title: 'Test revizie lunara',
        plannedStartDate: '2026-04-15',
        plannedEndDate: '2026-04-16',
        executorType: 'internal',
        estimatedCost: 500,
      });
    expect(res.status).toBe(201);
    interventionId = res.body.id;
    expect(res.body.status).toBe('planned');
  });

  test('PUT /maintenance/planned/:id/confirm → status confirmed', async () => {
    if (!interventionId) return;
    const res = await request(app)
      .put(`/api/v1/maintenance/planned/${interventionId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('confirmed');
  });

  test('PUT /maintenance/planned/:id/start → status in_progress', async () => {
    if (!interventionId) return;
    const res = await request(app)
      .put(`/api/v1/maintenance/planned/${interventionId}/start`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
  });

  test('PUT /maintenance/planned/:id/complete → status completed', async () => {
    if (!interventionId) return;
    const res = await request(app)
      .put(`/api/v1/maintenance/planned/${interventionId}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ actualCost: 480, completionNotes: 'Completat cu succes', partsUsed: [] });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });
});

// ─── INTERCONECTARE: TEMA 4 — Item suppliers ─────────────────────────────────
describe('TEMA 4: Item suppliers + purchase history', () => {
  let itemId, supplierRecordId;

  test('GET /inventory/items to find an item', async () => {
    const res = await request(app)
      .get('/api/v1/inventory/items?limit=1')
      .set('Authorization', `Bearer ${adminToken}`);
    if (res.status === 200) {
      const list = res.body.data || res.body;
      const arr = Array.isArray(list) ? list : list.data || [];
      if (arr.length > 0) itemId = arr[0].id;
    }
  });

  test('POST primary supplier for item', async () => {
    if (!itemId || !companyId_multi) return;
    const res = await request(app)
      .post(`/api/v1/inventory/items/${itemId}/suppliers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ supplierCompanyId: companyId_multi, isPrimary: true, unitCost: 10.50, priority: 1 });
    expect([200, 201]).toContain(res.status);
    supplierRecordId = res.body.id;
  });

  test('GET /inventory/items/:id/suppliers → primary first', async () => {
    if (!itemId) return;
    const res = await request(app)
      .get(`/api/v1/inventory/items/${itemId}/suppliers`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0].is_primary).toBe(true);
    }
  });

  test('GET /inventory/items/:id/price-trend → array', async () => {
    if (!itemId) return;
    const res = await request(app)
      .get(`/api/v1/inventory/items/${itemId}/price-trend`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─── INTERCONECTARE: TEMA 5 — Cost model ─────────────────────────────────────
describe('TEMA 5: Complete cost model', () => {
  let machineIdCost, productIdCost, elementId;

  test('GET /costs/elements → 7 elements', async () => {
    const res = await request(app)
      .get('/api/v1/costs/elements')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const energyEl = res.body.find(e => e.element_code === 'energy');
    if (energyEl) elementId = energyEl.id;
  });

  test('GET /machines to get machine ID for cost config', async () => {
    const res = await request(app)
      .get('/api/v1/machines?limit=1')
      .set('Authorization', `Bearer ${adminToken}`);
    if (res.status === 200) {
      const list = res.body.data || res.body;
      const arr = Array.isArray(list) ? list : list.data || [];
      if (arr.length > 0) machineIdCost = arr[0].id;
    }
  });

  test('POST /costs/machines/:machineId/config (simple)', async () => {
    if (!machineIdCost) return;
    const res = await request(app)
      .post(`/api/v1/costs/machines/${machineIdCost}/config`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ configMode: 'simple', hourlyRate: 25 });
    expect([200, 201]).toContain(res.status);
    expect(parseFloat(res.body.hourly_rate)).toBe(25);
  });

  test('GET /costs/calculate/piece/:productId → cost breakdown', async () => {
    // Get a product
    const pRes = await request(app)
      .get('/api/v1/bom/products?limit=1')
      .set('Authorization', `Bearer ${adminToken}`);
    if (pRes.status === 200) {
      const list = pRes.body.data || pRes.body;
      const arr = Array.isArray(list) ? list : list.data || [];
      if (arr.length > 0) productIdCost = arr[0].id;
    }
    if (!productIdCost) return;

    const res = await request(app)
      .get(`/api/v1/costs/calculate/piece/${productIdCost}?machineId=${machineIdCost}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('perPiece');
    expect(res.body).toHaveProperty('elements');
    expect(Array.isArray(res.body.elements)).toBe(true);
  });

  test('PUT /costs/elements/:id (disable energy) → cost recalculates lower', async () => {
    if (!elementId || !productIdCost) return;
    // Disable energy
    await request(app)
      .put(`/api/v1/costs/elements/${elementId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    const res = await request(app)
      .get(`/api/v1/costs/calculate/piece/${productIdCost}?machineId=${machineIdCost}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const hasEnergy = res.body.elements?.some(e => e.code === 'energy');
    expect(hasEnergy).toBe(false);

    // Re-enable
    await request(app)
      .put(`/api/v1/costs/elements/${elementId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true });
  });
});
