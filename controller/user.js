import { userModel } from "../model/user.js";
import jwt from "jsonwebtoken";
import { generateRefreshToken } from "../utils/util.js";

//GET: /users
export const getAllUsers = async (req, res) => {
  try {
    const users = await userModel.find();
    res.json(users);
  } catch (error) {
    console.error(error);
  }
};

//GET: /user/:id
export const getUser = async (req, res) => {
  const id = req.params.id;
  const user = await userModel.findOne({ id: id });
  res.json(user);
};

//POST: /users
export const createUser = async (req, res) => {
  try {
    const name = req.body.name && String(req.body.name).trim();
    const email = req.body.email && String(req.body.email).toLowerCase().trim();
    const password = req.body.password && String(req.body.password).trim();
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const existing = await userModel.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "User Already Exists" });
    }

    const userDoc = new userModel({
      name,
      email,
      password,
    });
    const doc = await userDoc.save();

    const accessToken = jwt.sign(
      { id: doc._id },
      process.env.JWT_ACCESS_SECRET,
      {
        expiresIn: process.env.JWT_ACCESS_EXPIRY,
      }
    );
    const refreshToken = await generateRefreshToken(doc._id);

    const userResponse = doc.toObject();
    delete userResponse.password;
    userResponse.accessToken = accessToken;

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({ user: userResponse });
  } catch (error) {
    console.error(error);
    if (error && error.code === 11000) {
      return res.status(409).json({ error: "User already exists" });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
};

//PATCH /user/:id
export const updateUser = async (req, res) => {
  const id = req.params.id;
  try {
    const doc = await userModel.findOneAndUpdate({ id: id }, req.body, {
      new: true,
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error(err);
    res.status(400).json(err);
  }
};

//DELETE /user/:id
export const deleteUser = async (req, res) => {
  try {
    const doc = await userModel.findOneAndDelete({ id: id });
    res.status(201).json(doc);
  } catch (err) {
    console.error(err);
    res.status(400).json(err);
  }
};
