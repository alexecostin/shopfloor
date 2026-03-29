import { Router } from 'express';
import * as controller from './auth.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { authLimiter as _authLimiter } from '../../middleware/rateLimiter.js';

// Disable rate limiting in tests
const authLimiter = process.env.NODE_ENV === 'test' ? (req, res, next) => next() : _authLimiter;
import {
  loginSchema,
  registerSchema,
  updateUserSchema,
  changePasswordSchema,
} from './auth.validation.js';

const router = Router();

router.post('/login', authLimiter, validate(loginSchema), controller.login);
router.post('/register', authenticate, authorize('admin'), validate(registerSchema), controller.register);
router.get('/me', authenticate, controller.me);
router.get('/users', authenticate, authorize('admin', 'production_manager'), controller.listUsers);
router.put('/users/:id', authenticate, authorize('admin'), validate(updateUserSchema), controller.updateUser);
router.put('/change-password', authenticate, validate(changePasswordSchema), controller.changePassword);

export default router;
