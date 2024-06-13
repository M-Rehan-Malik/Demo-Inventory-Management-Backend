const express = require("express");
const router = express.Router();
const authMiddleware = require("../Middleware/authMiddleware");
const { body, validationResult } = require("express-validator");
const Sale = require("../Models/Sale");
const Product = require("../Models/Products");
const Stock = require("../Models/Stock");

const calculateAmount = async (products) => {
  try {
    // Writing for each loop to calculate the amount of each individual product
    // Map each product to a promise
    const promises = products.map(async (product) => {
      let singleProduct = await Product.findOne({ name: product.name });

      // Means if the user has deleted the product from products list and it is not available there so there will be no error
      if (!singleProduct) {
        return;
      }

      if (product.quantityInCtn) {
        product.quantityCtn = product.quantity;
        product.quantityPcs = product.quantityCtn * singleProduct.piecesInCtn;
        delete product.quantity;
      } else {
        product.quantityPcs = product.quantity;
        product.quantityCtn = 0;
        delete product.quantity;
      }
      // Calculate amount according to if quantity given is in cotton or not
      let rate = product.quantityInCtn
        ? singleProduct.sellingCtnPrice
        : singleProduct.sellingItemPrice;
      let discountExclusiveValue =
        (product.quantityInCtn ? product.quantityCtn : product.quantityPcs) *
        rate;
      let netValue =
        discountExclusiveValue -
        (product.discount * discountExclusiveValue) / 100 -
        product.tradeOffer;

      let amount = Number(netValue.toFixed(2));
      // Setting product's amount in sale for bill calculation
      product.amount = amount;
      return amount;
    });

    // Await all promises
    const amounts = await Promise.all(promises);

    return amounts;
  } catch (error) {
    console.error(error);
  }
};

// Route 1:
// POST Request
// Creating a new sale
router.post(
  "/addsale",
  authMiddleware,
  // Validation array
  [body("products", "No product Array given").isArray().notEmpty()],
  async (req, res) => {
    // Validation process
    const result = validationResult(req);
    if (!result.isEmpty()) {
      return res.status(400).json(result.errors[0]);
    }

    const { products, deliveredTo } = req.body;

    // Constructing a function to verify values
    const verifyValues = (products) => {
      let error = "";
      try {
        // Writing a for each loop for products array to confirm if values are number and the quantity of each product is equal to or less than the quantity present of that product in stock
        products.forEach((product) => {
          if (typeof product.quantity !== "number" || product.quantity <= 0) {
            return (error = "Quantity should be a number greater than 0");
          } else if (
            typeof product.discount !== "number" ||
            product.discount < 0
          ) {
            return (error =
              "Discount should be a number equal to or greater than 0");
          } else if (
            typeof product.tradeOffer !== "number" ||
            product.tradeOffer < 0
          ) {
            return (error =
              "T.O. should be a number equal to or greater than 0");
          }
        });
        return error;
      } catch (error) {
        console.error(error);
      }
    };

    // Verify values function
    let error = verifyValues(products);
    if (error.length !== 0) return res.status(400).json({ msg: error });

    // Checking the quantity in the database stock
    const checkQuantity = async (products) => {
      let quantityError = "";
      let promises = products.map(async (product) => {
        let stockQuantity = await Stock.findOne({ name: product.name });
        let singleProduct = await Product.findOne({ name: product.name });

        if (product.quantityInCtn) {
          if (
            product.quantity * singleProduct.piecesInCtn >
            stockQuantity.quantityPcs
          ) {
            return (quantityError = `The quantity of ${product.name} is not available in stock`);
          }
        } else {
          if (product.quantity > stockQuantity.quantityPcs) {
            return (quantityError = `The quantity of ${product.name} is not available in stock`);
          }
        }
      });
      quantityError = await Promise.all(promises);
      return quantityError;
    };

    let quantityCheck = await checkQuantity(products);
    if (quantityCheck.some((item) => typeof item === "string")) {
      return res
        .status(400)
        .json({ msg: quantityCheck.find((item) => typeof item === "string") });
    }

    let amountsArr = await calculateAmount(products);
    let totalAmount = amountsArr.reduce(
      (accumulator, currentValue) => accumulator + currentValue,
      0
    );

    try {
      let sales = await Sale.find({});

      let invoiceNo;
      // If the user is entering first sale
      if (sales.length===0) {
        invoiceNo = 1;
      } else {
        invoiceNo = sales[sales.length - 1].invoiceNo + 1;
      }
      // Save the sale to db

      await Sale.create({ products, totalAmount, deliveredTo, invoiceNo });

      // Update stocks with this new sale
      products.forEach(async (product) => {
        let { name, quantityPcs } = product;

        let singleProduct = await Product.findOne({ name });
        // Find a product in stock by its name and update its quantity
        let foundProduct = await Stock.findOne({ name });
        await Stock.updateOne(foundProduct, {
          quantityPcs: foundProduct.quantityPcs - quantityPcs,
          quantityCtn: Math.floor(
            (foundProduct.quantityPcs - quantityPcs) / singleProduct.piecesInCtn
          ),
        });
      });

      return res.status(200).json({ msg: "Successfully added new sale" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ msg: "Internal Server Error" });
    }
  }
);

