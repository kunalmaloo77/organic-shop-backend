import express from "express";
import * as authController from "../controller/auth.js";
import { authMiddleware } from "../middleware/auth.js";

const authRouter = express.Router();

authRouter.post("/login", authController.loginUser);
authRouter.get(
  "/getCurrentUser",
  authMiddleware,
  authController.checkAuthenticated
);
authRouter.post("/logout", authMiddleware, authController.logoutUser);

export { authRouter };
