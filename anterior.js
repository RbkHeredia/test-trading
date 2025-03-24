require("dotenv").config(); // 👈 ¡Siempre primero!
const connectDB = require("./db");
const Trade = require("./models/trade");
connectDB();

async function testDB(){
  await Trade.create({
    buyPrice:0,
    sellPrice: 0,
    gainPercent:0,
    profitUSDT:0,
    txBuyHash: "tx_buy_hash_placeholder", // puedes guardarlo desde buyWETH en una variable global si querés
    txSellHash: "tx.hash",
  });
}

testDB();