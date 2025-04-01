const mongoose = require("mongoose");

const buySchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  buyPrice: Number,
});

module.exports = mongoose.model("Buy", buySchema);