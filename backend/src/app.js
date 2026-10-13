import express from 'express';
import cookieParser from 'cookie-parser';
import errorHandler from './middleware/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import accountRoutes from './modules/accounts/account.routes.js';
import marketDataRoutes from './modules/market-data/market-data.routes.js';
import orderRoutes from './modules/orders/order.routes.js';
import holdingRoutes from './modules/holdings/holding.routes.js';
import watchlistRoutes from './modules/watchlists/watchlist.routes.js';

// App
const app = express();

// Global Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());





// Routes
app.use('/api/auth', authRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/stocks', marketDataRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/holdings', holdingRoutes);
app.use('/api/watchlist', watchlistRoutes);


// Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'TARK API is running',
  });
});




// Global Error Handler
app.use(errorHandler);


export default app;