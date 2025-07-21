import express from "express";
import * as orderController from "../controller/order.js";
import { checkAuthenticated } from "../middleware/auth.js";

const orderRouter = express.Router();

orderRouter
  .get("/", checkAuthenticated, orderController.getOrdersByUser)
  .get("/:id", checkAuthenticated, orderController.getOrder)
  .post("/", checkAuthenticated, orderController.createOrder)
  .post("/verify-order", checkAuthenticated, orderController.verifyOrder)
  .patch("/:id/cancel", checkAuthenticated, orderController.cancelOrder);

export { orderRouter };
