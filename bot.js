const { provider, wallet, router } = require("./config/config");
const { sendEmail } = require("./utils/email");
const { getTokenPrice, getTokenPriceBNB_UNI } = require("./utils/priceFetcher");
const { getMovingAverage, isHighVolatility } = require("./utils/indicators");
const { buyToken } = require("./trading/buy");
const { sellToken } = require("./trading/sell");
const { ethers } = require("ethers");


console.log("🚀 Bot de Scalping con Stop-Loss iniciado...");

let lastPrice = null;
let activeTrade = false;
let buyPrice = null;

async function scalping() {
  let currentPrice = await getTokenPrice();
  let priceBNB_UNI = await getTokenPriceBNB_UNI();
  if (!currentPrice || !priceBNB_UNI) {
    console.log("⚠️ No se pudo obtener el precio del token. Esperando...");
    return;
  }
  if (!lastPrice) lastPrice = currentPrice;
  console.log(`📊 Precio BNB/USDT Actual: $${currentPrice}`);
  console.log(`📊 Precio BNB/UNI Actual: $${priceBNB_UNI}`);

  /* const ma5 = await getMovingAverage("BNBUSDT", 5);
  if (currentPrice < ma5) {
      console.log("⚠️ Precio por debajo de la media móvil, evitando compra.");
      return;
  } */

  /* if (await isHighVolatility("BNBUSDT")) {
      console.log("⚠️ Alta volatilidad detectada, evitando operación.");
      return;
  } */
  
  if (!activeTrade && currentPrice > lastPrice * 1.001) {
      console.log("🚀 Comprando...");
      await buyToken(ethers.parseEther("0.0166"));
      buyPrice = currentPrice;
      activeTrade = true;
      await sendEmail("🚀 Compra realizada", `Compra ejecutada a ${buyPrice} USD.`);
  }

  if (activeTrade && (currentPrice < buyPrice * 0.98 || currentPrice > buyPrice * 1.03)) {
      console.log("✅ Vendiendo...");
      await sellToken();
      activeTrade = false;
      await sendEmail("✅ Venta realizada", `Venta ejecutada a ${currentPrice} USD.`);
  }

  lastPrice = currentPrice;
}
setInterval(scalping, 30000);
