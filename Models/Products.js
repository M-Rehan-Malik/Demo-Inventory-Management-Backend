const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: String,
  piecesInCtn: Number,
  mrpCtnPrice: Number,
  sellingCtnPrice: Number,
  mrpItemPrice: Number,
  sellingItemPrice: Number,
  profitPerItem: Number,
  profitPerCtn: Number,
});

const Product = mongoose.model("products", productSchema);

module.exports = Product;
