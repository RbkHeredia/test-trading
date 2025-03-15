require("dotenv").config();
const { ethers } = require("ethers");
const { getTokenPrice } = require("../utils/priceFetcher");
const { buyToken } = require("../trading/buy");
const { sellToken } = require("../trading/sell");

async function testTrade() {
  console.log("🚀 Iniciando prueba de compra y venta rápida...");

  let currentPrice = await getTokenPrice();
  if (!currentPrice) {
      console.log("⚠️ No se pudo obtener el precio del token. Saliendo...");
      return;
  }

  console.log(`📊 Precio actual del token: $${currentPrice}`);

  let amountToBuy = ethers.parseEther("0.01"); // 0.01 BNB

  console.log("🛒 Intentando comprar...");
  try {
      await buyToken(amountToBuy);
      console.log("✅ Compra completada exitosamente.");  // 🔹 Mensaje para confirmar compra
  } catch (error) {
      console.error("❌ No se pudo comprar el token.", error);
      return;
  }

  console.log("⌛ Esperando unos segundos antes de vender...");
  await new Promise(resolve => setTimeout(resolve, 5000));  // Espera 5 segundos antes de vender

  console.log("🔄 Intentando vender...");
  try {
      await sellToken();
      console.log("✅ Venta completada exitosamente.");
  } catch (error) {
      console.error("❌ No se pudo vender el token.", error);
      return;
  }
}

testTrade();