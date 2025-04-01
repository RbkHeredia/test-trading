// manualBuy.js
const { ethers } = require("ethers");
require("dotenv").config();
const axios = require("axios");
const Buy = require("./models/buy")

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const USDT = process.env.USDT_ADDRESS;
const WETH = process.env.WETH_ADDRESS;
const SLIPPAGE_TOLERANCE = 0.005;
const TRADE_AMOUNT = ethers.parseUnits("80", 6); // 80 USDT
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

async function getFastGasPrice() {
  try {
    const response = await axios.get("https://api.polygonscan.com/api", {
      params: {
        module: "gastracker",
        action: "gasoracle",
        apikey: process.env.ETHERSCAN_API_KEY,
      },
    });
    return ethers.parseUnits(response.data.result.FastGasPrice, "gwei");
  } catch (err) {
    console.error("⚠️ Error obteniendo gas price:", err.message);
    return null;
  }
}

(async () => {
  try {
    // 🔍 Obtener precio actual de mercado
    const response = await axios.get("https://api.binance.com/api/v3/ticker/price", {
      params: { symbol: "ETHUSDT" },
    });
    const latestPrice = parseFloat(response.data.price);
    console.log(`🟢 Precio actual de mercado: ${latestPrice} USDT`);

    // ⚡ Obtener cotización actualizada
    const quote = await getParaswapQuote(TRADE_AMOUNT, USDT, WETH);
    if (!quote || !quote.destAmount || quote.destAmount === "0") {
      throw new Error("❌ Cotización inválida");
    }

    const minAmount = parseFloat(quote.destAmount) * (1 - SLIPPAGE_TOLERANCE);
    const destAmount = Math.floor(minAmount).toString();

    // 🧠 Obtener datos para la transacción
    const txDataRes = await axios.post(`${paraswapAPI}/transactions/137`, {
      srcToken: USDT,
      destToken: WETH,
      srcAmount: TRADE_AMOUNT.toString(),
      destAmount,
      priceRoute: quote,
      userAddress: wallet.address,
      partner: "paraswap.io", // Recomendado
    });

    console.log(`🚀 Ejecutando compra manual a ${latestPrice} USDT`);

    const tx = await wallet.sendTransaction({
      to: txDataRes.data.to,
      data: txDataRes.data.data,
      value: txDataRes.data.value ? ethers.parseUnits(txDataRes.data.value, "wei") : 0,
      gasLimit: txDataRes.data.gas,
      gasPrice:
        (await getFastGasPrice()) || ethers.parseUnits(txDataRes.data.gasPrice, "wei"),
    });

    console.log(`✅ Compra enviada: ${tx.hash}`);
    await tx.wait();
    await Buy.create({buyPrice:latestPrice })
    console.log("🎉 Compra manual completada con éxito");

  } catch (err) {
    if (err.response) {
      console.error("❌ Error en la compra manual:");
      console.error("➡️ Código:", err.response.status);
      console.error("➡️ Datos:", JSON.stringify(err.response.data, null, 2));
    } else {
      console.error("❌ Error en la compra manual:", err.message);
    }
  }
})();
