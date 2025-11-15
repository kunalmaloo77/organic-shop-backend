import { productModel } from "../model/product.js";
import { getS3ImageUrl } from "../utils/s3Service.js";
import mongoose from "mongoose";

const resolveAndCacheSignedUrl = async (
  doc,
  pathField,
  urlField,
  expiryField,
  expiresInSeconds = 15 * 60
) => {
  const productObj = doc.toObject ? doc.toObject() : doc;

  // If there's no image path, return null url
  if (!productObj[pathField]) {
    return { ...productObj, [urlField]: null };
  }

  // If cached url exists and hasn't expired, reuse it
  if (productObj[urlField] && productObj[expiryField]) {
    const expiresAt = new Date(productObj[expiryField]);
    const now = new Date();
    if (expiresAt > now) {
      return { ...productObj, [urlField]: productObj[urlField] };
    }
  }

  // Generate new signed URL and persist best-effort
  try {
    const imageUrl = await getS3ImageUrl(
      productObj[pathField],
      expiresInSeconds
    );

    // Best-effort update of cached URL and expiry
    try {
      await productModel
        .findByIdAndUpdate(productObj._id, {
          [urlField]: imageUrl,
          [expiryField]: new Date(Date.now() + expiresInSeconds * 1000),
        })
        .exec();
    } catch (updateErr) {
      console.error(
        `Failed to update cached URL for product ${productObj._id}:`,
        updateErr
      );
    }
    return { ...productObj, [urlField]: imageUrl };
  } catch (error) {
    console.error(
      `Failed to get s3 url for product ${productObj._id}: `,
      error
    );
    return { ...productObj, [urlField]: null };
  }
};

//Read all /products
export const getAllproducts = async (req, res) => {
  try {
    const products = await productModel.find();
    const productsWithUrls = await Promise.all(
      products.map(async (p) => {
        // Use shared helper to resolve and cache signed URL for small image
        return await resolveAndCacheSignedUrl(
          p,
          "small_image_path",
          "small_image_url",
          "small_image_url_expires_at"
        );
      })
    );
    res.json(productsWithUrls);
  } catch (error) {
    console.error(error);
  }
};

//Read single GET /products/:id
export const getproduct = async (req, res) => {
  try {
    const id = req.params.id;
    const product = await productModel.findById(id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    const productWithUrls = await resolveAndCacheSignedUrl(
      product,
      "image_path",
      "image_url",
      "image_url_expires_at",
      5 * 60 // 5 minutes expiry for main image
    );
    res.status(200).json(productWithUrls);
  } catch (error) {
    console.error(error);
  }
};

//Get related products GET /products/get-related-products
export const getRelatedProducts = async (req, res) => {
  const { title, key } = req.query;

  try {
    const randomProducts = await productModel.aggregate([
      {
        $match: {
          title: title,
          _id: { $ne: new mongoose.Types.ObjectId(String(key)) },
        },
      },
      { $sample: { size: 3 } },
    ]);
    res.status(200).json({ success: true, products: randomProducts });
  } catch (error) {
    console.error("Error fetching random products:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching random products" });
  }
};
