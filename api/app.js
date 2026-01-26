import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import { adminRouter } from "../routes/admin.js";
import { authRouter } from "../routes/auth.js";
import { orderRouter } from "../routes/order.js";
import "dotenv/config";
import morgan from "morgan";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import Razorpay from "razorpay";
import { productRouter } from "../routes/product.js";
import client from "../redis_connect.js";

export const instance = new Razorpay({
  key_id: process.env.RAZOR_PAY_API_KEY,
  key_secret: process.env.RAZOR_PAY_API_SECRET,
});

main().catch((error) => {
  console.error("Promise error ->", error);
});

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Database connection error ->", error);
  }
}

const server = express();

server.use(bodyParser.json());

server.use(bodyParser.urlencoded({ extended: true }));

server.use(morgan("dev"));

const corsOptions = {
  origin: process.env.FRONTEND_ENDPOINT,
  credentials: true,
};

server.use(cors(corsOptions));

// Ensure preflight requests are handled
server.options("*", cors(corsOptions));

server.set("trust proxy", 1);

server.use(cookieParser());

// Health check endpoint for Docker
server.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

server.use("/admin", adminRouter);

server.use("/auth", authRouter);

server.use("/orders", orderRouter);

server.use("/products", productRouter);

const httpServer = server.listen(process.env.PORT, () => {
  console.log(`server started on port ${process.env.PORT}`);
});

async function shutdown(signal) {
  console.log(`Received ${signal}, closing server...`);
  try {
    if (httpServer && typeof httpServer.close === "function") {
      await new Promise((resolve, reject) => {
        httpServer.close((err) => (err ? reject(err) : resolve()));
      });
      console.log("HTTP server closed");
    }
    await client.quit().catch((e) => console.error("Redis quit error:", e));
    await mongoose.disconnect();
    console.log("Disconnected from Redis and MongoDB, exiting.");
    process.exit(0);
  } catch (err) {
    console.error("Shutdown error:", err);
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
