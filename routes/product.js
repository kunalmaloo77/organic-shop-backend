import express from "express";
import * as productController from "../controller/product.js";
import multer from "multer";

const productRouter = express.Router();

const upload = multer();

productRouter
  .get("/", productController.getAllproducts)
  .get("/get-related-products", productController.getRelatedProducts)
  .get("/:id", productController.getproduct);

export { productRouter };
