import { userModel } from "../model/user.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  deleteRefreshToken,
  revokeAllTokensOfUser,
  generateRefreshToken,
} from "../utils/util.js";
import client from "../redis_connect.js";
import { successResponse, errorResponse } from "../utils/response.js";
import nodemailer from "nodemailer";
import { googleConfig, oidc } from "../openid_config.js";

// POST: /users (create user)
export const signupUser = async (req, res) => {
  try {
    const name = req.body.name && String(req.body.name).trim();
    const email = req.body.email && String(req.body.email).toLowerCase().trim();
    const password = req.body.password && String(req.body.password).trim();
    if (!email || !password) {
      return res.status(400).json(
        errorResponse("Email and password are required", [
          {
            code: "MISSING_FIELDS",
            detail: "email and password are required",
          },
        ])
      );
    }

    const existing = await userModel.findOne({ email });
    if (existing) {
      return res
        .status(409)
        .json(
          errorResponse("User already exists", [
            { code: "USER_EXISTS", field: "email" },
          ])
        );
    }

    const userDoc = new userModel({
      name,
      email,
      password,
      role: "user",
      provider: "local",
    });
    const doc = await userDoc.save();

    const accessToken = jwt.sign(
      { id: doc._id },
      process.env.JWT_ACCESS_SECRET,
      {
        expiresIn: process.env.JWT_ACCESS_EXPIRY,
      }
    );
    const refreshToken = await generateRefreshToken(doc._id, "user");

    const userResponse = doc.toObject();
    delete userResponse.password;

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json(
      successResponse("User created successfully", {
        user: userResponse,
        accessToken,
      })
    );
  } catch (error) {
    console.error(error);
    if (error?.code === 11000) {
      return res
        .status(409)
        .json(errorResponse("User already exists", [{ code: "USER_EXISTS" }]));
    }
    res
      .status(500)
      .json(
        errorResponse("Internal Server Error", [
          { code: "INTERNAL_ERROR", detail: error.message },
        ])
      );
  }
};

// POST: /login (login user)
export const loginUser = async (req, res) => {
  try {
    const cookies = req.cookies;
    const email = req.body.loginEmail;
    const password = req.body.loginPassword;
    const user = await userModel.findOne({ email, role: "user" });

    if (!user)
      return res.status(400).json(
        errorResponse("User not found", [
          {
            code: "USER_NOT_FOUND",
            field: "email",
            detail: `No user found with email ${email}`,
          },
        ])
      );
    // If user registered via Google (password is null), block password login
    if (!user.password) {
      return res.status(400).json(
        errorResponse("User registered via Google. Please use Google login.", [
          {
            code: "GOOGLE_AUTH_ONLY",
            field: "email",
            detail: `User with email ${email} registered via Google. Use Google login.`,
          },
        ])
      );
    }

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

          return res
            .status(403)
            .json(
              errorResponse("Detected refresh token reuse", [
                { code: "REFRESH_TOKEN_REUSE" },
              ])
            );
        }

        res.clearCookie("refreshToken", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        });
        // delete old refresh token from redis
        await deleteRefreshToken(refreshToken);
      }

      const newRefreshToken = await generateRefreshToken(user._id, "user");
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

      res.json(
        successResponse("Login successful", {
          accessToken,
          user: userWithoutPassword,
        })
      );
    } else {
      res
        .status(401)
        .json(
          errorResponse("Incorrect password", [{ code: "INVALID_CREDENTIALS" }])
        );
    }
  } catch (error) {
    console.error("Login error->", error);
    res
      .status(500)
      .json(
        errorResponse("Internal Server Error", [
          { code: "INTERNAL_ERROR", detail: error.message },
        ])
      );
    return;
  }
};

export const logoutUser = async (req, res) => {
  try {
    const cookies = req.cookies;
    if (!cookies?.refreshToken) {
      return res
        .status(400)
        .json(
          errorResponse("No refresh token in cookies", [
            { code: "NO_REFRESH_TOKEN" },
          ])
        );
    }

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    // delete Refresh Token from Redis
    await deleteRefreshToken(cookies.refreshToken);

    res.status(200).json(successResponse("Logged out successfully", null));
  } catch (error) {
    console.error("Logout error:", error);
    res
      .status(500)
      .json(
        errorResponse("Logout failed", [
          { code: "INTERNAL_ERROR", detail: error.message },
        ])
      );
  }
};

export const resetPassword = async (req, res) => {
  try {
    if (req.user) {
      const { newPassword } = req.body;
      const userId = req.user.id;
      await userModel.findByIdAndUpdate(userId, { password: newPassword });
      res.status(200).json(successResponse("Password reset successful", null));
    } else {
      res
        .status(401)
        .json(
          errorResponse("User not authenticated", [{ code: "UNAUTHENTICATED" }])
        );
    }
  } catch (error) {
    console.error("Password reset error:", error);
    res
      .status(500)
      .json(
        errorResponse("Internal Server Error", [
          { code: "INTERNAL_ERROR", detail: error.message },
        ])
      );
  }
};

