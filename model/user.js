import mongoose from "mongoose";
import { hashedPassword } from "../utils/util.js";
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  const user = this;

  if (this.isModified("password") || this.isNew) {
    try {
      const hashpass = await hashedPassword(user.password);
      user.password = hashpass;
    } catch (error) {
      return next(error);
    }
  }
  return next();
});

userSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();

  if (update.password) {
    const hashed = await hashedPassword(update.password);
    this.setUpdate({ ...update, password: hashed });
  }

  next();
});

export const userModel = mongoose.model("User", userSchema);
