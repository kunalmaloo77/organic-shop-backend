import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  razorpayOrderId: { type: String, required: true },
  razorpayPaymentId: { type: String },
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ["created", "paid", "failed"],
    default: "created",
  },
  items: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      quantity: { type: Number, required: true },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

export const OrderModel = mongoose.model("Order", orderSchema);
