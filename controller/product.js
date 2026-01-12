import { productModel } from "../model/product.js";
// import { uploadImageToS3 } from "../utils/s3Service.js";
import { successResponse, errorResponse } from "../utils/response.js";
import mongoose from "mongoose";
import { getS3ImageUrl } from "../utils/s3Service.js";

/**
 * Resolve (and optionally cache) a signed S3 URL for a product image field.
 * - doc: a plain object or mongoose document
 * - pathField: the field name that holds the S3 key/path (e.g. 'image_path' or 'small_image_path')
 * - urlField: the field name to return/cache for signed url (e.g. 'image_url' or 'small_image_url')
 * - expiryField: the field name to store expiry timestamp (e.g. 'image_url_expires_at')
 * Returns a new object based on doc with the urlField set to a signed URL or null.
 */
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
    const { search, min_price, max_price, page, category } = req.query;
    const min = min_price ? Number(min_price) : 0;
    const max = max_price ? Number(max_price) : Number.MAX_SAFE_INTEGER;

    const products = await productModel
      .find({
        name: { $regex: search || "", $options: "i" },
        price: { $gte: min, $lte: max },
        title: ["grocery", "juice"].includes(category)
          ? category
          : { $exists: true },
      })
      .skip(page ? (Number(page) - 1) * 9 : 0)
      .limit(9)
      .lean();

    const total = await productModel.countDocuments({
      title: { $regex: search || "", $options: "i" },
      price: { $gte: min, $lte: max },
    });

    const totalPages = Math.ceil(total / 9);

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
    res.json(
      successResponse("Products fetched successfully", {
        products: productsWithUrls,
        totalPages: Math.max(totalPages, 1),
      })
    );
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json(
        errorResponse("Failed to fetch products", [
          { code: "INTERNAL_ERROR", detail: error.message },
        ])
      );
  }
};

//GET /products/:id
export const getProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const product = await productModel.findById(id);
    if (!product) {
      return res.status(404).json(
        errorResponse("Product not found", [
          {
            code: "PRODUCT_NOT_FOUND",
            field: "id",
            detail: `No product found with id ${id}`,
          },
        ])
      );
    }

    const productWithUrl = await Promise.resolve(product).then(async (prod) => {
      // Use shared helper to resolve and cache signed URL for main image
      return await resolveAndCacheSignedUrl(
        prod,
        "image_path",
        "image_url",
        "image_url_expires_at"
      );
    });
    res
      .status(200)
      .json(successResponse("Product fetched successfully", productWithUrl));
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json(
        errorResponse("Failed to fetch product", [
          { code: "INTERNAL_ERROR", detail: error.message },
        ])
      );
  }
};

//Get related products GET /products/get-related-products
export const getRelatedProducts = async (req, res) => {
  const { title, id } = req.query;

  try {
    const randomProducts = await productModel.aggregate([
      {
        $match: {
          title: title,
          _id: { $ne: new mongoose.Types.ObjectId(String(id)) },
        },
      },
      { $sample: { size: 3 } },
    ]);

    const randomProductsWithUrl = await Promise.all(
      randomProducts.map(async (p) => {
        return await resolveAndCacheSignedUrl(
          p,
          "small_image_path",
          "small_image_url",
          "small_image_url_expires_at"
        );
      })
    );

    res.status(200).json(
      successResponse("Related products fetched successfully", {
        products: randomProductsWithUrl,
      })
    );
  } catch (error) {
    console.error("Error fetching random products:", error);
    res
      .status(500)
      .json(
        errorResponse("Error fetching random products", [
          { code: "INTERNAL_ERROR", detail: error.message },
        ])
      );
  }
};
