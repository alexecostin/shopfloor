import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import db from '../../config/db.js';
import bcrypt from 'bcrypt';

let adminToken, operatorToken, maintenanceToken;
let machineId, requestId;

beforeAll(async () => {
  for (const [email, role] of [
    ['admin.mnt@shopfloor.local', 'admin'],
    ['operator.mnt@shopfloor.local', 'operator'],
    ['tech.mnt@shopfloor.local', 'maintenance'],
  ]) {
    await db('auth.users').where({ email }).del();
    await db('auth.users').insert({
      email, password_hash: await bcrypt.hash('Test2026!', 10),
      full_name: role, role, is_active: true,
    });
  }

  adminToken = (await request(app).post('/api/v1/auth/login').send({ email: 'admin.mnt@shopfloor.local', password: 'Test2026!' })).body.token;
  operatorToken = (await request(app).post('/api/v1/auth/login').send({ email: 'operator.mnt@shopfloor.local', password: 'Test2026!' })).body.token;
  maintenanceToken = (await request(app).post('/api/v1/auth/login').send({ email: 'tech.mnt@shopfloor.local', password: 'Test2026!' })).body.token;

  await db('machines.machines').where({ code: 'MNT-TEST-01' }).del();
  const [m] = await db('machines.machines').insert({ code: 'MNT-TEST-01', name: 'Test Machine', type: 'CNC', status: 'active' }).returning('*');
  machineId = m.id;
});

afterAll(async () => {
  if (requestId) await db('maintenance.requests').where({ id: requestId }).del();
  await db('machines.machines').where({ code: 'MNT-TEST-01' }).del();
  await db('auth.users').whereILike('email', '%.mnt@shopfloor.local').del();
  await db.destroy();
});

describe('POST /api/v1/maintenance', () => {
  it('fara token → 401', async () => {
    const res = await request(app).post('/api/v1/maintenance').send({ machineId, problemType: 'Defect' });
    expect(res.status).toBe(401);
  });

  it('ca operator → 201 cu numar generat', async () => {
    const res = await request(app).post('/api/v1/maintenance')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ machineId, problemType: 'Defect motor', description: 'Zgomot puternic', priority: 'high' });
    expect(res.status).toBe(201);
    expect(res.body.request_number).toMatch(/^MT-\d{4}$/);
    expect(res.body.status).toBe('open');
    requestId = res.body.id;
  });

  it('date invalide → 400', async () => {
    const res = await request(app).post('/api/v1/maintenance')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ machineId });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/maintenance', () => {
  it('lista → 200', async () => {
    const res = await request(app).get('/api/v1/maintenance').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('filtrare dupa status → 200', async () => {
    const res = await request(app).get('/api/v1/maintenance?status=open').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((r) => r.status === 'open')).toBe(true);
  });
});

describe('PUT /api/v1/maintenance/:id', () => {
  it('ca operator → 403', async () => {
    const res = await request(app).put(`/api/v1/maintenance/${requestId}`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(403);
  });

  it('ca maintenance → assign + in_progress → 200', async () => {
    const techUser = await db('auth.users').where({ email: 'tech.mnt@shopfloor.local' }).first();
    const res = await request(app).put(`/api/v1/maintenance/${requestId}`)
      .set('Authorization', `Bearer ${maintenanceToken}`)
      .send({ assignedTo: techUser.id, status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
    expect(res.body.started_at).toBeTruthy();
  });

  it('rezolvare → done + resolved_at → 200', async () => {
    const res = await request(app).put(`/api/v1/maintenance/${requestId}`)
      .set('Authorization', `Bearer ${maintenanceToken}`)
      .send({ status: 'done', resolution: 'Motor inlocuit.' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(res.body.resolved_at).toBeTruthy();
  });
});

describe('GET /api/v1/maintenance/dashboard', () => {
  it('→ 200 cu statistici', async () => {
    const res = await request(app).get('/api/v1/maintenance/dashboard').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.byStatus).toBeDefined();
  });
});
