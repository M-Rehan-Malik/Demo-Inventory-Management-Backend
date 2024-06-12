const express = require("express");
const router = express.Router();
const authMiddleware = require("../Middleware/authMiddleware");
const { body, validationResult } = require("express-validator");
const Supply = require("../Models/Supply");
const Stock = require("../Models/Stock");
const Product = require("../Models/Products");

// Route 1:
// POST Request
// Creating a new supply which came
router.post(
  "/addsupply",
  authMiddleware,
  // Validation array
  [body("products", "No product Array given").isArray().notEmpty()],
  async (req, res) => {
    // Validation process
    const result = validationResult(req);
    if (!result.isEmpty()) {
      return res.status(400).json(result.errors[0]);
    }

    const { products, description } = req.body;

    const verifyValues = async (products) => {
      let error = "";
      // Writing a for each loop for products array to confirm if quantity is a number
      const promises = products.map(async (product) => {
        if (typeof product.quantity !== "number" || product.quantity <= 0) {
          return (error = "Quantity should be a number greater than 0");
        }
        let singleProduct = await Product.findOne({ name: product.name });
        // Means if the user has deleted the product from products list and it is not available there so there will be no error
        if (!singleProduct) {
          return;
        }

        if (product.quantityInCtn) {
          product.quantityPcs = product.quantity * singleProduct.piecesInCtn;
          product.quantityCtn = product.quantity;
        } else {
          product.quantityPcs = product.quantity;
          product.quantityCtn = Math.floor(
            product.quantityPcs / singleProduct.piecesInCtn
          );
        }
        delete product.quantity;
      });
      await Promise.all(promises);
      return error;
    };

    // Verify values function
    let error = await verifyValues(products);
    if (error.length !== 0) return res.status(400).json({ msg: error });

    try {
      // Save the supply to db
      await Supply.create({ products, description });
      // Update stocks with this new supply
      // Map each product to a promise
      const promises = products.map(async (product) => {
        let { name, quantityPcs } = product;

        let singleProduct = await Product.findOne({ name });
        // Find a product in stock by its name and update its quantity
        let foundProduct = await Stock.findOne({ name });
        await Stock.updateOne(foundProduct, {
          quantityPcs: foundProduct.quantityPcs + quantityPcs,
          quantityCtn: Math.floor(
            (foundProduct.quantityPcs + quantityPcs) / singleProduct.piecesInCtn
          ),
        });
      });

      await Promise.all(promises);

      return res.status(200).json({ msg: "Successfully added new supply" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ msg: "Internal Server Error" });
    }
  }
);

// Route 2:
// GET Request
// Getting all the supplies and their details
router.get("/getsupplies", authMiddleware, async (req, res) => {
  try {
    let supplies = await Supply.find({});
    // Reversing so sorted array is returned
    supplies.reverse();
    return res.status(200).json(supplies);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Internal Server Error" });
  }
});

// Route 3:
// PUT Request
// Updating a supply
router.put(
  "/updatesupply/:id",
  authMiddleware,
  // Validation array
  [body("products", "No product Array given").isArray().notEmpty()],
  async (req, res) => {
    // Validation process
    const result = validationResult(req);
    if (!result.isEmpty()) {
      return res.status(400).json(result.errors[0]);
    }

    const { products, description } = req.body;

    const verifyValues = async (products) => {
      let error = "";
      // Writing a for each loop for products array to confirm if quantity is a number
      const promises = products.map(async (product) => {
        if (typeof product.quantity !== "number" || product.quantity < 0) {
          return (error =
            "Quantity should be a number greater than or equal to 0");
        }
        let singleProduct = await Product.findOne({ name: product.name });
        // Means if the user has deleted the product from products list and it is not available there so there will be no error
        if (!singleProduct) {
          return;
        }
        if (product.quantityInCtn) {
          product.quantityPcs = product.quantity * singleProduct.piecesInCtn;
          product.quantityCtn = product.quantity;
        } else {
          product.quantityPcs = product.quantity;
          product.quantityCtn = Math.floor(
            product.quantityPcs / singleProduct.piecesInCtn
          );
        }
        delete product.quantity;
      });
      await Promise.all(promises);
      return error;
    };

    // Verify values function
    let error = await verifyValues(products);
    if (error.length !== 0) return res.status(400).json({ msg: error });

    try {
      // Update the supply to db
      let updatedSupply = { products, description };
      let oldSupply = await Supply.findById(req.params.id);
      // If there is no such supply in db
      if (!oldSupply) {
        return res.status(404).json({ msg: "No supply found" });
      }

      await Supply.updateOne(oldSupply, { $set: updatedSupply });
      // Update stocks according to updated supply
      products.forEach(async (product, index) => {
        let { name, quantityPcs } = product;

        let singleProduct = await Product.findOne({ name });

        // Means if the user has deleted the product from products list and it is not available there so there will be no error
        if (!singleProduct) {
          return;
        }
        // Find a product in stock by its name and update its quantity
        let foundProduct = await Stock.findOne({ name });
        await Stock.updateOne(foundProduct, {
          quantityPcs:
            foundProduct.quantityPcs +
            quantityPcs -
            oldSupply.products[index].quantityPcs,
          quantityCtn: Math.floor(
            (foundProduct.quantityPcs +
              quantityPcs -
              oldSupply.products[index].quantityPcs) /
              singleProduct.piecesInCtn
          ),
        });
      });

      return res.status(200).json({ msg: "Successfully updated supply" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ msg: "Internal Server Error" });
    }
  }
);

// Route 4:
// DELETE Request
// Deleting a supply
router.delete("/deletesupply/:id", authMiddleware, async (req, res) => {
  try {
    let supply = await Supply.findById(req.params.id);
    if (!supply) {
      return res.status(404).json({ msg: "No supply found" });
    }

    await Supply.deleteOne(supply);

    // Update stock because of deletion of supply
    supply.products.map(async (item) => {
      let { name, quantityPcs } = item;

      let singleProduct = await Product.findOne({ name });

      // Means if the user has deleted the product from products list and it is not available there so there will be no error
      if (!singleProduct) {
        return;
      }
      // First find stock item and then update its quantity by removing the quantity of supply
      let stock = await Stock.findOne({ name });
      await Stock.updateOne(stock, {
        quantityPcs: stock.quantityPcs - quantityPcs,
        quantityCtn: Math.floor(
          (stock.quantityPcs - quantityPcs) / singleProduct.piecesInCtn
        ),
      });
    });

    return res.status(200).json({ msg: "Succesfully deleted supply" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Internal Server Error" });
  }
});

module.exports = router;
