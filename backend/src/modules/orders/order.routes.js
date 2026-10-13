import { Router } from "express";
import { createOrder, getOrderHistory } from "./order.controller.js";
import validate from "../../middleware/validate.js";
import authenticate from "../../middleware/auth.middleware.js";
import { createOrderSchema } from "./order.validation.js";

const router = Router();

router.post("/", authenticate, validate(createOrderSchema), createOrder);

router.get("/", authenticate, getOrderHistory);

export default router;
