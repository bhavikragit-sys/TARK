import mongoose from "mongoose";

import Account from "../accounts/account.model.js";
import Holding from "../holdings/holding.model.js";
import Order from "./order.model.js";
import Ledger from "../ledger/ledger.model.js";
import { getStockQuote } from "../market-data/market-data.service.js";
import ApiError from "../../utils/ApiError.js";

export const executeOrder = async ({ userId, symbol, side, quantity }) => {
  if (typeof symbol !== "string" || !symbol.trim()) {
    throw new ApiError(400, "A valid stock symbol is required");
  }

  if (!["BUY", "SELL"].includes(side)) {
    throw new ApiError(400, "Side must be BUY or SELL");
  }

  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new ApiError(400, "Quantity must be a positive whole number");
  }

  symbol = symbol.trim().toUpperCase();

  const stock = await getStockQuote(symbol);

  if (!stock) {
    throw new ApiError(404, "Stock not found");
  }

  if (!Number.isSafeInteger(stock.pricePaise) || stock.pricePaise <= 0) {
    throw new ApiError(503, "Stock price is currently unavailable");
  }

  const totalAmountPaise = stock.pricePaise * quantity;

  if (!Number.isSafeInteger(totalAmountPaise)) {
    throw new ApiError(400, "Order amount exceeds the permitted limit");
  }

  const session = await mongoose.startSession();

  try {
    let executedOrder;

    await session.withTransaction(async () => {
      const account = await Account.findOne({ userId }).session(session);

      if (!account) {
        throw new ApiError(404, "Trading account not found");
      }

      // BUY: verify that sufficient virtual money is available.
      if (side === "BUY") {
        const accountUpdate = await Account.updateOne(
          {
            _id: account._id,
            availableBalance: { $gte: totalAmountPaise },
          },
          {
            $inc: { availableBalance: -totalAmountPaise },
          },
          { session },
        );

        if (accountUpdate.modifiedCount !== 1) {
          throw new ApiError(400, "Insufficient funds");
        }

        const updatedAccount = await Account.findById(account._id).session(
          session,
        );

        let holding = await Holding.findOne({ userId, symbol }).session(
          session,
        );

        if (holding) {
          const newQuantity = holding.quantity + quantity;
          const existingCost = holding.averagePricePaise * holding.quantity;
          const newCost = stock.pricePaise * quantity;
          const totalCost = existingCost + newCost;

          if (
            !Number.isSafeInteger(newQuantity) ||
            !Number.isSafeInteger(totalCost)
          ) {
            throw new ApiError(400, "Holding exceeds the permitted limit");
          }

          holding.averagePricePaise = Math.round(totalCost / newQuantity);
          holding.quantity = newQuantity;

          await holding.save({ session });
        } else {
          holding = new Holding({
            userId,
            symbol,
            quantity,
            averagePricePaise: stock.pricePaise,
          });

          await holding.save({ session });
        }

        // Keep a reference to the updated account for the ledger.
        account.availableBalance = updatedAccount.availableBalance;
      } else if (side === "SELL") {
        const holdingUpdate = await Holding.updateOne(
          {
            userId,
            symbol,
            quantity: { $gte: quantity },
          },
          {
            $inc: { quantity: -quantity },
          },
          { session },
        );

        if (holdingUpdate.modifiedCount !== 1) {
          throw new ApiError(400, "Insufficient shares to sell");
        }

        const accountUpdate = await Account.updateOne(
          {
            _id: account._id,
          },
          {
            $inc: { availableBalance: totalAmountPaise },
          },
          { session },
        );

        if (accountUpdate.modifiedCount !== 1) {
          throw new ApiError(404, "Trading account not found");
        }

        const updatedAccount = await Account.findById(account._id).session(
          session,
        );

        account.availableBalance = updatedAccount.availableBalance;
      }

      executedOrder = new Order({
        userId,
        symbol,
        side,
        quantity,
        orderType: "MARKET",
        status: "EXECUTED",
        executionPricePaise: stock.pricePaise,
        totalAmountPaise,
        executedAt: new Date(),
      });

      await executedOrder.save({ session });

      const ledgerEntry = new Ledger({
        userId,
        accountId: account._id,
        orderId: executedOrder._id,
        entryType: side === "BUY" ? "BUY_DEBIT" : "SELL_CREDIT",
        amountPaise: totalAmountPaise,
        balanceAfterPaise: account.availableBalance,
        description: `${side} ${quantity} shares of ${symbol}`,
        idempotencyKey: `order:${executedOrder._id}`,
      });

      await ledgerEntry.save({ session });
    });

    return executedOrder;
  } finally {
    await session.endSession();
  }
};
