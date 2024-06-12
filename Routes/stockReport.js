const express = require("express");
const router = express.Router();
const xlsxPopulate = require("xlsx-populate");
const authMiddleware = require("../Middleware/authMiddleware");
const path = require("path");
const Product = require("../Models/Products");

const updateCells = async (productsArr, startRow, columnsArr) => {
  try {
    const workbook = await xlsxPopulate.fromFileAsync(
      "./xlsxFiles/StockReport/stock-report.xlsx"
    );
    const worksheet = workbook.sheet(0);

    // Writing a forEach loop to update values
    // Products arr is like this:  [
    //   {
    //     "name": "CBSF",
    //     "quantityCtn": 1,
    //     "quantityPcs": 80
    //   },
    //   {
    //     "name": "CBSL",
    //     "quantityCtn": 10,
    //     "quantityPcs": 780
    //   }
    // ]

    for (const product of productsArr) {
      let { name, quantityCtn, quantityPcs } = product;

      let singleProduct = await Product.findOne({ name });
      let rate = singleProduct.mrpItemPrice;

      let amount = quantityPcs * rate;

      for (const column of columnsArr) {
        let cellNumber = `${column}${startRow}`;

        switch (column) {
          case "B":
            worksheet.cell(cellNumber).value(name);
            break;
          case "I":
            worksheet.cell(cellNumber).value(rate);
            break;
          case "K":
            worksheet.cell(cellNumber).value(quantityCtn);
            break;
          case "N":
            worksheet.cell(cellNumber).value(quantityPcs);
            break;
          case "Q":
            worksheet.cell(cellNumber).value(amount);
            break;

          default:
            break;
        }
      }
      startRow += 1;
    }

    await workbook.toFileAsync(
      "./xlsxFiles/StockReport/updatedStock-report.xlsx"
    );
  } catch (error) {
    console.error(error);
  }
};

router.post("/getstockreport", authMiddleware, async (req, res) => {
  try {
    const productsArr = req.body;

    // If no products send error msg
    if (!productsArr) {
      return res.status(400).json({ msg: "Please enter products" });
    }

    const startRow = 8;

    const columns = ["B", "I", "K", "N", "Q"];

    await updateCells(productsArr, startRow, columns);

    const filePath = path.join(
      __dirname,
      "../xlsxFiles/StockReport/updatedStock-report.xlsx"
    );

    res.sendFile(filePath, (err) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ msg: "Error in sending file" });
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Internal Server Error" });
  }
});

module.exports = router;
