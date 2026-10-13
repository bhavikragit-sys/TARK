import mongoose from 'mongoose';

const ledgerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
      index: true,
    },

    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      immutable: true,
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      immutable: true,
    },

    entryType: {
      type: String,
      enum: ['INITIAL_CREDIT', 'BUY_DEBIT', 'SELL_CREDIT'],
      required: true,
      immutable: true,
    },

    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Amount must be a positive whole number of paise',
      },
      immutable: true,
    },

    balanceAfterPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Balance must be a non-negative whole number of paise',
      },
      immutable: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      immutable: true,
    },
    // preventing the same financial movement from being recorded twice
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },
  },
  { timestamps: true }
);

ledgerSchema.index({ userId: 1, createdAt: -1 });

const Ledger = mongoose.model('Ledger', ledgerSchema);

export default Ledger;
