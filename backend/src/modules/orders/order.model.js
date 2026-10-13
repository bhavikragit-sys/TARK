import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
      index: true,
    },
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    side: {
      type: String,
      enum: ["BUY", "SELL"],
      required: true,
      immutable: true,
    },

    orderType: {
      type: String,
      enum: ["MARKET"],
      required: true,
      default: "MARKET",
      immutable: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Quantity must be a positive whole number",
      },
      immutable: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "EXECUTED", "REJECTED", "CANCELLED"],
      required: true,
      default: "PENDING",
      index: true,
    },

    executionPricePaise: {
      type: Number,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Execution price must be a whole number of paise",
      },
    },

    totalAmountPaise: {
      type: Number,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Total amount must be a whole number of paise",
      },
    },

    executedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

orderSchema.index({ userId: 1, createdAt: -1 });

const Order = mongoose.model("Order", orderSchema);

export default Order;
