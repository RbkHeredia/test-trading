const axios = require("axios");

async function getMovingAverage(symbol, period = 5) {
    try {
        const response = await axios.get(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=${period}`);
        const prices = response.data.map(candle => parseFloat(candle[4]));
        return prices.reduce((a, b) => a + b, 0) / period;
    } catch (error) {
        console.error("❌ Error obteniendo media móvil:", error.message);
        return null;
    }
}

async function isHighVolatility(symbol) {
    try {
        const response = await axios.get(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=3`);
        const candles = response.data.map(candle => ({
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
        }));

        for (const candle of candles) {
            const range = ((candle.high - candle.low) / candle.low) * 100;
            if (range > 5) return true;
        }
        return false;
    } catch (error) {
        console.error("❌ Error obteniendo datos de velas:", error.message);
        return null;
    }
}

module.exports = { getMovingAverage, isHighVolatility };