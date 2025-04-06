import { instance } from "../api/index.js";
import { OrderModel } from "../model/order.js";
import Razorpay from "razorpay";
import { validatePaymentVerification } from "razorpay/dist/utils/razorpay-utils.js";

//create order
export const createOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { amount, currency, items } = req.body;
    const options = {
      amount: amount * 100,
      currency: currency,
    };
    const razorpayOrder = await instance.orders.create(options);
    const dbOrder = await OrderModel.create({
      userId,
      razorpayOrderId: razorpayOrder.id,
      amount,
      items,
      status: razorpayOrder.status,
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
      .populate("items.productId")
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
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
