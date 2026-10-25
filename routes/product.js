import express from "express";
import * as productController from "../controller/product.js";

const productRouter = express.Router();

productRouter
  .get("/", productController.getAllproducts)
  .get("/get-related-products", productController.getRelatedProducts)
  .get("/:id", productController.getProduct);

export { productRouter };
