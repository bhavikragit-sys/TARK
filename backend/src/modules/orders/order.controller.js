import Order from "./order.model.js";
import { executeOrder } from "./order.service.js";

export const createOrder = async (req, res, next) => {
  try {
    const { symbol, side, quantity } = req.body;

    const order = await executeOrder({
      userId: req.user._id,
      symbol,
      side,
      quantity,
    });

    res.status(201).json({
      success: true,
      message: "Order executed successfully",
      order,
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderHistory = async (req, res, next) => {
  try {
    const orders = await Order.find({
      userId: req.user._id,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    next(error);
  }
};
