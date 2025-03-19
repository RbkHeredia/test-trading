const axios = require("axios");

async function getTokenPrice() {
  const tokenSymbol = "LINKUSDT"; // ✅ Cambiado a LINK/USDT

  try {
    const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${tokenSymbol}`);
    console.log(`📊 Precio desde Binance: $${response.data.price}`);
    return parseFloat(response.data.price);
  } catch (error) {
    console.error("❌ Error obteniendo el precio desde Binance:", error.message);
    return await getPriceFromQuickSwap();
  }
}

async function getPriceFromQuickSwap() {
  if (!process.env.TOKEN_ADDRESS) {
    console.error("⚠️ No se definió TOKEN_ADDRESS en .env, no se puede obtener precio desde QuickSwap.");
    return null;
  }

  const url = `https://api.quickswap.exchange/v1/price/${process.env.TOKEN_ADDRESS}`;

  try {
    const response = await axios.get(url);
    console.log(`📊 Precio desde QuickSwap: $${response.data.price}`);
    return parseFloat(response.data.price);
  } catch (error) {
    console.error("❌ Error obteniendo el precio desde QuickSwap:", error.message);
    return null;
  }
}

module.exports = { getTokenPrice, getPriceFromQuickSwap };
