const mongoose = require("mongoose");

const getFormattedDate = (date) => {
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

  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  const fullDate = `${month} ${day}, ${year}`;
  return fullDate;
};

const supplySchema = new mongoose.Schema({
  products: Array,
  date: { type: String, default: getFormattedDate(new Date(Date.now())) },
  description:  String,
});

const Supply = mongoose.model("supply", supplySchema);

module.exports = Supply;
