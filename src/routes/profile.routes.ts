import { Router } from 'express';
import { getProfile, updateProfile, changePassword } from '../controllers/profile.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(getProfile));
router.patch('/', asyncHandler(updateProfile));
router.post('/change-password', asyncHandler(changePassword));

export default router;
