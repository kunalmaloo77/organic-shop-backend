import passport from "passport";
import LocalStrategy from "passport-local";
import { userModel } from "./model/user.js";
import bcrypt from "bcrypt";

function initializePassport() {
  passport.use(
    new LocalStrategy(
      {
        usernameField: "loginEmail",
        passwordField: "loginPassword",
      },
      async (email, password, done) => {
        try {
          const user = await userModel.findOne({ email: email });
          if (!user) {
            return done(null, false, { message: "No user found" });
          }
          const isValidPassword = await bcrypt.compare(password, user.password);
          if (!isValidPassword) {
            return done(null, false, { message: "Incorrect password." });
          }
          return done(null, user);
        } catch (error) {
          console.error(error);
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, cb) => {
    try {
      process.nextTick(function () {
        cb(null, user._id);
      });
    } catch (err) {
      console.error("Error during serialization:", err);
      cb(err);
    }
  });

  passport.deserializeUser(async (id, cb) => {
    try {
      const user = await userModel.findById(id);
      if (!user) {
        console.error("User not found during serialization.");
        return cb(new Error("User not found"));
      }
      return cb(null, user);
    } catch (error) {
      console.error("Error during deserialization:", error);
      cb(error);
    }
  });
}

export default initializePassport;
