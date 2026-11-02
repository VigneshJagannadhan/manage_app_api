import { Router } from 'express';
import { deleteAccount, requestAccountDeletion } from '../controllers/account.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth.middleware';
import { requireHttps, webOriginCors } from '../middleware/webAccess.middleware';
import { appDeleteUserLimiter, webDeleteIdentifierLimiter, webDeleteIpLimiter } from '../utils/rateLimiter';

const router = Router();

router.use(requireHttps);

router.delete('/', authenticate, appDeleteUserLimiter, asyncHandler(deleteAccount));

router.use('/delete-request', webOriginCors);
router.post('/delete-request', webDeleteIpLimiter, webDeleteIdentifierLimiter, asyncHandler(requestAccountDeletion));

export default router;
