import mongoose from "mongoose";
const { Schema } = mongoose;

const productSchema = new Schema({
  name: { type: String, required: true },
  title: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String },
  image_url: { type: String },
  small_image_url: { type: String },
  sale: { type: Boolean, default: false },
  sale_price: {
    type: Number,
    required: function () {
      return this.sale;
    },
  },
});

export const productModel = mongoose.model("Product", productSchema);
