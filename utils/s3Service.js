import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const region = process.env.AWS_REGION;

const s3Client = new S3Client({
  region: region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export const getSmallImageUploadUrl = async (filename, ContentType) => {
  const command = new PutObjectCommand({
    Bucket: "organic-store-bucket",
    Key: `public/products/small_size/${filename}`,
    Body: file.buffer,
    ContentType: ContentType,
  });
  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  return url;
};

export const getLargeImageUploadUrl = async (filename, ContentType) => {
  const command = new PutObjectCommand({
    Bucket: "organic-store-bucket",
    Key: `public/products/large_size/${filename}`,
    ContentType: ContentType,
  });
  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  return url;
};

export const getS3ImageUrl = async (key, expiresIn = 900) => {
  const command = new GetObjectCommand({
    Bucket: "organic-store-bucket",
    Key: key,
  });
  const url = await getSignedUrl(s3Client, command, { expiresIn: expiresIn });
  return url;
};
