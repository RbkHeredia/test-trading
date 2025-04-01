const mongoose = require("mongoose");

const sellSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  sellPrice: Number,
});

module.exports = mongoose.model("Sell", sellSchema);