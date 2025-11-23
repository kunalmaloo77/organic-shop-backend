import express from "express";
import * as authController from "../controller/auth.js";
import { authMiddleware, refreshTokenMiddleware } from "../middleware/auth.js";

const authRouter = express.Router();

authRouter.post("/login", authController.loginUser);
authRouter.get("/login/federated/google", authController.googleLogin);
authRouter.get(
  "/login/federated/google/callback",
  authController.googleLoginCallback
);
authRouter.post("/signup", authController.signupUser);
authRouter.get(
  "/getCurrentUser",
  authMiddleware,
  authController.getCurrentUser
);
authRouter.post("/logout", authMiddleware, authController.logoutUser);
authRouter.patch(
  "/reset-password",
  authMiddleware,
  authController.resetPassword
);
authRouter.post(
  "/refresh-token",
  refreshTokenMiddleware,
  authController.refreshToken
);
authRouter.post("/forgot-password", authController.forgotPassword);

export { authRouter };
