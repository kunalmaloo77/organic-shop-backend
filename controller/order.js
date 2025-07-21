import { instance } from "../api/app.js";
import { OrderModel } from "../model/order.js";
import { validatePaymentVerification } from "razorpay/dist/utils/razorpay-utils.js";

//create order
export const createOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { amount, currency, items, paymentMethod, billingDetails } = req.body;
    let razorpayOrderId;
    if (paymentMethod === "online") {
      const options = {
        amount: amount * 100,
        currency: currency,
      };
      const razorpayOrder = await instance.orders.create(options);
      razorpayOrderId = razorpayOrder.id;
    }
    const dbOrder = await OrderModel.create({
      userId,
      razorpayOrderId,
      amount: amount * 100,
      items,
      billingDetails,
      status: paymentMethod === "cash" ? "pending" : "created",
      paymentMethod,
    });
    res
      .status(201)
      .send({ message: "Order Created Successfully", order: dbOrder });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error creating order");
  }
};

// Fetch all orders of a specific user
export const getOrdersByUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const orders = await OrderModel.find({ userId })
      .populate("items.product")
      .sort({ createdAt: -1 });

    // Convert amount from paise to rupees for each order
    const ordersWithConvertedAmount = orders.map((order) => {
      const orderObj = order.toObject();
      orderObj.amount = orderObj.amount / 100;
      return orderObj;
    });
    res.json(ordersWithConvertedAmount);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

// Fetch order by id
export const getOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const orderId = req.params.id;
    const order = await OrderModel.findOne({ _id: orderId, userId }).populate(
      "items.product"
    );
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    const orderObj = order.toObject();
    orderObj.amount = orderObj.amount / 100;
    res.json(orderObj);
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ error: "Failed to fetch order" });
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
      secret
    );

    if (!isValid) {
      console.log("Payment Verification Failed");
      res.status(400).json({ message: "Invalid Signature" });
    }
    const updatedOrder = await OrderModel.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      {
        razorpayPaymentId: razorpay_payment_id,
        status: "paid",
      },
      { new: true }
    );
    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    return res
      .status(200)
      .json({ message: "Payment Verified", order: updatedOrder });
  } catch (error) {
    console.error("Error Verifying Payment", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const orderId = req.params.id;
    const updatedOrder = await OrderModel.findOneAndUpdate(
      { _id: orderId, userId },
      { status: "cancelled" },
      { new: true }
    );
    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json({ message: "Order cancelled successfully", order: updatedOrder });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ error: "Failed to cancel order" });
  }
};
