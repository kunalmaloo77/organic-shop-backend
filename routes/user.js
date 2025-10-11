import express from "express";
import * as userController from "../controller/user.js";

const userRouter = express.Router();

userRouter
  .post("/", userController.createUser)
  .get("/", userController.getAllUsers)
  .get("/:id", userController.getUser)
  .patch("/:id", userController.updateUser)
  .delete("/:id", userController.deleteUser);

export { userRouter };
