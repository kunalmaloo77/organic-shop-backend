import express from "express";
import * as orderController from "../controller/order.js";
import { checkAuthenticated } from "../middleware/auth.js";

const orderRouter = express.Router();

orderRouter
  .get("/", checkAuthenticated, orderController.getOrdersByUser)
  .post("/", checkAuthenticated, orderController.createOrder)
  .post("/verify-payment", checkAuthenticated, orderController.verifyOrder);

export { orderRouter };
