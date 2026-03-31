import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as assistant from '../../services/daily-assistant.service.js';

const router = Router();
router.use(authenticate);

router.get('/tasks', async (req, res, next) => {
  try {
    const tasks = await assistant.getTasksForUser(
      req.user.userId,
      req.user.role,
      req.user.tenantId
    );
    res.json(tasks);
  } catch (e) {
    next(e);
  }
});

router.get('/operator-worksheet', async (req, res, next) => {
  try {
    const { machineId } = req.query;
    const sheet = await assistant.getOperatorWorkSheet(req.user.userId, machineId);
    res.json(sheet);
  } catch (e) {
    next(e);
  }
});

export default router;
