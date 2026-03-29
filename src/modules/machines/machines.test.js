import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import db from '../../config/db.js';
import bcrypt from 'bcrypt';

let adminToken;
let operatorToken;
let machineId;

beforeAll(async () => {
  // Setup admin
  await db('auth.users').where({ email: 'admin.machines@shopfloor.local' }).del();
  const [admin] = await db('auth.users').insert({
    email: 'admin.machines@shopfloor.local',
    password_hash: await bcrypt.hash('Admin2026!', 10),
    full_name: 'Admin Machines',
    role: 'admin',
    is_active: true,
  }).returning('*');

  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin.machines@shopfloor.local', password: 'Admin2026!' });
  adminToken = loginRes.body.token;

  // Setup operator
  await db('auth.users').where({ email: 'operator.machines@shopfloor.local' }).del();
  await db('auth.users').insert({
    email: 'operator.machines@shopfloor.local',
    password_hash: await bcrypt.hash('Operator2026!', 10),
    full_name: 'Test Operator',
    role: 'operator',
    is_active: true,
  });

  const opRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'operator.machines@shopfloor.local', password: 'Operator2026!' });
  operatorToken = opRes.body.token;

  // Cleanup test machines
  await db('machines.machines').where({ code: 'TEST-001' }).del();
  await db('machines.machines').where({ code: 'TEST-002' }).del();
});

afterAll(async () => {
  await db('machines.machines').where({ code: 'TEST-001' }).del();
  await db('machines.machines').where({ code: 'TEST-002' }).del();
  await db('auth.users').where({ email: 'admin.machines@shopfloor.local' }).del();
  await db('auth.users').where({ email: 'operator.machines@shopfloor.local' }).del();
  await db.destroy();
});

// ── LIST ──────────────────────────────────────────────────────────────────────

describe('GET /api/v1/machines', () => {
  it('fara token → 401', async () => {
    const res = await request(app).get('/api/v1/machines');
    expect(res.status).toBe(401);
  });

  it('cu token valid → 200 + array', async () => {
    const res = await request(app)
      .get('/api/v1/machines')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.pagination).toBeDefined();
  });
});

// ── CREATE ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/machines', () => {
  it('ca operator → 403', async () => {
    const res = await request(app)
      .post('/api/v1/machines')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ code: 'TEST-001', name: 'Test CNC', type: 'CNC' });
    expect(res.status).toBe(403);
  });

  it('date invalide → 400', async () => {
    const res = await request(app)
      .post('/api/v1/machines')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test CNC' }); // missing code and type
    expect(res.status).toBe(400);
  });

  it('ca admin cu date valide → 201', async () => {
    const res = await request(app)
      .post('/api/v1/machines')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'TEST-001', name: 'Test CNC #1', type: 'CNC', location: 'Hala A' });
    expect(res.status).toBe(201);
    expect(res.body.code).toBe('TEST-001');
    machineId = res.body.id;
  });

  it('cod duplicat → 409', async () => {
    const res = await request(app)
      .post('/api/v1/machines')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'TEST-001', name: 'Alt utilaj', type: 'CNC' });
    expect(res.status).toBe(409);
  });
});

// ── GET ───────────────────────────────────────────────────────────────────────

describe('GET /api/v1/machines/:id', () => {
  it('id inexistent → 404', async () => {
    const res = await request(app)
      .get('/api/v1/machines/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('id valid → 200', async () => {
    const res = await request(app)
      .get(`/api/v1/machines/${machineId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe('TEST-001');
  });
});

// ── UPDATE ────────────────────────────────────────────────────────────────────

describe('PUT /api/v1/machines/:id', () => {
  it('ca operator → 403', async () => {
    const res = await request(app)
      .put(`/api/v1/machines/${machineId}`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ name: 'Updated' });
    expect(res.status).toBe(403);
  });

  it('ca admin → 200', async () => {
    const res = await request(app)
      .put(`/api/v1/machines/${machineId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test CNC Updated', status: 'maintenance' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test CNC Updated');
    expect(res.body.status).toBe('maintenance');
  });
});

// ── DELETE ────────────────────────────────────────────────────────────────────

describe('DELETE /api/v1/machines/:id', () => {
  it('ca operator → 403', async () => {
    const res = await request(app)
      .delete(`/api/v1/machines/${machineId}`)
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(res.status).toBe(403);
  });

  it('ca admin → 204', async () => {
    const res = await request(app)
      .delete(`/api/v1/machines/${machineId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(204);
  });

  it('dupa stergere → 404', async () => {
    const res = await request(app)
      .get(`/api/v1/machines/${machineId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
