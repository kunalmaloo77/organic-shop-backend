import jwt from "jsonwebtoken";
import client from "../redis_connect.js";
import { deleteRefreshToken, revokeAllTokensOfUser } from "../utils/util.js";
import { userModel } from "../model/user.js";
import { errorResponse } from "../utils/response.js";

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const parts = authHeader ? authHeader.split(" ") : [];
  const token =
    parts.length === 2 && parts[0] === "Bearer" ? parts[1] : undefined;

  if (!token) {
    return res
      .status(401)
      .json(
        errorResponse("No token, authorization denied", [{ code: "NO_TOKEN" }])
      );
  }
  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decoded) => {
    if (err)
      return res
        .status(401)
        .json(
          errorResponse("Invalid access token", [{ code: "INVALID_TOKEN" }])
        );
    req.user = decoded;
    next();
  });
}

export const refreshTokenMiddleware = async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return res
      .status(401)
      .json(
        errorResponse("No refresh token, Authorization denied", [
          { code: "NO_TOKEN" },
        ])
      );
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
      return res
        .status(403)
        .json(
          errorResponse("Detected refresh token reuse", [
            { code: "REFRESH_TOKEN_REUSE" },
          ])
        );
    }

    await deleteRefreshToken(refreshToken);

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      if (foundUserId !== decoded.id) {
        await deleteRefreshToken(refreshToken);
        return res
          .status(403)
          .json(
            errorResponse("Invalid refresh token", [
              { code: "INVALID_REFRESH_TOKEN" },
            ])
          );
      }
      req.user = decoded;
      next();
    } catch (err) {
      // expired or invalid
      await deleteRefreshToken(refreshToken);
      return res
        .status(403)
        .json(
          errorResponse("Invalid refresh token", [{ code: "INVALID_TOKEN" }])
        );
    }
  } catch (error) {
    console.error("Refresh token middleware error:", error);
    res
      .status(500)
      .json(
        errorResponse("Internal Server Error", [
          { code: "INTERNAL_ERROR", detail: error.message },
        ])
      );
  }
};

export const verifyAdminAccess = (req, res, next) => {
  if (req.user && req.user?.role === "admin") {
    next();
  } else {
    return res
      .status(403)
      .json(
        errorResponse("Admin access required", [
          { code: "ADMIN_ACCESS_REQUIRED" },
        ])
      );
  }
};
