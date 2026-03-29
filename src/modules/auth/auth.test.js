import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import db from '../../config/db.js';
import bcrypt from 'bcrypt';

let adminToken;
let operatorToken;
let testUserId;

beforeAll(async () => {
  // Ensure admin exists
  await db('auth.users').where({ email: 'admin@shopfloor.local' }).del();
  const hash = await bcrypt.hash('ShopFloor2026!', 10);
  await db('auth.users').insert({
    email: 'admin@shopfloor.local',
    password_hash: hash,
    full_name: 'Administrator',
    role: 'admin',
    is_active: true,
  });

  // Login as admin to get token
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@shopfloor.local', password: 'ShopFloor2026!' });
  adminToken = res.body.token;

  // Create an operator user and get its token
  await db('auth.users').where({ email: 'operator@shopfloor.local' }).del();
  const opHash = await bcrypt.hash('Operator2026!', 10);
  const [op] = await db('auth.users').insert({
    email: 'operator@shopfloor.local',
    password_hash: opHash,
    full_name: 'Test Operator',
    role: 'operator',
    is_active: true,
  }).returning('*');

  const opRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'operator@shopfloor.local', password: 'Operator2026!' });
  operatorToken = opRes.body.token;
});

afterAll(async () => {
  await db('auth.users').where({ email: 'test.register@shopfloor.local' }).del();
  await db('auth.users').where({ email: 'operator@shopfloor.local' }).del();
  await db('auth.users').where({ email: 'admin@shopfloor.local' }).del();
  await db.destroy();
});

// ── LOGIN ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  it('login corect → 200 + token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@shopfloor.local', password: 'ShopFloor2026!' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('admin@shopfloor.local');
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('login parola gresita → 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@shopfloor.local', password: 'WrongPassword1!' });

    expect(res.status).toBe(401);
  });

  it('login email inexistent → 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'noone@shopfloor.local', password: 'ShopFloor2026!' });

    expect(res.status).toBe(401);
  });
});

// ── REGISTER ─────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  it('register fara autentificare → 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'x@x.com', password: 'Test1234!', fullName: 'X', role: 'operator' });

    expect(res.status).toBe(401);
  });

  it('register ca operator (non-admin) → 403', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ email: 'x@x.com', password: 'Test1234!', fullName: 'X', role: 'operator' });

    expect(res.status).toBe(403);
  });

  it('register cu date valide (ca admin) → 201', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'test.register@shopfloor.local',
        password: 'TestUser2026!',
        fullName: 'Test User',
        role: 'operator',
      });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('test.register@shopfloor.local');
    expect(res.body.password_hash).toBeUndefined();
    testUserId = res.body.id;
  });

  it('register email duplicat → 409', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'test.register@shopfloor.local',
        password: 'TestUser2026!',
        fullName: 'Test User',
        role: 'operator',
      });

    expect(res.status).toBe(409);
  });
});

// ── ME ───────────────────────────────────────────────────────────────────────

describe('GET /api/v1/auth/me', () => {
  it('me fara token → 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('me cu token valid → 200', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('admin@shopfloor.local');
    expect(res.body.password_hash).toBeUndefined();
  });
});
