import { Router } from 'express';

import { getHoldings } from './holding.controller.js';
import authenticate from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', authenticate, getHoldings);

export default router;