import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import db from '../../config/db.js';
import bcrypt from 'bcrypt';

let adminToken, operatorToken;
let machineId, templateId;

beforeAll(async () => {
  for (const [email, role] of [
    ['admin.chk@shopfloor.local', 'admin'],
    ['operator.chk@shopfloor.local', 'operator'],
  ]) {
    await db('auth.users').where({ email }).del();
    await db('auth.users').insert({
      email, password_hash: await bcrypt.hash('Test2026!', 10),
      full_name: role, role, is_active: true,
    });
  }

  adminToken = (await request(app).post('/api/v1/auth/login').send({ email: 'admin.chk@shopfloor.local', password: 'Test2026!' })).body.token;
  operatorToken = (await request(app).post('/api/v1/auth/login').send({ email: 'operator.chk@shopfloor.local', password: 'Test2026!' })).body.token;

  await db('machines.machines').where({ code: 'CHK-TEST-01' }).del();
  const [m] = await db('machines.machines').insert({ code: 'CHK-TEST-01', name: 'Test Machine', type: 'CNC', status: 'active' }).returning('*');
  machineId = m.id;
});

afterAll(async () => {
  await db('checklists.completions').where({ machine_id: machineId }).del();
  if (templateId) await db('checklists.templates').where({ id: templateId }).del();
  await db('machines.machines').where({ code: 'CHK-TEST-01' }).del();
  await db('auth.users').whereILike('email', '%.chk@shopfloor.local').del();
  await db.destroy();
});

describe('Templates', () => {
  it('POST /templates ca operator → 403', async () => {
    const res = await request(app).post('/api/v1/checklists/templates')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ name: 'Test', items: [{ id: '1', text: 'Verifica ulei', required: true }] });
    expect(res.status).toBe(403);
  });

  it('POST /templates ca admin → 201', async () => {
    const res = await request(app).post('/api/v1/checklists/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Checklist Debut Serie CNC',
        machineType: 'CNC',
        items: [
          { id: '1', text: 'Verifica nivelul uleiului', required: true },
          { id: '2', text: 'Verifica dispozitivul de prindere', required: true },
          { id: '3', text: 'Verifica sculele', required: false },
        ],
      });
    expect(res.status).toBe(201);
    templateId = res.body.id;
  });

  it('GET /templates → 200', async () => {
    const res = await request(app).get('/api/v1/checklists/templates').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('PUT /templates/:id → 200', async () => {
    const res = await request(app).put(`/api/v1/checklists/templates/${templateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.is_active).toBe(false);
  });
});

describe('Completions', () => {
  it('POST /complete ca operator → 201', async () => {
    const res = await request(app).post('/api/v1/checklists/complete')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        templateId,
        machineId,
        shift: 'Tura I',
        responses: [
          { itemId: '1', checked: true },
          { itemId: '2', checked: true },
          { itemId: '3', checked: false },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.all_ok).toBe(true);
  });

  it('POST /complete cu item required nechecked → all_ok false', async () => {
    // Re-activate template first
    await db('checklists.templates').where({ id: templateId }).update({ is_active: true });

    const res = await request(app).post('/api/v1/checklists/complete')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        templateId,
        machineId,
        shift: 'Tura II',
        responses: [
          { itemId: '1', checked: false },
          { itemId: '2', checked: true },
          { itemId: '3', checked: true },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.all_ok).toBe(false);
  });

  it('GET /completions → 200', async () => {
    const res = await request(app).get(`/api/v1/checklists/completions?machineId=${machineId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });
});
