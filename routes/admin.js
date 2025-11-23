import express from "express";
import * as adminController from "../controller/admin.js";
import { authMiddleware, verifyAdminAccess } from "../middleware/auth.js";

const adminRouter = express.Router();

adminRouter
  .post("/login", adminController.loginAdmin)
  .post(
    "/create-product",
    authMiddleware,
    verifyAdminAccess,
    adminController.createProduct
  )
  .patch(
    "/product/:id",
    authMiddleware,
    verifyAdminAccess,
    adminController.updateProduct
  )
  .delete(
    "/product/:id",
    authMiddleware,
    verifyAdminAccess,
    adminController.deleteProduct
  )
  .post(
    "/get-upload-image-url",
    authMiddleware,
    verifyAdminAccess,
    adminController.getUploadImageUrl
  )
  .get(
    "/orders",
    authMiddleware,
    verifyAdminAccess,
    adminController.getAllOrders
  )
  .get("/stats", authMiddleware, verifyAdminAccess, adminController.getStats);

export { adminRouter };
