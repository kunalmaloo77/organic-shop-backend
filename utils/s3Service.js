//TODO: ensure user can upload images to s3 by changing policies
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION;

const s3Client = new S3Client({ region: region });

export const uploadImageToS3 = async (file, key) => {
  const params = {
    Bucket: "organic-store-bucket",
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  const command = new PutObjectCommand(params);
  await s3Client.send(command);

  // Return the public URL of the uploaded object
  return `${process.env.AWS_S3_URL}/${key}`;
};
