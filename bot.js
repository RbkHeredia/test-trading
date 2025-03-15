const { provider, wallet, router } = require("./config/config");
const { sendEmail } = require("./utils/email");
const { getTokenPrice } = require("./utils/priceFetcher");
const { getMovingAverage, isHighVolatility } = require("./utils/indicators");
const { buyToken } = require("./trading/buy");
const { sellToken } = require("./trading/sell");
const ethers = require("ethers");

console.log("🚀 Bot de Scalping con Stop-Loss iniciado...");

let lastPrice = null;
let activeTrade = false;
let buyPrice = null;

async function scalping() {
  let currentPrice = await getTokenPrice();
  if (!currentPrice) return;
  if (!lastPrice) lastPrice = currentPrice;
  console.log(`📊 Precio Actual: $${currentPrice}`);

  /* const ma5 = await getMovingAverage("BNBUSDT", 5);
  if (currentPrice < ma5) {
      console.log("⚠️ Precio por debajo de la media móvil, evitando compra.");
      return;
  } */

  if (await isHighVolatility("BNBUSDT")) {
      console.log("⚠️ Alta volatilidad detectada, evitando operación.");
      return;
  }
  
  if (!activeTrade && currentPrice > lastPrice * 1.005) {
      console.log("🚀 Comprando...");
      await buyToken(ethers.utils.parseEther("0.0166"));
      buyPrice = currentPrice;
      activeTrade = true;
      await sendEmail("🚀 Compra realizada", `Compra ejecutada a ${buyPrice} USD.`);
  }

  if (activeTrade && (currentPrice < buyPrice * 0.97 || currentPrice > buyPrice * 1.05)) {
      console.log("✅ Vendiendo...");
      await sellToken();
      activeTrade = false;
      await sendEmail("✅ Venta realizada", `Venta ejecutada a ${currentPrice} USD.`);
  }

  lastPrice = currentPrice;
}
setInterval(scalping, 5000);
