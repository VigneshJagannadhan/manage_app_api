import { Router } from 'express';
import { listJournals, upsertJournal } from '../controllers/journal.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(listJournals));
router.put('/', asyncHandler(upsertJournal));

export default router;
