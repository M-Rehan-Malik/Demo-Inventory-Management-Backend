const express = require("express");
const rateLimit = require("express-rate-limit");
require("dotenv").config();
const connectToDB = require("./db");
const cors = require("cors");

//Connecting to db
const mongooseURI = process.env.DB_CONNECTION_STRING;
connectToDB(mongooseURI);

//Starting app
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Rate limiter
let limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: "Too many login attempts. Please try again later",
});

// Error middleware for app
app.use((err, req, res, next) => {
  console.log(err.message);

  res.status(500).json({ msg: "Internal servor error" });
});

//Defining routes for app
app.use("/api/auth", limiter, require("./Routes/admin"));
app.use("/api/products", require("./Routes/products"));
app.use("/api/stock", require("./Routes/stock"));
app.use("/api/supply", require("./Routes/supply"));
app.use("/api/sale", require("./Routes/sale"));
app.use("/api/bill", require("./Routes/bill"));
app.use("/api/salesreport", require("./Routes/salesReport"));
app.use("/api/stockreport", require("./Routes/stockReport"));
app.use("/api/monthlyreport", require("./Routes/monthlyReport"));

app.listen(port, () => {
  console.log(`Example app listening on port 3000`);
});
