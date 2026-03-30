import * as authService from './auth.service.js';
import { logBusinessAction } from '../../services/audit.service.js';

export async function login(req, res, next) {
  try {
    const result = await authService.login(req.body.email, req.body.password);
    res.json(result);
    logBusinessAction(req, 'user.login', 'user', result.user?.id || null, result.user?.full_name || req.body.email, 'User logged in');
  } catch (err) {
    next(err);
  }
}

export async function register(req, res, next) {
  try {
    const user = await authService.register(req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = await authService.getMe(req.user.userId);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function listUsers(req, res, next) {
  try {
    const { page, limit, role, isActive, search } = req.query;
    const result = await authService.listUsers({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      role,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req, res, next) {
  try {
    const user = await authService.updateUser(req.params.id, req.body);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req, res, next) {
  try {
    await authService.changePassword(
      req.user.userId,
      req.body.currentPassword,
      req.body.newPassword
    );
    res.json({ message: 'Parola a fost schimbata cu succes.' });
  } catch (err) {
    next(err);
  }
}
