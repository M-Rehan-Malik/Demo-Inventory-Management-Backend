const express = require("express");
const router = express.Router();
const xlsxPopulate = require("xlsx-populate");
const authMiddleware = require("../Middleware/authMiddleware");
const path = require("path");
const Sale = require("../Models/Sale");
const Product = require("../Models/Products");
const moment = require("moment-timezone");

const getValues = async (sales) => {
  const productsArr = [];
  const salesArr = [];

  for (const sale of sales) {
    // for worksheet 1
    await Promise.all(
      sale.products.map(async (product) => {
        let { name, quantityCtn, quantityPcs } = product;

        const singleProduct = await Product.findOne({ name });

        const presentProduct = productsArr.find(
          (presentProduct) => presentProduct.name === name
        );

        if (presentProduct) {
          presentProduct.quantityPcs += quantityPcs;

          presentProduct.quantityCtn = Math.floor(
            presentProduct.quantityPcs / singleProduct.piecesInCtn
          );
        } else {
          productsArr.push({
            name,
            quantityCtn,
            quantityPcs,
          });
        }
      })
    );
    // for worksheet 2
    salesArr.push({
      address: sale.deliveredTo,
      amount: sale.totalAmount,
    });
  }

  return { productsArr, salesArr };
};

const updateCells = async (
  productsArr,
  startRowProducts,
  columnsArrProducts,
  totalSales,
  salesArr,
  startRowSales,
  columnsArrSales
) => {
  try {
    const workbook = await xlsxPopulate.fromFileAsync(
      "./xlsxFiles/SalesReport/Daily-Sales-Report.xlsx"
    );
    const productsWorksheet = workbook.sheet(0);
    const salesWorksheet = workbook.sheet(1);

    // Writing a forEach loop to update values
    // Products arr is like this:  [
    //     [
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

    productsArr.forEach((product, index) => {
      let { name, quantityCtn, quantityPcs } = product;

      for (const column of columnsArrProducts) {
        let cellNumber = `${column}${startRowProducts}`;
        switch (column) {
          case "B":
            productsWorksheet.cell(cellNumber).value(index + 1);
            break;
          case "C":
            productsWorksheet.cell(cellNumber).value(name);
            break;
          case "H":
            productsWorksheet.cell(cellNumber).value(quantityCtn);
            break;
          case "J":
            productsWorksheet.cell(cellNumber).value(quantityPcs);
            break;

          default:
            break;
        }
      }

      productsWorksheet.cell("B7").value(`Total Bills: ${totalSales}`);

      startRowProducts += 1;
    });

    // Writing a forEach loop to update values
    // Products arr is like this:
    //     [ { address: 'Rehan general store', amount: 31816.5 } ]

    salesArr.forEach((sale, index) => {
      let { address, amount } = sale;

      for (const column of columnsArrSales) {
        let cellNumber = `${column}${startRowSales}`;
        switch (column) {
          case "B":
            salesWorksheet.cell(cellNumber).value(address);
            break;
          case "I":
            salesWorksheet.cell(cellNumber).value(amount);
            break;

          default:
            break;
        }
      }

      startRowSales += 1;
    });

    await workbook.toFileAsync(
      "./xlsxFiles/SalesReport/updatedDaily-Sales-Report.xlsx"
    );
  } catch (error) {
    console.error(error);
  }
};

router.post("/getsalesreport", authMiddleware, async (req, res) => {
  try {
    const { date } = req.body;

    // If no date send error msg
    if (!date) {
      return res.status(400).json({ msg: "Please enter date" });
    }

    const dateObj = new Date(date)

    const timezone = "Asia/Karachi"
    const startOfDay = moment.tz(dateObj, timezone).startOf("day").toDate();
    const endOfDay = moment.tz(dateObj, timezone).endOf("day").toDate();

    // Finding sales for a particular date
    const sales = await Sale.find({ date:{
      $gte: startOfDay,
      $lte: endOfDay
    } });

    const totalSales = sales.length;

    // If no sale found for a particular date send error msg
    if (totalSales === 0) {
      return res.status(400).json({ msg: "No sales found" });
    }

    // Defining start and end rows and columns to fill data in xlsx file
    const startRowProducts = 12;
    const columnsProducts = ["B", "C", "H", "J"];

    const startRowSales = 9;
    const columnsSales = ["B", "I"];

    const { productsArr, salesArr } = await getValues(sales);

    await updateCells(
      productsArr,
      startRowProducts,
      columnsProducts,
      totalSales,
      salesArr,
      startRowSales,
      columnsSales
    );

    const filePath = path.join(
      __dirname,
      "../xlsxFiles/SalesReport/updatedDaily-Sales-Report.xlsx"
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
