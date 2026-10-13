import { Router } from 'express';

import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from './watchlist.controller.js';

import authenticate from '../../middleware/auth.middleware.js';

const router = Router();

// All watchlist routes require authentication
router.use(authenticate);

// GET /api/watchlist
router.get('/', getWatchlist);

// POST /api/watchlist
router.post('/', addToWatchlist);

// DELETE /api/watchlist/:symbol
router.delete('/:symbol', removeFromWatchlist);

export default router;