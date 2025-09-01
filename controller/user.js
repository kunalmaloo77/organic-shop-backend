import { userModel } from "../model/user.js";
import jwt from "jsonwebtoken";

//Read all /users
export const getAllUsers = async (req, res) => {
  try {
    const users = await userModel.find();
    res.json(users);
  } catch (error) {
    console.error(error);
  }
};

//Read single GET /user/:id
export const getUser = async (req, res) => {
  const id = req.params.id;
  const user = await userModel.findOne({ id: id });
  res.json(user);
};

//Create POST /users
export const createUser = async (req, res) => {
  try {
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
      name: req.body.name,
      email,
      password,
    });
    const doc = await userDoc.save();

    const accessToken = jwt.sign({ id: doc._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.cookie("token", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const userResponse = doc.toObject();
    delete userResponse.password;

    res.status(201).json({ user: userResponse, msg: "User created" });
  } catch (error) {
    console.error(error);
    if (error && error.code === 11000) {
      return res.status(409).json({ error: "User already exists" });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Update PUT /users/:id
export const replaceUser = async (req, res) => {
  const id = req.params.id;
  try {
    const doc = await userModel.findOneAndReplace({ id: id }, req.body, {
      new: true,
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error(err);
    res.status(400).json(err);
  }
};

//Update PATCH /user/:id
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

//Delete DELETE /user/:id
export const deleteUser = async (req, res) => {
  try {
    const doc = await userModel.findOneAndDelete({ id: id });
    res.status(201).json(doc);
  } catch (err) {
    console.error(err);
    res.status(400).json(err);
  }
};
