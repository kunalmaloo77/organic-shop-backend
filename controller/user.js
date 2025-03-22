import { userModel } from "../model/user.js";

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
    const userDoc = new userModel({
      id: Date.now().toString(),
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword,
    });
    const doc = await userDoc.save();

    req.logIn(doc, (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json(doc);
    });
  } catch (error) {
    if (error.code === 11000) {
      console.error("Duplicate key error->", error);
      res
        .status(409)
        .json({ error: "User Already Exists", message: error.message });
    } else {
      console.error(error);
      res.status(400).json(error);
    }
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
