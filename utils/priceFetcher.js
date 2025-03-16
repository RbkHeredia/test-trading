const axios = require("axios");

async function getTokenPrice() {
  const tokenSymbol = "BNBUSDT"; // ⚠️ Cambia esto según el token que estás tradeando

  try {
      const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${tokenSymbol}`);
      console.log(`📊 Precio desde Binance: $${response.data.price}`);
      return parseFloat(response.data.price);
  } catch (error) {
      console.error("❌ Error obteniendo el precio desde Binance:", error.message);
      return await getPriceFromPancake();
  }
}

async function getPriceFromPancake() {
  const url = `https://api.pancakeswap.info/api/v2/tokens/${process.env.TOKEN_ADDRESS}`;

  try {
      const response = await axios.get(url);
      console.log(`📊 Precio desde PancakeSwap: $${response.data.data.price}`);
      return parseFloat(response.data.data.price);
  } catch (error) {
      console.error("❌ Error obteniendo el precio desde PancakeSwap:", error.message);
      return null;
  }
}

async function getTokenPriceBNB_UNI() {
  try {
    const response = await axios.get("https://api.binance.com/api/v3/ticker/price?symbol=UNIBNB");
    return parseFloat(response.data.price);
  } catch (error) {
    console.error("❌ Error obteniendo precio de BNB/UNI desde Binance:", error.message);
    return null;
  }
}

module.exports = { getTokenPrice, getPriceFromPancake, getTokenPriceBNB_UNI };