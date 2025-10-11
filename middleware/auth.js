import jwt from "jsonwebtoken";
import client from "../redis_connect.js";
import { deleteRefreshToken, revokeAllTokensOfUser } from "../utils/util.js";
import { userModel } from "../model/user.js";

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const parts = authHeader ? authHeader.split(" ") : [];
  const token =
    parts.length === 2 && parts[0] === "Bearer" ? parts[1] : undefined;

  if (!token) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid Access Token." });
    req.user = decoded;
    next();
  });
}

export const refreshTokenMiddleware = async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return res
      .status(401)
      .json({ message: "No refresh token, Authorization denied" });
  }
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });
  try {
    const foundUserId = await client.get(`refresh_token:${refreshToken}`);
    if (!foundUserId) {
      // detected refresh token reuse
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
        console.log("Invalid token detected from user/hacker");
      }
      return res.status(403).json({ message: "You can't hack me!" });
    }

    await deleteRefreshToken(refreshToken);

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      if (foundUserId !== decoded.id) {
        await deleteRefreshToken(refreshToken);
        return res.status(403).json({ message: "Invalid Refresh Token" });
      }
      req.user = decoded;
      next();
    } catch (err) {
      // expired or invalid
      await deleteRefreshToken(refreshToken);
      return res.status(403).json({ message: "Invalid Refresh Token" });
    }
  } catch (error) {
    console.error("Refresh token middleware error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
