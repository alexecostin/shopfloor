import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import { authenticate, authorize } from './auth.js';
import { validate } from './validate.js';
import errorHandler from './errorHandler.js';

// Silence logger in tests
vi.mock('../config/logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Helper to create mock req/res/next
function mockReqRes(overrides = {}) {
  const req = { headers: {}, params: {}, user: null, ...overrides };
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();
  return { req, res, next };
}

// ── AUTH MIDDLEWARE ─────────────────────────────────────────────────────────

describe('authenticate middleware', () => {
  const secret = 'test_secret_min_32_chars_for_tests';

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
  });

  it('token valid → seteaza req.user si apeleaza next()', () => {
    const payload = { userId: '1', email: 'a@b.com', role: 'admin', fullName: 'Admin' };
    const token = jwt.sign(payload, secret);
    const { req, res, next } = mockReqRes({ headers: { authorization: `Bearer ${token}` } });

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toMatchObject(payload);
  });

  it('token invalid → 401', () => {
    const { req, res, next } = mockReqRes({ headers: { authorization: 'Bearer invalid.token.here' } });

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('token lipsa → 401', () => {
    const { req, res, next } = mockReqRes();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rol gresit → 403', () => {
    const { req, res, next } = mockReqRes({ user: { role: 'operator' } });

    authorize('admin', 'production_manager')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rol corect → apeleaza next()', () => {
    const { req, res, next } = mockReqRes({ user: { role: 'admin' } });

    authorize('admin', 'production_manager')(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });
});

// ── VALIDATE MIDDLEWARE ──────────────────────────────────────────────────────

describe('validate middleware', () => {
  const schema = Joi.object({ email: Joi.string().email().required(), age: Joi.number().min(1) });

  it('body valid → apeleaza next()', () => {
    const { req, res, next } = mockReqRes({ body: { email: 'test@example.com', age: 25 } });

    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('body invalid → 400 cu detalii', () => {
    const { req, res, next } = mockReqRes({ body: { email: 'not-an-email' } });

    validate(schema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
    const json = res.json.mock.calls[0][0];
    expect(json.error).toBe('DATE_INVALIDE');
    expect(json.details).toBeDefined();
  });
});

// ── ERROR HANDLER ────────────────────────────────────────────────────────────

describe('errorHandler middleware', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('eroare cu statusCode custom', () => {
    const err = Object.assign(new Error('Not found'), { statusCode: 404, code: 'NU_GASIT' });
    const { req, res, next } = mockReqRes({ path: '/test', method: 'GET' });

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    const json = res.json.mock.calls[0][0];
    expect(json.error).toBe('NU_GASIT');
  });

  it('eroare fara statusCode → 500', () => {
    const err = new Error('Ceva a mers gresit');
    const { req, res, next } = mockReqRes({ path: '/test', method: 'POST' });

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    const json = res.json.mock.calls[0][0];
    expect(json.statusCode).toBe(500);
  });
});
