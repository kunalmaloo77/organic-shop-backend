import bcrypt from "bcrypt";

export const hashedPassword = async (plainPassword) => {
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(plainPassword, salt);
  return hashed;
};
