import express from "express";
import * as authController from "../controller/auth.js";
import { authMiddleware, refreshTokenMiddleware } from "../middleware/auth.js";
import { authRateLimiter } from "../middleware/rateLimiter.js";

const authRouter = express.Router();

authRouter.post("/login", authRateLimiter, authController.loginUser);
authRouter.get("/login/federated/google", authController.googleLogin);
authRouter.get(
  "/login/federated/google/callback",
  authController.googleLoginCallback
);
authRouter.post("/signup", authRateLimiter, authController.signupUser);
authRouter.post("/logout", authMiddleware, authController.logoutUser);
authRouter.patch(
  "/reset-password",
  authMiddleware,
  authRateLimiter,
  authController.resetPassword
);
authRouter.post(
  "/refresh-token",
  refreshTokenMiddleware,
  authController.refreshToken
);
authRouter.post("/forgot-password", authRateLimiter, authController.forgotPassword);

export { authRouter };
