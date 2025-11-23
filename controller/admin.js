import { userModel } from "../model/user.js";
import { OrderModel } from "../model/order.js";
import { productModel } from "../model/product.js";
import { successResponse, errorResponse } from "../utils/response.js";
import {
  getLargeImageUploadUrl,
  getSmallImageUploadUrl,
} from "../utils/s3Service.js";

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import client from "../redis_connect.js";
import { deleteRefreshToken, generateRefreshToken } from "../utils/util.js";

// POST: /login
export const loginAdmin = async (req, res) => {
  try {
    const email = req.body.loginEmail;
    const password = req.body.loginPassword;
    const cookies = req.cookies;
    const adminUser = await userModel.findOne({ email, role: "admin" });

    if (!adminUser) {
      return res.status(404).json(
        errorResponse("Admin user not found", [
          {
            code: "ADMIN_NOT_FOUND",
            field: "email",
            detail: "No admin user found with the provided email",
          },
        ])
      );
    }

    const isPasswordValid = await bcrypt.compare(password, adminUser.password);
    if (isPasswordValid) {
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
      const newRefreshToken = await generateRefreshToken(
        adminUser._id,
        "admin"
      );
      res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
      const accessToken = jwt.sign(
        { id: adminUser._id, role: "admin" },
        process.env.JWT_ACCESS_SECRET,
        {
          expiresIn: process.env.JWT_ACCESS_EXPIRY,
        }
      );
      const adminWithoutPassword = adminUser.toObject();
      delete adminWithoutPassword.password;
      res.json(
        successResponse("Admin logged in successfully", {
          accessToken,
          user: adminWithoutPassword,
        })
      );
    } else {
      return res
        .status(401)
        .json(
          errorResponse("Incorrect password", [{ code: "INVALID_CREDENTIALS" }])
        );
    }
  } catch (error) {
    console.error("Error logging in admin:", error);
    res
      .status(500)
      .json(
        errorResponse("Failed to login admin", [
          { code: "ADMIN_LOGIN_FAILED", detail: error.message },
        ])
      );
  }
};

//GET: /stats
export const getStats = async (req, res) => {
  try {
    const activeUsers = await userModel.countDocuments();
    const totalOrders = await OrderModel.countDocuments();
    const totalRevenueAgg = await OrderModel.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
        },
      },
    ]);
    const now = new Date();

    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayThisYear = new Date(now.getFullYear(), 0, 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const [monthlySales, yearlySales, weeklySales] = await Promise.all([
      getSalesTotal(firstDayThisMonth, now),
      getSalesTotal(firstDayThisYear, now),
      getSalesTotal(startOfWeek, now),
    ]);

    const totalRevenue = totalRevenueAgg[0]?.totalRevenue || 0;
    const avgOrderValue = (totalRevenue / (totalOrders || 1)).toFixed(2);
    const sales = {
      monthly: monthlySales[0]?.totalSales || 0,
      yearly: yearlySales[0]?.totalSales || 0,
      weekly: weeklySales[0]?.totalSales || 0,
    };
    res.json(
      successResponse("Stats fetched successfully", {
        statsData: { activeUsers, totalOrders, avgOrderValue, sales },
      })
    );
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json(
        errorResponse("Failed to fetch users", [
          { code: "INTERNAL_ERROR", detail: error.message },
        ])
      );
  }
};

const getSalesTotal = async (startDate, endDate) => {
  return await OrderModel.aggregate([
    {
      $match: {
        createdAt: {
          $gte: startDate,
          $lt: endDate,
        },
      },
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: "$amount" },
      },
    },
  ]);
};

