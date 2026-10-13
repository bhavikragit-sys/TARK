import mongoose from "mongoose";

const holdingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      immutable: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Quantity must be a non-negative whole number",
      },
      default: 0,
    },

    averagePricePaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Average price must be a non-negative whole number of paise",
      },
    },
  },
  { timestamps: true },
);

// One holding per user per stock.
holdingSchema.index({ userId: 1, symbol: 1 }, { unique: true });

const Holding = mongoose.model("Holding", holdingSchema);

export default Holding;
