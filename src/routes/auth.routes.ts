import { Router } from 'express';
import { signup, signin, refresh, logout } from '../controllers/auth.controller';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post('/signup', asyncHandler(signup));
router.post('/signin', asyncHandler(signin));
router.post('/refresh', asyncHandler(refresh));
router.post('/logout', asyncHandler(logout));

export default router;
