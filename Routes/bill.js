const express = require("express");
const router = express.Router();
const xlsxPopulate = require("xlsx-populate");
const Sale = require("../Models/Sale");
const Product = require("../Models/Products");
const authMiddleware = require("../Middleware/authMiddleware");
const fs = require("fs");
const path = require("path");

const getValues = async (productsArr, rows, columns) => {
  try {
    const promises = await productsArr.map(async (product, index) => {
      // Defining values
      let { name, quantityCtn, quantityPcs, discount, tradeOffer, amount } =
        product;
      let singleProduct = await Product.findOne({ name });

      // If product is not found in products list then do this:
      if (!singleProduct) {
        return `The product ${name} is not available in products list`;
      }

      // Calculating rate of individual product
      let rate = singleProduct.sellingItemPrice;

      // Updating cells with new data

      // Writing a for loop for columns arr
      const cellNames = [];
      columns.forEach((colName) => {
        let rowName = rows[index];
        let cellName = `${colName}${rowName}`;

        let value;
        // Writing a switch case statement which defines the value according to the column name
        switch (colName) {
          case "B":
            value = name;
            break;
          case "F":
            value = quantityCtn;
            break;
          case "G":
            value = quantityPcs;
            break;
          case "H":
            value = rate;
            break;
          case "J":
            value = tradeOffer;
            break;
          case "L":
            value = discount;
            break;
          case "N":
            value = amount;
            break;
        }
        cellNames.push({ cellName, value });
      });

      return cellNames;
    });

    const resultArr = await Promise.all(promises);
    return resultArr;
  } catch (error) {
    console.error(error);
  }
};

const updateCells = async (resultArr, totalAmount, address, invoiceNo) => {
  try {
    const workbook = await xlsxPopulate.fromFileAsync(
      "./xlsxFiles/Bill/Bill.xlsx"
    );
    const worksheet = workbook.sheet(0);

    // Writing a forEach loop to update values
    // Result arr is like this:  [
    //   [
    //     { cellName: 'B15', value: 'CBSF' },
    //     { cellName: 'F15', value: 3 },
    //     { cellName: 'G15', value: 216 },
    //     { cellName: 'H15', value: 111.11 },
    //     { cellName: 'J15', value: 0 },
    //     { cellName: 'L15', value: 0 },
    //     { cellName: 'M15', value: 24000 }
    //   ],
    //   [
    //     { cellName: 'B16', value: 'pamper' },
    //     { cellName: 'F16', value: 4 },
    //     { cellName: 'G16', value: 328 },
    //     { cellName: 'H16', value: 1219.51 },
    //     { cellName: 'J16', value: 0 },
    //     { cellName: 'L16', value: 0 },
    //     { cellName: 'M16', value: 400000 }
    //   ]
    // ]

    resultArr.forEach((result) => {
      // Writing a for in loop to get cell data for each cell
      for (let i = 0; i < result.length; i++) {
        let cellData = result[i];
        const { cellName, value } = cellData;
        worksheet.cell(cellName).value(value);
      }
    });

    // Setting address and total Amount in excel file
    worksheet.cell("D7").value(address);
    worksheet.cell("M30").value(totalAmount);
    worksheet.cell("M4").value(invoiceNo);

    await workbook.toFileAsync("./xlsxFiles/Bill/updatedBill.xlsx");
  } catch (error) {
    console.error(error);
  }
};

// Creating bill for a particular sale
router.get("/getbill/:id", authMiddleware, async (req, res) => {
  try {
    let sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).send({ msg: "No sale found" });

    // Defining rows and columns to insert values in excel file
    let rows = [
      "12",
      "13",
      "14",
      "15",
      "16",
      "17",
      "18",
      "19",
      "20",
      "21",
      "22",
      "23",
      "24",
      "25",
      "26",
    ];
    let columns = ["B", "F", "G", "H", "J", "L", "N"];

    const resultArr = await getValues(sale.products, rows, columns);
    // Means if the function is returning an error message instead of result arr then do this:
    if (typeof resultArr[0] === "string") {
      return res.status(400).json({ msg: resultArr[0] });
    }

    await updateCells(
      resultArr,
      sale.totalAmount,
      sale.deliveredTo,
      sale.invoiceNo
    );

    const filePath = path.join(__dirname, "../xlsxFiles/Bill/updatedBill.xlsx");

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
