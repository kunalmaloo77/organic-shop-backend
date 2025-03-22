import mongoose from "mongoose";
const { Schema } = mongoose;
import bcrypt from "bcrypt";

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  id: { type: String, required: true },
});

userSchema.pre("save", function (next) {
  const user = this;

  if (this.isModified("password") || this.isNew) {
    try {
      const salt = bcrypt.genSalt(10);
      const hashedPassword = bcrypt.hash(user.password, salt);
      user.password = hashedPassword;
    } catch (error) {
      return next(error);
    }
  } else {
    return next();
  }
});

export const userModel = mongoose.model("User", userSchema);
