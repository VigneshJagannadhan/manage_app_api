import { Router } from 'express';
import { getPreferences, updatePreferences, getSchedule } from '../controllers/notification.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/schedule', asyncHandler(getSchedule));
router.get('/preferences', asyncHandler(getPreferences));
router.patch('/preferences', asyncHandler(updatePreferences));

export default router;
