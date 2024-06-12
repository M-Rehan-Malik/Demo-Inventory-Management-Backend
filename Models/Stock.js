const mongoose = require('mongoose')

const stockSchema = new mongoose.Schema({
    name: String,
    quantityPcs: Number,
    quantityCtn: Number
});

const Stock = mongoose.model('stock', stockSchema);

module.exports = Stock;