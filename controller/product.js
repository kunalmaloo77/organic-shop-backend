import { productModel } from "../model/product.js";
import { uploadImageToS3 } from "../utils/s3Service.js";

//Read all /products
export const getAllproducts = async (req, res) => {
  try {
    const products = await productModel.find();
    res.json(products);
  } catch (error) {
    console.error(error);
  }
};

//Read single GET /products/:id
export const getproduct = async (req, res) => {
  try {
    const id = req.params.id;
    const product = await productModel.findOne({ key: id });
    res.status(200).json(product);
  } catch (error) {
    console.error(error);
  }
};

//Create POST /products
export const createproduct = async (req, res) => {
  try {
    const files = req.files;
    const imageUrl = await uploadImageToS3(
      files[0],
      `/products/${files[0].originalname}`
    );
    const smallImageUrl = await uploadImageToS3(
      files[1],
      `/products+300+x+300/${files[1].originalname}`
    );

    const productDoc = new productModel({
      name: req.body.name,
      title: req.body.title,
      price: req.body.price,
      description: req.body.description,
      sale: req.body.sale,
      sale_price: req.body.sale_price,
      image_url: imageUrl,
      small_image_url: smallImageUrl,
    });
    const doc = await productDoc.save();
    res
      .status(201)
      .json({ message: "Product created successfully", product: doc });
  } catch (error) {
    if (error.code === 11000) {
      console.error("Duplicate key error->", error);
      res
        .status(409)
        .json({ error: "product Already Exists", message: error.message });
    } else {
      console.error(error);
      res.status(400).json(error);
    }
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
          key: { $ne: key },
          // TODO: in future use id not key
          // _id: { $ne: mongoose.Types.ObjectId(currentItemId) },
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
