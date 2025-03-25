const axios = require("axios");

async function preloadPriceWindow(symbol = "ETHUSDT", interval = "1m", windowSize = 120) {
  try {
    const response = await axios.get("https://api.binance.com/api/v3/klines", {
      params: {
        symbol,
        interval,
        limit: windowSize,
      },
    });

    const closes = response.data.map(candle => parseFloat(candle[4]));
    console.log(`✅ Precarga completa con ${closes.length} precios desde Binance Klines.`);
    return closes;
  } catch (error) {
    console.error("❌ Error al precargar precios desde Binance:", error.message);
    return [];
  }
}

module.exports = {
  preloadPriceWindow,
};