export const refreshToken = async (req, res) => {
  try {
    // middle ware sets req.user
    const user = req.user;
    if (!user) {
      return res
        .status(401)
        .json(errorResponse("Unauthorized", [{ code: "UNAUTHORIZED" }]));
    }
    const accessToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_ACCESS_SECRET,
      {
        expiresIn: process.env.JWT_ACCESS_EXPIRY,
      }
    );
    const refreshToken = await generateRefreshToken(user.id, user.role);
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    res.json(successResponse("Token refreshed successfully", { accessToken }));
  } catch (error) {
    console.error("Refresh token error:", error);
    res
      .status(500)
      .json(
        errorResponse("Internal Server Error", [
          { code: "INTERNAL_ERROR", detail: error.message },
        ])
      );
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res
      .status(400)
      .json(
        errorResponse("Bad Request", [
          { code: "BAD_REQUEST", detail: "email not found" },
        ])
      );
  }
  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json(
          errorResponse("User with this email not exists", [
            { code: "NOT_FOUND", detail: "User not found" },
          ])
        );
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_ACCESS_SECRET, {
      expiresIn: "15m",
    });

    const resetLink = `${process.env.FRONTEND_ENDPOINT}/reset-password/${token}`;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset Link",
      html: `<p>Click here to reset your password:</p>
             <a href="${resetLink}">${resetLink}</a>`,
    });

    res.json(successResponse("Password reset link sent"));
  } catch (error) {
    console.error("Error Resetting Password:", error);
    res
      .status(500)
      .json(
        errorResponse("Internal Server Error", [
          { code: "INTERNAL_ERROR", detail: error.message },
        ])
      );
  }
};

export const googleLogin = async (req, res) => {
  try {
    const code_verifier = oidc.randomPKCECodeVerifier();
    const code_challenge = await oidc.calculatePKCECodeChallenge(code_verifier);

    const parameters = {
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      scope: "openid email profile",
      code_challenge,
      code_challenge_method: "S256",
    };
    if (!googleConfig.serverMetadata().supportsPKCE()) {
      /**
       * We cannot be sure the server supports PKCE so we're going to use state too.
       * Use of PKCE is backwards compatible even if the AS doesn't support it which
       * is why we're using it regardless. Like PKCE, random state must be generated
       * for every redirect to the authorization_endpoint.
       */
      state = oidc.randomState();
      parameters.state = state;
      res.cookie("oauth_state", state, {
        httpOnly: process.env.NODE_ENV === "production",
        secure: true,
        maxAge: 5 * 60 * 1000, // 5 minutes
      });
    }
    const url = oidc.buildAuthorizationUrl(googleConfig, parameters);
    //NOTE: This is key to the code_challenge lock.
    res.cookie("pkce_verifier", code_verifier, {
      httpOnly: process.env.NODE_ENV === "production",
      secure: true,
      maxAge: 5 * 60 * 1000, // 5 minutes
    });
    res.redirect(url);
  } catch (error) {
    console.error("Google Login Error:", error);
    res
      .status(500)
      .json(
        errorResponse("Internal Server Error", [
          { code: "INTERNAL_ERROR", detail: error.message },
        ])
      );
  }
};

export const googleLoginCallback = async (req, res) => {
  try {
    const pkce_verifier = req.cookies.pkce_verifier;
    const state = req.cookies.oauth_state;
    const currentURL = new URL(`${process.env.BASE_URL}${req.originalUrl}`);
    let tokens = await oidc.authorizationCodeGrant(googleConfig, currentURL, {
      pkceCodeVerifier: pkce_verifier,
      expectedState: state ? state : undefined,
    });
    const { access_token } = tokens;
    let protectedResource = await oidc.fetchProtectedResource(
      googleConfig,
      access_token,
      new URL("https://openidconnect.googleapis.com/v1/userinfo"),
      "GET"
    );
    const data = await protectedResource.json();

    // Find or create user in DB
    let user = await userModel.findOne({ email: data.email });
    if (!user) {
      user = new userModel({
        name: data.name || data.email,
        email: data.email,
        password: null, // No password for federated login
        role: "user",
        provider: "google",
      });
      await user.save();
    }

    // Issue tokens
    const accessToken = jwt.sign(
      { id: user._id },
      process.env.JWT_ACCESS_SECRET,
      {
        expiresIn: process.env.JWT_ACCESS_EXPIRY,
      }
    );
    const refreshToken = await generateRefreshToken(user._id, "user");

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    // Set refreshToken cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const redirectUrl = new URL(
      process.env.FRONTEND_ENDPOINT || "http://localhost:5173"
    );
    redirectUrl.pathname = "/auth/success";
    // setting in url search param as this endpoint is hit via browser redirect
    redirectUrl.searchParams.set("accessToken", accessToken);
    redirectUrl.searchParams.set(
      "user",
      encodeURIComponent(JSON.stringify(userResponse))
    );
    return res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error("Google Login Callback Error:", error);
    res
      .status(500)
      .json(
        errorResponse("Internal Server Error", [
          { code: "INTERNAL_ERROR", detail: error.message },
        ])
      );
  }
};
