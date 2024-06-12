const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema({
  products: Array,
  totalAmount: Number,
  deliveredTo: String,
  date: { type: Date, default: new Date(Date.now()) },
  invoiceNo: Number,
});

const Sale = mongoose.model("sales", saleSchema);

module.exports = Sale;
