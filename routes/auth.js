import express from "express";
import * as authController from "../controller/auth.js";
import passport from "passport";
import { checkAuthenticated } from "../middleware/auth.js";

const authRouter = express.Router();

const authenticateCallback = (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return res.status(500).json({ message: err.message });
    }
    if (!user) {
      return res.status(401).json({ message: info.message });
    }
    req.logIn(user, (err) => {
      if (err) {
        return res.status(500).json({ message: err.message });
      }
      req.user = user;
      return next();
    });
  })(req, res, next);
};

authRouter.post("/login", authenticateCallback, authController.checkUser);
authRouter.get(
  "/getCurrentUser",
  checkAuthenticated,
  authController.checkAuthenticated
);
authRouter.delete("/logout", checkAuthenticated, authController.logoutUser);

export { authRouter };
