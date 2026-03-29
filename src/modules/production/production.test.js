import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import db from '../../config/db.js';
import bcrypt from 'bcrypt';

let adminToken, operatorToken;
let machineId, orderId, reportId, stopId, shiftId;

beforeAll(async () => {
  // Admin
  await db('auth.users').where({ email: 'admin.prod@shopfloor.local' }).del();
  await db('auth.users').insert({
    email: 'admin.prod@shopfloor.local',
    password_hash: await bcrypt.hash('Admin2026!', 10),
    full_name: 'Admin Prod', role: 'admin', is_active: true,
  });
  const r1 = await request(app).post('/api/v1/auth/login').send({ email: 'admin.prod@shopfloor.local', password: 'Admin2026!' });
  adminToken = r1.body.token;

  // Operator
  await db('auth.users').where({ email: 'operator.prod@shopfloor.local' }).del();
  await db('auth.users').insert({
    email: 'operator.prod@shopfloor.local',
    password_hash: await bcrypt.hash('Operator2026!', 10),
    full_name: 'Operator Prod', role: 'operator', is_active: true,
  });
  const r2 = await request(app).post('/api/v1/auth/login').send({ email: 'operator.prod@shopfloor.local', password: 'Operator2026!' });
  operatorToken = r2.body.token;

  // Machine
  await db('machines.machines').where({ code: 'PROD-TEST-01' }).del();
  const [m] = await db('machines.machines').insert({ code: 'PROD-TEST-01', name: 'Test Machine', type: 'CNC', status: 'active' }).returning('*');
  machineId = m.id;

  // Cleanup
  await db('production.orders').where({ order_number: 'CMD-TEST-001' }).del();
});

afterAll(async () => {
  if (stopId) await db('production.stops').where({ id: stopId }).del();
  if (reportId) await db('production.reports').where({ id: reportId }).del();
  if (orderId) await db('production.orders').where({ id: orderId }).del();
  if (shiftId) await db('production.shifts').where({ id: shiftId }).del();
  await db('machines.machines').where({ code: 'PROD-TEST-01' }).del();
  await db('auth.users').whereIn('email', ['admin.prod@shopfloor.local', 'operator.prod@shopfloor.local']).del();
  await db.destroy();
});

// ── ORDERS ────────────────────────────────────────────────────────────────────

describe('Orders', () => {
  it('GET /orders → 200', async () => {
    const res = await request(app).get('/api/v1/production/orders').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
  });

  it('POST /orders ca operator → 403', async () => {
    const res = await request(app).post('/api/v1/production/orders')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ orderNumber: 'CMD-TEST-001', productName: 'Produs', machineId, targetQuantity: 100 });
    expect(res.status).toBe(403);
  });

  it('POST /orders ca admin → 201', async () => {
    const res = await request(app).post('/api/v1/production/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orderNumber: 'CMD-TEST-001', productName: 'Produs Test', machineId, targetQuantity: 100 });
    expect(res.status).toBe(201);
    orderId = res.body.id;
  });

  it('POST /orders numar duplicat → 409', async () => {
    const res = await request(app).post('/api/v1/production/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orderNumber: 'CMD-TEST-001', productName: 'Alt Produs', machineId, targetQuantity: 50 });
    expect(res.status).toBe(409);
  });

  it('PUT /orders/:id → 200', async () => {
    const res = await request(app).put(`/api/v1/production/orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });
});

// ── REPORTS ───────────────────────────────────────────────────────────────────

describe('Reports', () => {
  it('POST /reports ca operator → 201', async () => {
    const res = await request(app).post('/api/v1/production/reports')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ machineId, shift: 'Tura I', goodPieces: 50, scrapPieces: 2 });
    expect(res.status).toBe(201);
    expect(res.body.good_pieces).toBe(50);
    reportId = res.body.id;
  });

  it('GET /reports → 200', async () => {
    const res = await request(app).get('/api/v1/production/reports').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

// ── STOPS ─────────────────────────────────────────────────────────────────────

describe('Stops', () => {
  it('POST /stops → 201', async () => {
    const res = await request(app).post('/api/v1/production/stops')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ machineId, reason: 'Defect utilaj', category: 'Defect utilaj', shift: 'Tura I' });
    expect(res.status).toBe(201);
    stopId = res.body.id;
  });

  it('PUT /stops/:id (close) → 200 cu duration', async () => {
    const res = await request(app).put(`/api/v1/production/stops/${stopId}`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.ended_at).toBeTruthy();
    expect(res.body.duration_minutes).toBeGreaterThanOrEqual(0);
  });

  it('PUT /stops/:id deja inchis → 409', async () => {
    const res = await request(app).put(`/api/v1/production/stops/${stopId}`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({});
    expect(res.status).toBe(409);
  });
});

// ── SHIFTS ────────────────────────────────────────────────────────────────────

describe('Shifts', () => {
  it('POST /shifts ca operator → 403', async () => {
    const res = await request(app).post('/api/v1/production/shifts')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ shiftName: 'Tura I' });
    expect(res.status).toBe(403);
  });

  it('POST /shifts ca admin → 201', async () => {
    const res = await request(app).post('/api/v1/production/shifts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ shiftName: 'Tura I' });
    expect(res.status).toBe(201);
    shiftId = res.body.id;
  });

  it('PUT /shifts/:id (close) → 200', async () => {
    const res = await request(app).put(`/api/v1/production/shifts/${shiftId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notesOutgoing: 'Tura finalizata fara probleme.' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('closed');
  });
});

// ── DASHBOARD / OEE ───────────────────────────────────────────────────────────

describe('Dashboard', () => {
  it('GET /dashboard → 200 cu OEE', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/api/v1/production/dashboard?date=${today}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.avgOEE).toBeDefined();
    expect(res.body.machines).toBeInstanceOf(Array);
  });
});
