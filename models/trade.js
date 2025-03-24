// models/Trade.js
const mongoose = require("mongoose");

const tradeSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  buyPrice: Number,
  sellPrice: Number,
  gainPercent: Number,
  profitUSDT: Number,
  txBuyHash: String,
  txSellHash: String,
  status: { type: String, enum: ["COMPLETED", "FAILED"], default: "COMPLETED" },
});

module.exports = mongoose.model("Trade", tradeSchema);
