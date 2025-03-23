import mongoose from "mongoose";
import { hashedPassword } from "../utils/hashedPassword.js";
const { Schema } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  id: { type: String, required: true },
  tokens: [
    {
      token: {
        type: String,
        required: true,
      },
    },
  ],
});

userSchema.pre("save", async function (next) {
  const user = this;

  if (this.isModified("password") || this.isNew) {
    try {
      const hashpass = await hashedPassword(user.password);
      user.password = hashpass;
    } catch (error) {
      return next(error);
    }
  } else {
    return next();
  }
});

export const userModel = mongoose.model("User", userSchema);
