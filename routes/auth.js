import express from "express";
import * as authController from "../controller/auth.js";
import { authMiddleware, refreshTokenMiddleware } from "../middleware/auth.js";

const authRouter = express.Router();

authRouter.post("/login", authController.loginUser);
authRouter.get(
  "/getCurrentUser",
  authMiddleware,
  authController.getCurrentUser
);
authRouter.post("/logout", authMiddleware, authController.logoutUser);
authRouter.patch(
  "/resetPassword",
  authMiddleware,
  authController.resetPassword
);
authRouter.post(
  "/refresh-token",
  refreshTokenMiddleware,
  authController.refreshToken
);

export { authRouter };
