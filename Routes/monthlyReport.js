const express = require("express");
const router = express.Router();
const xlsxPopulate = require("xlsx-populate");
const authMiddleware = require("../Middleware/authMiddleware");
const path = require("path");
const Sale = require("../Models/Sale");
const Product = require("../Models/Products");
const moment = require("moment-timezone");

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const getValues = async (sales, daysInMonth, month, year) => {
  const valuesArr = [];
  const products = await Product.find({});
  for (let i = 1; i <= daysInMonth; i++) {
    const dateNow = new Date(
      `${months.indexOf(month) + 1}/${i}/${Number(year)}`
    );

    const timezone = "Asia/Karachi";
    const dateNowTz = moment.tz(dateNow, timezone).startOf("day").toDate();
    const salesOfDate = sales.filter((sale) => {
      const saleDateTz = moment.tz(sale.date, timezone).startOf("day").toDate();

      return dateNowTz.getTime() === saleDateTz.getTime();
    });
    if (salesOfDate.length === 0) {
      continue;
    }
    const salesAmount = Number(
      salesOfDate.reduce((acc, sale) => acc + sale.totalAmount, 0).toFixed(2)
    );
    let purchaseAmount = 0;

    let date = Number(dateNow.toString().split(" ")[2]);
    salesOfDate.map((sale) => {
      const productNames = sale.products.map((product) => product.name);

      productNames.forEach((productName) => {
        const foundProduct = products.find(
          (product) => product.name === productName
        );
        const singleProduct = sale.products.find(
          (product) => product.name === productName
        );
        if (!foundProduct) return;

        purchaseAmount += foundProduct.mrpItemPrice * singleProduct.quantityPcs;
      });
    });
    purchaseAmount = Number(purchaseAmount.toFixed(2));
    valuesArr.push({ date, salesAmount, purchaseAmount });
  }
  return valuesArr;
};

const getFormattedDate = (month, year) => {
  const daysInMonth = new Date(year, months.indexOf(month) + 1, 0).getDate();
  const startDate = `1-${months.indexOf(month) + 1}-${year}`;
  const endDate = `${daysInMonth}-${months.indexOf(month) + 1}-${year}`;
  return { startDate, endDate };
};

const updateValues = async (
  valuesArr,
  startRow,
  columnsArr,
  startDate,
  endDate
) => {
  try {
    const workbook = await xlsxPopulate.fromFileAsync(
      "./xlsxFiles/MonthlyReport/Monthly-Sales-Report.xlsx"
    );
    const worksheet = workbook.sheet(0);
    // Writing a forEach loop to update values
    // values arr is like this:  [
    //     [
    //   {
    //     "salesAmount": 0,
    //   "purchaseAmount": 0
    //   },
    //   {
    //     "salesAmount": 0,
    //   "purchaseAmount": 0
    //   }
    // ]
    valuesArr.forEach((values) => {
      let { date, salesAmount, purchaseAmount } = values;
      if (values.salesAmount === 0 && values.purchaseAmount === 0) {
        return;
      }
      for (const column of columnsArr) {
        let cellNumber = `${column}${startRow + date - 1}`;

        switch (column) {
          case "C":
            worksheet.cell(cellNumber).value(salesAmount);
            break;
          case "F":
            worksheet.cell(cellNumber).value(purchaseAmount);
            break;
          default:
            break;
        }
      }
    });

    worksheet.cell("B5").value(startDate);
    worksheet.cell("H5").value(endDate);

    await workbook.toFileAsync(
      "./xlsxFiles/MonthlyReport/updatedMonthly-Sales-Report.xlsx"
    );
  } catch (error) {
    console.error(error);
  }
};

router.post("/getmonthlyreport", authMiddleware, async (req, res) => {
  try {
    const { month, year } = req.body;

    if (!month || !year) {
      return res.status(400).json({ msg: "Please enter month and year" });
    }

    const monthIndex = months.indexOf(month) + 1;

    const daysInMonth = new Date(Number(year), monthIndex, 0).getDate();

    const timezone = "Asia/Karachi";
    const startMonth = moment
      .tz(new Date(`${year}/${month}/1`), timezone)
      .startOf("day")
      .toDate();
    const endMonth = moment
      .tz(new Date(`${year}/${month}/${daysInMonth}`), timezone)
      .endOf("day")
      .toDate();

    const sales = await Sale.find({
      date: {
        $gte: startMonth,
        $lte: endMonth,
      },
    });
    if (sales.length === 0) {
      return res.status(400).json({ msg: "No sales found" });
    }

    const valuesArr = await getValues(sales, daysInMonth, month, year);

    const { startDate, endDate } = getFormattedDate(month, year);

    const startRow = 11;
    const columns = ["C", "F"];
    await updateValues(valuesArr, startRow, columns, startDate, endDate);

    const filePath = path.join(
      __dirname,
      "../xlsxFiles/MonthlyReport/updatedMonthly-Sales-Report.xlsx"
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
