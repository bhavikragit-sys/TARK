import mongoose from 'mongoose';

const watchlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
      unique: true,
    },

    symbols: {
      type: [
        {
          type: String,
          uppercase: true,
          trim: true,
        },
      ],
      default: [],
      validate: {
        validator: (symbols) =>
          symbols.length === new Set(symbols).size,
        message: 'Watchlist cannot contain duplicate stock symbols',
      },
    },
  },
  {
    timestamps: true,
  }
);

const Watchlist = mongoose.model('Watchlist', watchlistSchema);

export default Watchlist;