// POST: /create-product
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      title,
      price,
      description,
      sale,
      sale_price,
      filename,
      status,
    } = req.body;

    const product = {
      name,
      status,
      title,
      price,
      description,
      sale,
      sale_price,
      image_path: filename ? `public/products/large_size/${filename}` : "",
      small_image_path: filename
        ? `public/products/small_size/${filename}`
        : "",
    };

    const newProduct = new productModel(product);
    await newProduct.save();

    res
      .status(201)
      .json(successResponse("Product created successfully", { product }));
  } catch (error) {
    console.error("Error creating product:", error);
    res
      .status(500)
      .json(
        errorResponse("Failed to create product", [
          { code: "CREATE_PRODUCT_FAILED", detail: error.message },
        ])
      );
  }
};

// PATCH: /product/:id
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!updateData || !id) {
      return res
        .status(400)
        .json(
          errorResponse("No update data or id provided", [
            { code: "MISSING_DATA" },
          ])
        );
    }

    const updatedProduct = await productModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );
    if (!updatedProduct) {
      return res.status(404).json(
        errorResponse("Product not found", [
          {
            code: "PRODUCT_NOT_FOUND",
            field: "id",
            detail: `No product found with id ${id}`,
          },
        ])
      );
    }
    res.status(200).json(
      successResponse("Product updated successfully", {
        product: updatedProduct,
      })
    );
  } catch (error) {
    console.error("Error updating product:", error);
    res
      .status(500)
      .json(
        errorResponse("Failed to update product", [
          { code: "UPDATE_PRODUCT_FAILED", detail: error.message },
        ])
      );
  }
};

// DELETE: /product/:id
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedProduct = await productModel.findByIdAndDelete(id);
    if (!deletedProduct) {
      return res.status(404).json(
        errorResponse("Product not found", [
          {
            code: "PRODUCT_NOT_FOUND",
            field: "id",
            detail: `No product found with id ${id}`,
          },
        ])
      );
    }
    res.status(200).json(
      successResponse("Product deleted successfully", {
        product: deletedProduct,
      })
    );
  } catch (error) {
    console.error("Error deleting product:", error);
    res
      .status(500)
      .json(
        errorResponse("Failed to delete product", [
          { code: "DELETE_PRODUCT_FAILED", detail: error.message },
        ])
      );
  }
};

// POST: /get-upload-image-url
export const getUploadImageUrl = async (req, res) => {
  try {
    const { filename, contentType } = req.body;
    const allowedContentTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/jpg",
    ];
    if (!allowedContentTypes.includes(contentType)) {
      return res.status(400).json(
        errorResponse("Invalid content type", [
          {
            code: "INVALID_CONTENT_TYPE",
            detail:
              "Content type must be one of image/jpeg, image/png, image/webp, image/jpg",
          },
        ])
      );
    }
    const smallImageUploadUrl = await getSmallImageUploadUrl(
      filename,
      contentType
    );
    const largeImageUploadUrl = await getLargeImageUploadUrl(
      filename,
      contentType
    );
    res.status(200).json(
      successResponse("Image URL fetched successfully", {
        smallImageUploadUrl,
        largeImageUploadUrl,
      })
    );
  } catch (error) {
    console.error("Error fetching image URL:", error);
    res
      .status(500)
      .json(
        errorResponse("Failed to fetch image URL", [
          { code: "FETCH_IMAGE_URL_FAILED", detail: error.message },
        ])
      );
  }
};

// GET: /orders
export const getAllOrders = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1;
    const limit = Number.parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const orders = await OrderModel.find(
      {},
      {
        userId: 1,
        razorpayOrderId: 1,
        amount: 1,
        status: 1,
        paymentMethod: 1,
        createdAt: 1,
      }
    )
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalOrders = await OrderModel.countDocuments();

    return res.status(200).json(
      successResponse("Orders fetched successfully", {
        orders,
        page,
        limit,
        totalPages: Math.ceil(totalOrders / limit),
        totalOrders,
      })
    );
  } catch (error) {
    console.error("Error fetching orders:", error);
    return res
      .status(500)
      .json(
        errorResponse("Failed to fetch orders", [
          { code: "FETCH_ORDERS_FAILED", detail: error.message },
        ])
      );
  }
};
