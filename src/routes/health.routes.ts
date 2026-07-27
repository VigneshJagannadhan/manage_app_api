import { Router } from 'express';
import { getHealth } from '../controllers/health.controller';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/', asyncHandler(getHealth));

export default router;
