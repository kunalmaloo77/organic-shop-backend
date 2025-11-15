import mongoose from "mongoose";
const { Schema } = mongoose;

const productSchema = new Schema({
  name: { type: String, required: true },
  title: { type: String, enum: ["Grocery", "Juice"], required: true },
  price: { type: Number, required: true },
  image_path: { type: String },
  description: { type: String },
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
});

export const productModel = mongoose.model("Product", productSchema);
