import { Router } from 'express';

import {
  getStocks,
  getStockBySymbol,
} from './market-data.controller.js';

const router = Router();

// GET /api/stocks
router.get('/', getStocks);

// GET /api/stocks/:symbol
router.get('/:symbol', getStockBySymbol);

export default router;