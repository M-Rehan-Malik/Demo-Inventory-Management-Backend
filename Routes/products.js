const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const authMiddleware = require("../Middleware/authMiddleware");
const Products = require("../Models/Products");
const Stock = require("../Models/Stock");
const Sale = require("../Models/Sale");

// Route 1:
// POST request
// Adding a new product in the products list
router.post(
  "/addproduct",
  authMiddleware,
  // Validation array
  [
    body("name", "Name must be atleast three characters long")
      .trim()
      .isLength({ min: 3 }),
    body(
      "piecesInCtn",
      "The amount of pieces should be greater than 0"
    ).isFloat({ min: 1 }),
    body("mrpCtnPrice", "MRP Price should be a number greater than 0").isFloat({
      min: 1,
    }),
    body(
      "sellingCtnPrice",
      "Selling Price should be a number greater than 0"
    ).isFloat({
      min: 1,
    }),
  ],
  async (req, res) => {
    // Validation process
    const result = validationResult(req);
    if (!result.isEmpty()) {
      return res.status(400).json(result.errors[0]);
    }

    const { name, piecesInCtn, mrpCtnPrice, sellingCtnPrice } = req.body;
    if (sellingCtnPrice <= mrpCtnPrice) {
      return res
        .status(400)
        .json({ msg: "Selling price should be greater than MRP price." });
    }

    const mrpItemPrice = Number((mrpCtnPrice / piecesInCtn).toFixed(2));
    const sellingItemPrice = Number((sellingCtnPrice / piecesInCtn).toFixed(2));

    const profitPerCtn = Number((sellingCtnPrice - mrpCtnPrice).toFixed(2));
    const profitPerItem = Number((sellingItemPrice - mrpItemPrice).toFixed(2));
    try {
      // If a product already exists with the given name
      let productExists = await Products.findOne({ name });
      if (productExists) {
        return res
          .status(400)
          .json({ msg: "A product already exists with that name" });
      }
      await Products.create({
        name,
        piecesInCtn,
        mrpCtnPrice,
        sellingCtnPrice,
        mrpItemPrice,
        sellingItemPrice,
        profitPerItem,
        profitPerCtn,
      });

      // After saving the product in the products list save it in stocks collection
      await Stock.create({ name, quantityPcs: 0, quantityCtn: 0 });

      return res.status(200).json({ msg: "Successfully added new product" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ msg: "Internal Server Error" });
    }
  }
);

// Route 2:
// GET request
// Getting all the products in the products list
router.get("/getproducts", authMiddleware, async (req, res) => {
  try {
    let productsArr = await Products.find({});
    return res.status(200).json(productsArr);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Internal Server Error" });
  }
});

// Route 3:
// PUT request
// Updating a product in the products list
router.put(
  "/updateproduct/:id",
  authMiddleware,
  // Validation array
  [
    body("name", "Name must be atleast three characters long")
      .trim()
      .isLength({ min: 3 }),
    body(
      "piecesInCtn",
      "The amount of pieces should be greater than 0"
    ).isFloat({ min: 1 }),
    body("mrpCtnPrice", "MRP Price should be a number greater than 0").isFloat({
      min: 1,
    }),
    body(
      "sellingCtnPrice",
      "Selling Price should be a number greater than 0"
    ).isFloat({
      min: 1,
    }),
  ],
  async (req, res) => {
    // Validation process
    const result = validationResult(req);
    if (!result.isEmpty()) {
      return res.status(400).json(result.errors[0]);
    }

    const { name, piecesInCtn, mrpCtnPrice, sellingCtnPrice } = req.body;
    if (sellingCtnPrice <= mrpCtnPrice) {
      return res
        .status(400)
        .json({ msg: "Selling price should be greater than MRP price." });
    }

    const mrpItemPrice = Number((mrpCtnPrice / piecesInCtn).toFixed(2));
    const sellingItemPrice = Number((sellingCtnPrice / piecesInCtn).toFixed(2));

    const profitPerCtn = Number((sellingCtnPrice - mrpCtnPrice).toFixed(2));
    const profitPerItem = Number((sellingItemPrice - mrpItemPrice).toFixed(2));

    try {
      let product = await Products.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ msg: "Product not found" });
      }

      let updatedProduct = {
        name,
        piecesInCtn,
        mrpCtnPrice,
        sellingCtnPrice,
        mrpItemPrice,
        sellingItemPrice,
        profitPerItem,
        profitPerCtn,
      };
      await Products.findByIdAndUpdate(req.params.id, { $set: updatedProduct });

      if (product.name !== name) {
        // Updating the name of product in stocks
        await Stock.updateOne(
          {
            name: product.name, // which is old name of product
          },
          { name }
        );
        const sales = await Sale.find({});
        await Promise.all(
          sales.map(async (sale) => {
            let { _id } = sale;
            if (
              sale.products.find(
                (saleProduct) => saleProduct.name === product.name
              )
            ) {
              const updatedProducts = [...sale.products];
              updatedProducts.forEach((saleProduct) => {
                if (saleProduct.name === product.name) {
                  saleProduct.name = name;
                }
                return saleProduct;
              });
              await Sale.findByIdAndUpdate(
                { _id },
                {
                  products: updatedProducts,
                }
              );
            }
          })
        );
      }

      return res.status(200).json({ msg: "Successfully updated the product" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ msg: "Internal Server Error" });
    }
  }
);

// Route 4:
// DELETE request
// Deleting a product in the products list
router.delete("/deleteproduct/:id", authMiddleware, async (req, res) => {
  try {
    let product = await Products.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ msg: "Product not found" });
    }

    await Products.deleteOne(product);

    // Deleting product also from stocks
    await Stock.findOneAndDelete({ name: product.name });

    return res.status(200).json({ msg: "Successfully deleted the product" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Internal Server Error" });
  }
});

module.exports = router;
