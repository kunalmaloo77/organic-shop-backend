import mongoose from "mongoose";
const { Schema } = mongoose;

const productSchema = new Schema({
  name: { type: String, required: true },
  title: { type: String, enum: ["grocery", "juice"], required: true },
  price: { type: Number, required: true },
  description: { type: String },
  image_path: { type: String },
  image_url: { type: String },
  image_url_expires_at: { type: Date },
  small_image_path: { type: String },
  small_image_url: { type: String },
  small_image_url_expires_at: { type: Date },
  sale: { type: Boolean, default: false },
  sale_price: {
    type: Number,
    required: function () {
      return this.sale;
    },
  },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
});

export const productModel = mongoose.model("Product", productSchema);
