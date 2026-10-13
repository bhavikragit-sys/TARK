import Account from './account.model.js';
import ApiError from '../../utils/ApiError.js';
import Ledger from '../ledger/ledger.model.js';

export const getAccount = async (req, res, next) => {
  try {
    const account = await Account.findOne({
      userId: req.user._id,
    }).select('initialBalance availableBalance createdAt updatedAt');

    if (!account) {
      throw new ApiError(404, 'Trading account not found');
    }

    res.status(200).json({
      success: true,
      account: {
        id: account._id,
        initialBalance: account.initialBalance,
        availableBalance: account.availableBalance,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};


export const getLedgerHistory = async (req, res, next) => {
  try {
    const entries = await Ledger.find({
      userId: req.user._id,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: entries.length,
      entries,
    });
  } catch (error) {
    next(error);
  }
};