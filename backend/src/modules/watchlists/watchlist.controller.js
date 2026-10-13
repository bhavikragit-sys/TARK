import Watchlist from "./watchlist.model.js";
import { getStockQuote } from "../market-data/market-data.service.js";


export const getWatchlist = async (req, res, next) => {
  try {
    let watchlist = await Watchlist.findOne({
      userId: req.user._id,
    });

    if (!watchlist) {
      watchlist = await Watchlist.create({
        userId: req.user._id,
        symbols: [],
      });
    }

    const stocks = (
      await Promise.all(
        watchlist.symbols.map((symbol) => getStockQuote(symbol)),
      )
    ).filter(Boolean);

    res.status(200).json({
      success: true,
      count: stocks.length,
      stocks,
    });
  } catch (error) {
    next(error);
  }
};


export const addToWatchlist = async (req, res, next) => {
  try {
    const symbol = req.body.symbol?.trim().toUpperCase();

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: "Stock symbol is required",
      });
    }

    const stock = await getStockQuote(symbol);

    if (!stock) {
      return res.status(404).json({
        success: false,
        message: "Stock symbol not found",
      });
    }

    let watchlist = await Watchlist.findOne({
      userId: req.user._id,
    });

    if (!watchlist) {
      watchlist = await Watchlist.create({
        userId: req.user._id,
        symbols: [],
      });
    }

    if (watchlist.symbols.includes(symbol)) {
      return res.status(409).json({
        success: false,
        message: "Stock is already in your watchlist",
      });
    }

    watchlist.symbols.push(symbol);
    await watchlist.save();

    res.status(201).json({
      success: true,
      message: `${symbol} added to watchlist`,
      stock,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/watchlist/:symbol — Remove a stock
export const removeFromWatchlist = async (req, res, next) => {
  try {
    const symbol = req.params.symbol?.trim().toUpperCase();

    const watchlist = await Watchlist.findOne({
      userId: req.user._id,
    });

    if (!watchlist || !watchlist.symbols.includes(symbol)) {
      return res.status(404).json({
        success: false,
        message: "Stock not found in your watchlist",
      });
    }

    watchlist.symbols = watchlist.symbols.filter(
      (savedSymbol) => savedSymbol !== symbol,
    );

    await watchlist.save();

    res.status(200).json({
      success: true,
      message: `${symbol} removed from watchlist`,
    });
  } catch (error) {
    next(error);
  }
};
