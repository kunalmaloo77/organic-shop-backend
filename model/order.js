import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ["created", "paid", "failed", "pending", "delivered", "cancelled"],
    default: "created",
  },
  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      quantity: { type: Number, required: true },
    },
  ],
  createdAt: { type: Date, default: Date.now },
  paymentMethod: { type: String, enum: ["online", "cash"], required: true },
  billingDetails: {
    firstName: { type: String },
    lastName: { type: String },
    companyName: { type: String },
    address: { type: String },
    addressOptional: { type: String },
    pincode: { type: String },
    city: { type: String },
    state: { type: String },
    phone: { type: String },
    email: { type: String },
  },
});

export const OrderModel = mongoose.model("Order", orderSchema);
