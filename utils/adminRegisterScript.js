import { userModel } from "../model/user.js";
import mongoose from "mongoose";
import "dotenv/config";

export const adminRegisterScript = async () => {
  // register admin user into mongodb if not already present
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const email = "admin@123";
    const adminUser = await userModel.findOne({
      email,
    });
    if (adminUser) {
      console.log("Admin user already present");
      return;
    }
    const newAdminUser = new userModel({
      name: "Admin User",
      email,
      password: "123123",
      role: "admin",
      provider: "local",
    });
    await newAdminUser.save();
    console.log(
      "Admin user created with email: admin@123 and password: 123123"
    );
  } catch (error) {
    console.error("Error creating admin user:", error);
  } finally {
    mongoose.disconnect();
  }
};

adminRegisterScript();
