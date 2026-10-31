import {
  validatePaymentVerification,
  validateWebhookSignature,
} from "razorpay/dist/utils/razorpay-utils.js";
import { instance } from "../api/app.js";
import { OrderModel } from "../model/order.js";
import { productModel } from "../model/product.js";
import { successResponse, errorResponse } from "../utils/response.js";

// give reserved stock back to the products
const restoreStock = async (items) => {
  for (const item of items) {
    await productModel.updateOne(
      { _id: item.productId },
      { $inc: { stock: item.quantity } },
    );
  }
};

  //create order
  export const createOrder = async (req, res) => {
    // every item added here has its stock already reserved, released again if the order fails
    const orderItems = [];
    try {
      const userId = req.user.id;
      const { currency, items, paymentMethod, billingDetails } = req.body;

      let totalAmount = 0;
      for (const rawItem of items) {
        // carts edited in the UI may hold the quantity as a numeric string
        const item = { ...rawItem, quantity: Number(rawItem.quantity) };
        if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
          await restoreStock(orderItems);
          return res.status(400).json(
            errorResponse("Invalid quantity", [
              {
                code: "INVALID_QUANTITY",
                detail: `Quantity for product ${item.productId} must be a positive integer`,
              },
            ]),
          );
        }
        // reserve stock atomically so concurrent orders cannot oversell
        const product = await productModel.findOneAndUpdate(
          {
            _id: item.productId,
            status: "active",
            stock: { $gte: item.quantity },
          },
          { $inc: { stock: -item.quantity } },
          { new: true },
        );
        if (!product) {
          await restoreStock(orderItems);
          const existing = await productModel.findById(item.productId);
          if (!existing) {
            return res.status(404).json(
              errorResponse("Product not found", [
                {
                  code: "PRODUCT_NOT_FOUND",
                  detail: `No product found with id ${item.productId}`,
                },
              ]),
            );
          }
          const available = existing.status === "active" ? existing.stock : 0;
          return res.status(409).json(
            errorResponse(`${existing.name} is out of stock`, [
              {
                code: "OUT_OF_STOCK",
                detail: `Only ${available} of ${existing.name} available`,
                productId: existing._id,
                available,
              },
            ]),
          );
        }
        totalAmount += product.price * item.quantity;
        orderItems.push({
          productId: product._id,
          quantity: item.quantity,
          name: product.name,
          price: product.price,
        });
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
        items: orderItems,
        billingDetails,
        status: paymentMethod === "cash" ? "PAYMENT_PENDING" : "CREATED",
        paymentMethod,
      });
      res
        .status(201)
        .json(successResponse("Order created successfully", { order: dbOrder }));
    } catch (error) {
      console.error(error);
      await restoreStock(orderItems).catch((e) =>
        console.error("Failed to restore stock:", e),
      );
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

    // only orders that have not been delivered, cancelled or refunded can be
    // cancelled; the previous document tells whether stock is still reserved
    const previousOrder = await OrderModel.findOneAndUpdate(
      {
        _id: orderId,
        userId,
        status: {
          $in: ["CREATED", "PAYMENT_PENDING", "PAYMENT_SUCCESS", "PAYMENT_FAILED"],
        },
      },
      { status: "CANCELLED" },
    );
    if (!previousOrder) {
      const exists = await OrderModel.exists({ _id: orderId, userId });
      if (!exists) {
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
      return res.status(409).json(
        errorResponse("Order cannot be cancelled", [
          { code: "ORDER_NOT_CANCELLABLE", field: "id" },
        ]),
      );
    }
    // PAYMENT_FAILED orders already had their stock restored
    if (previousOrder.status !== "PAYMENT_FAILED") {
      await restoreStock(previousOrder.items);
    }
    const updatedOrder = previousOrder;
    updatedOrder.status = "CANCELLED";
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
    // express.raw (see api/app.js) leaves the exact bytes Razorpay signed
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
    
    const is_valid =
      Boolean(webhook_signature) &&
      validateWebhookSignature(rawBody, webhook_signature, webhook_secret);

    if (!is_valid) {
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    const payment = JSON.parse(rawBody).payload?.payment?.entity;
    // events without a payment (e.g. refunds) are acknowledged and ignored
    if (!payment) {
      return res.status(200).json({ received: true });
    }

    const paymentSucceeded = payment.status === "captured";
    if (paymentSucceeded) {
      // a late success can still rescue an order whose earlier attempt failed
      await OrderModel.findOneAndUpdate(
        {
          razorpayOrderId: payment.order_id,
          status: { $in: ["CREATED", "PAYMENT_PENDING", "PAYMENT_FAILED"] },
        },
        { razorpayPaymentId: payment.id, status: "PAYMENT_SUCCESS" },
      );
    } else {
      // only fail orders still waiting on payment, so a failed retry can never
      // overwrite a successful payment, and stock is released exactly once
      const failedOrder = await OrderModel.findOneAndUpdate(
        {
          razorpayOrderId: payment.order_id,
          status: { $in: ["CREATED", "PAYMENT_PENDING"] },
        },
        { razorpayPaymentId: payment.id, status: "PAYMENT_FAILED" },
      );
      if (failedOrder) {
        await restoreStock(failedOrder.items);
      }
    }

    // always answer 200 so Razorpay stops retrying
    res.status(200).json({ received: true });
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
