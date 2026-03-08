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
  effective_price: { type: Number, required: true },
  sale_price: {
    type: Number,
    required: function () {
      return this.sale;
    },
  },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
});

productSchema.pre("validate", function (next) {
  if (this.sale) {
    this.effective_price = this.sale_price;
  } else {
    this.effective_price = this.price;
  }
  next();
});

export const productModel = mongoose.model("Product", productSchema);
