import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as c from './hr.controller.js';

const router = Router();
router.use(authenticate);
const mgr = authorize('admin', 'production_manager');

// Skill levels
router.get('/skill-levels', c.listSkillLevels);
router.post('/skill-levels', authorize('admin'), c.createSkillLevel);
router.put('/skill-levels/:id', authorize('admin'), c.updateSkillLevel);

// Skills
router.get('/skills/matrix', c.getSkillMatrix);
router.get('/skills', c.listSkills);
router.post('/skills', mgr, c.createSkill);
router.put('/skills/:id', mgr, c.updateSkill);
router.delete('/skills/:id', mgr, c.deleteSkill);

// Availability
router.get('/available', c.getAvailable);

// Shifts
router.get('/shifts/schedule', c.getShiftSchedule);
router.get('/shifts/patterns', c.listShiftPatterns);
router.post('/shifts/patterns', mgr, c.createShiftPattern);
router.put('/shifts/patterns/:id', mgr, c.updateShiftPattern);
router.post('/shifts/overrides', mgr, c.createShiftOverride);

// Leave
router.get('/leave/calendar', c.getLeaveCalendar);
router.get('/leave', c.listLeave);
router.post('/leave', c.createLeave);
router.put('/leave/:id/approve', mgr, c.approveLeave);
router.put('/leave/:id/reject', mgr, c.rejectLeave);

export default router;
