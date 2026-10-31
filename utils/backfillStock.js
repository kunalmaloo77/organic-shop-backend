import { productModel } from "../model/product.js";
import mongoose from "mongoose";
import "dotenv/config";

const DEFAULT_STOCK = 10;

export const backfillStock = async () => {
  // give every product that has no stock yet a default stock
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const result = await productModel.updateMany(
      { stock: { $exists: false } },
      { $set: { stock: DEFAULT_STOCK } },
    );
    console.log(
      `Set stock to ${DEFAULT_STOCK} for ${result.modifiedCount} products`,
    );
  } catch (error) {
    console.error("Error backfilling stock:", error);
  } finally {
    mongoose.disconnect();
  }
};

backfillStock();
