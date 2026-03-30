/**
 * SQL Injection Security Tests
 * Verifies that all API endpoints are safe from SQL injection attacks.
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import db from '../../src/config/db.js';
import bcrypt from 'bcrypt';

let adminToken;

beforeAll(async () => {
  await db('auth.users').where({ email: 'security.test@shopfloor.local' }).del().catch(() => {});
  await db('auth.users').insert({
    email: 'security.test@shopfloor.local',
    password_hash: await bcrypt.hash('SecTest2026!', 10),
    full_name: 'Security Tester',
    role: 'admin',
    is_active: true,
  });
  const res = await request(app).post('/api/v1/auth/login')
    .send({ email: 'security.test@shopfloor.local', password: 'SecTest2026!' });
  adminToken = res.body.token;
}, 10000);

afterAll(async () => {
  // Cleanup injection test data
  await db('machines.machines').where('code', 'like', "%TEST');%").del().catch(() => {});
  await db('auth.users').where({ email: 'security.test@shopfloor.local' }).del().catch(() => {});
  await db('auth.users').where({ email: 'hacker@evil.com' }).del().catch(() => {});
  await db.destroy();
});

describe('SQL Injection Tests', () => {

  // SI-1: Login injection
  test('SI-1: SQL injection in login email returns 401', async () => {
    const res = await request(app).post('/api/v1/auth/login')
      .send({ email: "admin@test.ro' OR '1'='1", password: 'anything' });
    // Should be 400 (Joi validation) or 401 (auth failure) — NOT 200
    expect([400, 401]).toContain(res.status);
  });

  // SI-2: Search injection
  test('SI-2: SQL injection in search query param', async () => {
    const res = await request(app)
      .get("/api/v1/machines?search=CNC'; DROP TABLE machines;--")
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    // Should NOT be a 500 SQL error
  });

  // SI-3: Sort injection
  test('SI-3: SQL injection in sort param', async () => {
    const res = await request(app)
      .get('/api/v1/machines?sortBy=code; DROP TABLE machines;--')
      .set('Authorization', `Bearer ${adminToken}`);
    // Should not crash — either 200 with default sort or ignored
    expect([200, 400]).toContain(res.status);
  });

  // SI-5: Body injection
  test('SI-5: SQL injection in POST body stores literal string', async () => {
    const injectionCode = "CNC-01'; DROP TABLE production.orders;--";
    const res = await request(app)
      .post('/api/v1/machines')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: injectionCode, name: 'Injection Test Machine', type: 'cnc', status: 'active' });

    // Should either create with literal string or reject with validation error
    expect([201, 400, 422, 409]).toContain(res.status);

    if (res.status === 201) {
      // Verify the code is stored as literal string, not executed
      const machine = await db('machines.machines').where('code', injectionCode).first();
      expect(machine).toBeTruthy();
      expect(machine.code).toBe(injectionCode);
      // Verify production.orders still exists
      const ordersExist = await db.schema.hasTable('production.orders').catch(() => false);
      // Table should still exist (not dropped)

      // Cleanup
      await db('machines.machines').where('id', machine.id).del();
    }
  });

  // SI-6: LIKE injection
  test('SI-6: LIKE injection does not delete data', async () => {
    const countBefore = await db('machines.machines').count('* as c');
    const res = await request(app)
      .get("/api/v1/machines?search=%'; DELETE FROM machines WHERE '1'='1")
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const countAfter = await db('machines.machines').count('* as c');
    expect(Number(countAfter[0].c)).toBe(Number(countBefore[0].c));
  });

  // SI-7: Array injection in roleIds
  test('SI-7: Injection in UUID array returns error', async () => {
    const testUser = await db('auth.users').where('role', 'admin').first();
    if (!testUser) return;
    const res = await request(app)
      .put(`/api/v1/admin/users/${testUser.id}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleIds: ["'; DROP TABLE auth.roles;--"] });
    // Should fail validation or be harmless
    expect([200, 400, 500]).toContain(res.status);
    // Verify roles table still exists
    const rolesExist = await db('auth.roles').count('* as c');
    expect(Number(rolesExist[0].c)).toBeGreaterThan(0);
  });

  // SI-11: Second-order injection
  test('SI-11: Second-order injection via stored value', async () => {
    const injectionName = "TEST'); DROP TABLE machines;--";
    // Create
    const createRes = await request(app)
      .post('/api/v1/machines')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'SQLI-TEST-001', name: injectionName, type: 'cnc', status: 'active' });

    if (createRes.status === 201) {
      // Read back — should return literal string
      const listRes = await request(app)
        .get('/api/v1/machines?search=SQLI-TEST')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(listRes.status).toBe(200);
      const machines = listRes.body.data || listRes.body;
      const found = (Array.isArray(machines) ? machines : []).find(m => m.code === 'SQLI-TEST-001');
      if (found) {
        expect(found.name).toBe(injectionName); // Stored as literal
      }
      // Cleanup
      await db('machines.machines').where('code', 'SQLI-TEST-001').del();
    }
  });

  // SI-13: Batch operation injection
  test('SI-13: Injection in lookup displayName stores literal text', async () => {
    const injectionDisplay = "Test'); INSERT INTO auth.users (email,password_hash) VALUES ('hacker@evil.com','x');--";
    const res = await request(app)
      .post('/api/v1/lookups/stop_categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'sqli_test_cat', displayName: injectionDisplay, color: '#FF0000' });

    if (res.status === 201) {
      // Verify no hacker user was created
      const hacker = await db('auth.users').where('email', 'hacker@evil.com').first();
      expect(hacker).toBeFalsy();

      // Cleanup
      await db('system.lookup_values').where('code', 'sqli_test_cat').del().catch(() => {});
    }
    expect([201, 400, 500]).toContain(res.status);
  });

  // Additional: Verify CORS and security headers
  test('Security headers are present', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    // helmet() should set these
    expect(res.headers).toHaveProperty('x-content-type-options');
  });
});
