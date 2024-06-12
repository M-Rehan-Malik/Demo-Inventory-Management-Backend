const express = require("express");
const router = express.Router();
const Stock = require("../Models/Stock");
const authMiddleware = require("../Middleware/authMiddleware");

// Route:1
// GET Request
// Getting stock from database
router.get("/", authMiddleware, async (req, res) => {
  try {
    let stock = await Stock.find({});
    return res.status(200).json(stock);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Internal Server Error" });
  }
});

module.exports = router;
