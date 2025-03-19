const axios = require("axios");

const paraswapAPI = "https://apiv5.paraswap.io";


async function getParaswapQuote(amountIn, srcToken, destToken) {
    const url = `${paraswapAPI}/prices/?srcToken=${srcToken}&destToken=${destToken}&amount=${amountIn}&network=137`;

    try {
        const response = await axios.get(url, {
            headers: { 'X-Partner': 'anon', 'User-Agent': 'Mozilla/5.0' }
        });
        return response.data.priceRoute;
    } catch (error) {
        console.error("❌ Error obteniendo cotización en ParaSwap:", error.response?.data || error.message);
        return null;
    }
}

module.exports = { getParaswapQuote };