// Route 2:
// GET Request
// Getting all sales
router.get("/getsales", authMiddleware, async (req, res) => {
  try {
    let sales = await Sale.find({});
    // Reversing so sorted array of sales is rendered
    sales.reverse();
    return res.status(200).json(sales);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Internal Server Error" });
  }
});

// Route 3:
// PUT Request
// Updating an existing sale
router.put(
  "/updatesale/:id",
  authMiddleware,
  // Validation array
  [body("products", "No product Array given").isArray().notEmpty()],
  async (req, res) => {
    // Validation process
    const result = validationResult(req);
    if (!result.isEmpty()) {
      return res.status(400).json(result.errors[0]);
    }

    const { products, deliveredTo } = req.body;

    // Constructing a function to verify values
    const verifyValues = (products) => {
      let error = "";
      try {
        // Writing a for each loop for products array to confirm if values are number and the quantity of each product is equal to or less than the quantity present of that product in stock
        products.forEach((product) => {
          if (typeof product.quantity !== "number" || product.quantity < 0) {
            return (error =
              "Quantity should be a number greater than or equal to 0");
          } else if (
            typeof product.discount !== "number" ||
            product.discount < 0
          ) {
            return (error =
              "Discount should be a number equal to or greater than 0");
          } else if (
            typeof product.tradeOffer !== "number" ||
            product.tradeOffer < 0
          ) {
            return (error =
              "T.O. should be a number equal to or greater than 0");
          }
        });
        return error;
      } catch (error) {
        console.error(error);
      }
    };

    // Verify values function
    let error = await verifyValues(products);
    if (error.length !== 0) return res.status(400).json({ msg: error[0] });

    const checkQuantity = async (products) => {
      let oldSale = await Sale.findById(req.params.id);
      let quantityError = "";
      let promises = products.map(async (product) => {
        let oldSaleProduct = oldSale.products.find(
          (item) => item.name === product.name
        );
        let singleProduct = await Product.findOne({ name: product.name });

        // Means if the user has deleted the product from products list and it is not available there so there will be no error
        if (!singleProduct) {
          return;
        }
        let stockQuantity = await Stock.findOne({ name: product.name });

        if (product.quantityInCtn) {
          if (
            product.quantity * singleProduct.piecesInCtn -
              oldSaleProduct.quantityPcs >
            stockQuantity.quantityPcs
          ) {
            return (quantityError = `The quantity of ${product.name} is not available in stock`);
          }
        } else {
          if (
            product.quantity - oldSaleProduct.quantityPcs >
            stockQuantity.quantityPcs
          ) {
            return (quantityError = `The quantity of ${product.name} is not available in stock`);
          }
        }
      });
      quantityError = await Promise.all(promises);
      return quantityError;
    };

    let quantityCheck = await checkQuantity(products);
    if (quantityCheck.some((item) => typeof item === "string")) {
      return res
        .status(400)
        .json({ msg: quantityCheck.find((item) => typeof item === "string") });
    }

    let amountsArr = await calculateAmount(products);
    let totalAmount = amountsArr.reduce(
      (accumulator, currentValue) => accumulator + currentValue,
      0
    );

    try {
      // Update the sale to db

      let updatedSale = { products, totalAmount, deliveredTo };
      let oldSale = await Sale.findById(req.params.id);
      await Sale.updateOne(oldSale, { $set: updatedSale });

      // Update stocks with this new sale
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
            foundProduct.quantityPcs -
            quantityPcs +
            oldSale.products[index].quantityPcs,
          quantityCtn: Math.floor(
            (foundProduct.quantityPcs -
              quantityPcs +
              oldSale.products[index].quantityPcs) /
              singleProduct.piecesInCtn
          ),
        });
      });

      return res.status(200).json({ msg: "Successfully updated the sale" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ msg: "Internal Server Error" });
    }
  }
);

// Route: 4
// DELETE Request
// Deleting a sale
router.delete("/deletesale/:id", authMiddleware, async (req, res) => {
  try {
    let sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ msg: "No sale found" });
    }

    await Sale.deleteOne(sale);

    // Update stock because of deletion of sale
    sale.products.map(async (item) => {
      let { name, quantityPcs } = item;

      let singleProduct = await Product.findOne({ name });
      // Means if the user has deleted the product from products list and it is not available there so there will be no error
      if (!singleProduct) {
        return;
      }
      // First find stock item and then update its quantity by removing the quantity of supply
      let stock = await Stock.findOne({ name });
      await Stock.updateOne(stock, {
        quantityPcs: stock.quantityPcs + quantityPcs,
        quantityCtn: Math.floor(
          (stock.quantityPcs + quantityPcs) / singleProduct.piecesInCtn
        ),
      });
    });

    return res.status(200).json({ msg: "Succesfully deleted sale" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Internal Server Error" });
  }
});

module.exports = router;
