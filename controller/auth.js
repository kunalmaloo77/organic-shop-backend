//{ loginEmail: 'w@w', loginPassword: '1213131' }
import { userModel } from "../model/user.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const loginUser = async (req, res) => {
  try {
    const email = req.body.loginEmail;
    const user = await userModel.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });
    const match = await bcrypt.compare(req.body.loginPassword, user.password);
    const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    if (match) {
      res.cookie("token", accessToken, {
        httpOnly: true, // JS can't read it (prevents XSS)
        secure: true, // only HTTPS
        sameSite: "none", // No CSRF protection
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
      res.json({ message: "Login successful" });
    } else {
      res.status(401).json({ message: "Unauthorized" });
    }
  } catch (error) {
    console.error("Login error->", error);
    res.status(500).json({ message: "Internal Server Error" });
    return;
  }
};

export const checkAuthenticated = async (req, res) => {
  if (req.user) {
    const user = await userModel.findById(req.user.id).select("-password");
    return res.status(200).json({
      success: true,
      user,
    });
  }
  res.status(401).json({
    success: false,
    message: "User not authenticated",
  });
};

export const logoutUser = (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      error: "Logout failed",
    });
  }
};
