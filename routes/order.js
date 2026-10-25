import express from "express";
import * as orderController from "../controller/order.js";
import { authMiddleware } from "../middleware/auth.js";

const orderRouter = express.Router();

orderRouter
  .get("/", authMiddleware, orderController.getOrdersByUser)
  .get("/:id", authMiddleware, orderController.getOrder)
  .post("/", authMiddleware, orderController.createOrder)
  .post("/verify-order", authMiddleware, orderController.verifyOrder)
  .patch("/cancel", authMiddleware, orderController.cancelOrder)
  .post("/webhook", orderController.razorpayWebhook);

export { orderRouter };
