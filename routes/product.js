import express from "express";
import * as productController from "../controller/product.js";
import multer from "multer";

const productRouter = express.Router();

const upload = multer();

productRouter
  .post("/", upload.array("images", 2), productController.createproduct)
  .get("/", productController.getAllproducts)
  .get("/get-related-products", productController.getRelatedProducts)
  .get("/:id", productController.getproduct);

export { productRouter };
