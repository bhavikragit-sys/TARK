import {
  getStockQuote,
  getAvailableStocks,
} from './market-data.service.js';

import ApiError from '../../utils/ApiError.js';

export const getStocks = async (req, res, next) => {
  try {
    const stocks = await getAvailableStocks();

    res.status(200).json({
      success: true,
      count: stocks.length,
      stocks,
    });
  } catch (error) {
    next(error);
  }
};

export const getStockBySymbol = async (req, res, next) => {
  try {
    const { symbol } = req.params;

    const stock = await getStockQuote(symbol);

    if (!stock) {
      throw new ApiError(404, 'Stock not found');
    }

    res.status(200).json({
      success: true,
      stock,
    });
  } catch (error) {
    next(error);
  }
};

