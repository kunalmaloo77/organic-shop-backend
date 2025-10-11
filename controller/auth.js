import { userModel } from "../model/user.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  deleteRefreshToken,
  revokeAllTokensOfUser,
  generateRefreshToken,
} from "../utils/util.js";
import client from "../redis_connect.js";

//{ loginEmail: 'abc@gmail.com', loginPassword: '1213131' }
export const loginUser = async (req, res) => {
  try {
    const cookies = req.cookies;
    const email = req.body.loginEmail;
    const password = req.body.loginPassword;
    const user = await userModel.findOne({ email });

    if (!user) return res.status(400).json({ message: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (match) {
      if (cookies?.refreshToken) {
        const refreshToken = cookies.refreshToken;
        const foundUserId = await client.get(`refresh_token:${refreshToken}`);
        // detected refresh token reuse
        if (!foundUserId) {
          try {
            const decoded = jwt.verify(
              refreshToken,
              process.env.JWT_REFRESH_SECRET
            );
            console.log("Detected refresh token reuse!");
            const hackedUserId = decoded.id;
            const hackerUser = await userModel.findById(hackedUserId);
            if (hackerUser) {
              await revokeAllTokensOfUser(hackedUserId);
            }
          } catch (err) {
            console.log("Detected refresh token reuse but invalid token");
          }

          return res.status(403).json({ message: "You can't hack me!" });
        }

        res.clearCookie("refreshToken", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        });
        // delete old refresh token from redis
        await deleteRefreshToken(refreshToken);
      }

      const newRefreshToken = await generateRefreshToken(user._id);
      res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
      const accessToken = jwt.sign(
        { id: user._id },
        process.env.JWT_ACCESS_SECRET,
        {
          expiresIn: process.env.JWT_ACCESS_EXPIRY,
        }
      );
      const userWithoutPassword = user.toObject();
      delete userWithoutPassword.password;

      res.json({ accessToken, user: userWithoutPassword });
    } else {
      res.status(401).json({ message: "Incorrect Password" });
    }
  } catch (error) {
    console.error("Login error->", error);
    res.status(500).json({ message: "Internal Server Error" });
    return;
  }
};

export const getCurrentUser = async (req, res) => {
  try {
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
  } catch (error) {
    console.error("Authentication check error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};

export const logoutUser = async (req, res) => {
  try {
    const cookies = req.cookies;
    if (!cookies?.refreshToken) {
      return res.status(400).json({ message: "No refresh token in cookies" });
    }

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    // delete Refresh Token from Redis
    await deleteRefreshToken(cookies.refreshToken);

    res.status(204).json({
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

export const resetPassword = async (req, res) => {
  try {
    if (req.user) {
      const { newPassword } = req.body;
      const userId = req.user.id;
      await userModel.findByIdAndUpdate(userId, { password: newPassword });
      res.status(200).json({ message: "Password reset successful" });
    }
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const refreshToken = async (req, res) => {
  try {
    // middle ware sets req.user
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const accessToken = jwt.sign(
      { id: user.id },
      process.env.JWT_ACCESS_SECRET,
      {
        expiresIn: process.env.JWT_ACCESS_EXPIRY,
      }
    );
    const refreshToken = await generateRefreshToken(user.id);
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    res.json({ accessToken });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
