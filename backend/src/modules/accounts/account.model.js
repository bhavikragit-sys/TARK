import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      immutable: true,
    },

    initialBalance: {
      type: Number,
      required: true,
      default: 10000000, // ₹1,00,000 in paise
      min: 0,
      immutable: true,
    },

    availableBalance: {
      type: Number,
      required: true,
      default: 10000000, // ₹1,00,000 in paise
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Account = mongoose.model('Account', accountSchema);

export default Account;