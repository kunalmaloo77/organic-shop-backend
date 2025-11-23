import bcrypt from "bcrypt";
import client from "../redis_connect.js";
import jwt from "jsonwebtoken";

export const hashedPassword = async (plainPassword) => {
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(plainPassword, salt);
  return hashed;
};

export const generateRefreshToken = async (userId, role) => {
  const refreshToken = jwt.sign(
    { id: userId, role: role },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRY,
    }
  );

  try {
    storeRefreshToken(userId.toString(), refreshToken);
    return refreshToken;
  } catch (error) {
    console.log("Redis set error:", error);
  }
};

export const storeRefreshToken = async (userId, tokenId) => {
  await client.set(`refresh_token:${tokenId}`, userId, {
    EX: 7 * 24 * 60 * 60,
  }); // 7 days in seconds
  await client.sAdd(`user:${userId}:refresh_tokens`, tokenId);
  await client.expire(`user:${userId}:refresh_tokens`, 7 * 24 * 60 * 60);
};

export const deleteRefreshToken = async (tokenId) => {
  const userId = await client.get(`refresh_token:${tokenId}`);
  if (userId) {
    await client.del(`refresh_token:${tokenId}`);
    await client.sRem(`user:${userId}:refresh_tokens`, tokenId);
  }
};

export const revokeAllTokensOfUser = async (userId) => {
  const tokenIds = await client.sMembers(`user:${userId}:refresh_tokens`);
  if (tokenIds.length > 0) {
    const pipeline = client.multi();
    tokenIds.forEach((tokenId) => {
      pipeline.del(`refresh_token:${tokenId}`);
      pipeline.sRem(`user:${userId}:refresh_tokens`, tokenId);
    });
    await pipeline.exec();
  }
};
