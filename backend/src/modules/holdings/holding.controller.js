import Holding from './holding.model.js';

export const getHoldings = async (req, res, next) => {
  try {
    const holdings = await Holding.find({
      userId: req.user._id,
      quantity: { $gt: 0 },
    })
      .select('symbol quantity averagePricePaise createdAt updatedAt')
      .sort({ symbol: 1 })
      .lean();

    const formattedHoldings = holdings.map((holding) => ({
      id: holding._id,
      symbol: holding.symbol,
      quantity: holding.quantity,
      averagePricePaise: holding.averagePricePaise,
      averagePrice: holding.averagePricePaise / 100,
      createdAt: holding.createdAt,
      updatedAt: holding.updatedAt,
    }));

    res.status(200).json({
      success: true,
      count: formattedHoldings.length,
      holdings: formattedHoldings,
    });
  } catch (error) {
    next(error);
  }
};