// manualBuyWithStopLoss.js
const { ethers } = require("ethers");
require("dotenv").config();
const axios = require("axios");
const Buy = require("./models/buy");
const Sell = require("./models/sell");
const { getBalance } = require("./trading/getBallance");
const { getParaswapQuote } = require("./trading/getParaswap");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const USDT = process.env.USDT_ADDRESS;
const WETH = process.env.WETH_ADDRESS;
const SLIPPAGE_TOLERANCE = 0.005;
const TRADE_AMOUNT = ethers.parseUnits("80", 6); // 80 USDT
const paraswapAPI = "https://apiv5.paraswap.io";

const STOP_LOSS_PERCENT = -0.005; // -0.5%

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

    // 🧠 Ejecutar transacción de compra
    const txDataRes = await axios.post(`${paraswapAPI}/transactions/137`, {
      srcToken: USDT,
      destToken: WETH,
      srcAmount: TRADE_AMOUNT.toString(),
      destAmount,
      priceRoute: quote,
      userAddress: wallet.address,
      partner: "paraswap.io",
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
    await Buy.create({ buyPrice: latestPrice });
    console.log("🎉 Compra manual completada con éxito");

    // 🛡️ Stop loss simple monitoreado con intervalo
    const buyPrice = latestPrice;
    const interval = setInterval(async () => {
      try {
        const res = await axios.get("https://api.binance.com/api/v3/ticker/price", {
          params: { symbol: "ETHUSDT" },
        });
        const currentPrice = parseFloat(res.data.price);
        const change = (currentPrice - buyPrice) / buyPrice;

        console.log(`🔍 Monitoreo de precio actual: ${currentPrice} (${(change * 100).toFixed(2)}%)`);

        if (change <= STOP_LOSS_PERCENT) {
          console.warn(`🛑 Stop Loss activado. Vendiendo a ${currentPrice}`);

          const balance = await getBalance(WETH, 18);
          if (!balance || parseFloat(balance) <= 0) throw new Error("No hay WETH suficiente.");

          const amount = ethers.parseUnits(balance, 18);
          const sellQuote = await getParaswapQuote(amount, WETH, USDT);

          const txSellData = await axios.post(`${paraswapAPI}/transactions/137`, {
            srcToken: WETH,
            destToken: USDT,
            srcAmount: amount.toString(),
            destAmount: sellQuote.destAmount,
            priceRoute: sellQuote,
            userAddress: wallet.address,
          });

          const sellTx = await wallet.sendTransaction({
            to: txSellData.data.to,
            data: txSellData.data.data,
            value: txSellData.data.value ? ethers.parseUnits(txSellData.data.value, "wei") : 0,
            gasLimit: txSellData.data.gas,
            gasPrice:
              (await getFastGasPrice()) || ethers.parseUnits(txSellData.data.gasPrice, "wei"),
          });

          await sellTx.wait();
          console.log("✅ Venta ejecutada por Stop Loss.");

          await Sell.create({ sellPrice: currentPrice });
          clearInterval(interval);
        }
      } catch (error) {
        console.error("❌ Error en monitoreo de stop loss:", error.message);
      }
    }, 30000); // verifica cada 30 segundos
  } catch (err) {
    console.error("❌ Error general:", err.message);
  }
})();
