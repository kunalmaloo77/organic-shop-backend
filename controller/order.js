import {
  validatePaymentVerification,
  validateWebhookSignature,
} from "razorpay/dist/utils/razorpay-utils.js";
import { instance } from "../api/app.js";
import { OrderModel } from "../model/order.js";
import { productModel } from "../model/product.js";
import { successResponse, errorResponse } from "../utils/response.js";

//create order
export const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currency, items, paymentMethod, billingDetails } = req.body;

    let totalAmount = 0;
    for (const item of items) {
      const product = await productModel.findById(item.productId);
      if (!product) {
        return res.status(404).json(
          errorResponse("Product not found", [
            {
              code: "PRODUCT_NOT_FOUND",
              detail: `No product found with id ${item.productId}`,
            },
          ]),
        );
      }
      totalAmount += product.price * item.quantity;
    }

    let razorpayOrderId;
    if (paymentMethod === "online") {
      const options = {
        amount: totalAmount * 100,
        currency: currency,
      };
      const razorpayOrder = await instance.orders.create(options);
      razorpayOrderId = razorpayOrder.id;
    }
    const dbOrder = await OrderModel.create({
      userId,
      razorpayOrderId,
      amount: totalAmount * 100,
      items,
      billingDetails,
      status: paymentMethod === "cash" ? "PAYMENT_PENDING" : "CREATED",
      paymentMethod,
    });
    res
      .status(201)
      .json(successResponse("Order created successfully", { order: dbOrder }));
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json(
        errorResponse("Error creating order", [
          { code: "CREATE_ORDER_FAILED", detail: error.message },
        ]),
      );
  }
};

// Fetch all orders of a specific user
export const getOrdersByUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const orders = await OrderModel.find({ userId })
      .populate("items.productId")
      .sort({ createdAt: -1 });

    // Convert amount from paise to rupees for each order
    const ordersWithConvertedAmount = orders.map((order) => {
      const orderObj = order.toObject();
      orderObj.amount = orderObj.amount / 100;
      return orderObj;
    });
    res
      .status(200)
      .json(
        successResponse(
          "Orders fetched successfully",
          { orders: ordersWithConvertedAmount },
          { count: ordersWithConvertedAmount.length },
        ),
      );
  } catch (error) {
    console.error("Error fetching orders:", error);
    res
      .status(500)
      .json(
        errorResponse("Failed to fetch orders", [
          { code: "FETCH_ORDERS_FAILED", detail: error.message },
        ]),
      );
  }
};

// Fetch order by id
export const getOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.id;
    const order = await OrderModel.findOne({ _id: orderId, userId }).populate(
      "items.productId",
    );
    if (!order) {
      return res.status(404).json(
        errorResponse("Order not found", [
          {
            code: "ORDER_NOT_FOUND",
            field: "id",
            detail: `No order found with id ${orderId}`,
          },
        ]),
      );
    }
    const orderObj = order.toObject();
    orderObj.amount = orderObj.amount / 100;
    res
      .status(200)
      .json(successResponse("Order fetched successfully", { order: orderObj }));
  } catch (error) {
    console.error("Error fetching order:", error);
    res
      .status(500)
      .json(
        errorResponse("Failed to fetch order", [
          { code: "FETCH_ORDER_FAILED", detail: error.message },
        ]),
      );
  }
};

export const verifyOrder = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
      req.body;

    const secret = process.env.RAZOR_PAY_API_SECRET;

    const isValid = validatePaymentVerification(
      { order_id: razorpay_order_id, payment_id: razorpay_payment_id },
      razorpay_signature,
      secret,
    );

    if (!isValid) {
      console.log("Payment Verification Failed");
      return res
        .status(400)
        .json(
          errorResponse("Invalid signature", [{ code: "INVALID_SIGNATURE" }]),
        );
    }
    return res.status(200).json(successResponse("Client Payment Verified"));
  } catch (error) {
    console.error("Error Verifying Payment", error);
    res
      .status(500)
      .json(
        errorResponse("Internal Server Error", [
          { code: "VERIFY_PAYMENT_FAILED", detail: error.message },
        ]),
      );
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = req.body.id;

    const updatedOrder = await OrderModel.findOneAndUpdate(
      { _id: orderId, userId },
      { status: "CANCELLED" },
      { new: true },
    );
    if (!updatedOrder) {
      return res.status(404).json(
        errorResponse("Order not found", [
          {
            code: "ORDER_NOT_FOUND",
            field: "id",
            detail: `No order found with id ${orderId}`,
          },
        ]),
      );
    }
    res.json(
      successResponse("Order cancelled successfully", { order: updatedOrder }),
    );
  } catch (error) {
    console.error("Error cancelling order:", error);
    res
      .status(500)
      .json(
        errorResponse("Failed to cancel order", [
          { code: "CANCEL_ORDER_FAILED", detail: error.message },
        ]),
      );
  }
};

// POST: /webhook
// Webhook for verifying orders
export const razorpayWebhook = async (req, res) => {
  try {
    const webhook_secret = process.env.RAZOR_PAY_WEBHOOK_SECRET;
    const webhook_signature = req.headers["x-razorpay-signature"];
    const webhook_body = req.body;

    const is_valid = validateWebhookSignature(
      JSON.stringify(webhook_body),
      webhook_signature,
      webhook_secret,
    );

    if (!is_valid) {
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    const { payload } = webhook_body;
    const { payment } = payload;

    await OrderModel.findOneAndUpdate(
      { razorpayOrderId: payment.entity.order_id },
      {
        razorpayPaymentId: payment.id,
        status:
          payment.entity.status === "captured"
            ? "PAYMENT_SUCCESS"
            : "PAYMENT_FAILED",
      },
    );

    res.status(200);
  } catch (error) {
    res
      .status(500)
      .json(
        errorResponse("Failed to verify order", [
          { code: "ORDER_VERIFICATION_FAILED", detail: error.message },
        ]),
      );
  }
};
