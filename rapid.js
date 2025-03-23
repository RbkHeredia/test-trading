// 🔄 Bot de scalping con WebSocket y control de reintentos mejorado
const { ethers } = require("ethers");
const { RSI, SMA } = require("technicalindicators");
const WebSocket = require("ws");
require("dotenv").config();
const axios = require("axios");
const { sendEmail } = require("./utils/email");
const { getBalance } = require("./trading/getBallance");
const { getParaswapQuote } = require("./trading/getParaswap");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const paraswapAPI = "https://apiv5.paraswap.io";

// Tokens en Polygon
const USDT = process.env.USDT_ADDRESS;
const WETH = process.env.WETH_ADDRESS;

// Configuración del Scalping
const BUY_THRESHOLD = -0.05; // Compra si cae -5%
const SELL_THRESHOLD = 0.3; // Vende si sube +10%
const SLIPPAGE_TOLERANCE = 0.005; // 0.5% de tolerancia
const TRADE_AMOUNT = ethers.parseUnits("50", 6); // 30 USDT

let priceHistory = [];
const MAX_HISTORY = 100;

let isTrading = false;
let buyPrice = null;
let latestPrice = null;
let referencePrice = null;
let trailingStop = null;

const ws = new WebSocket("wss://stream.binance.com:9443/ws/ethusdt@trade");

ws.on("open", () => {
  console.log("📡 Conectado a Binance WebSocket");
});

setInterval(() => {
  if (latestPrice !== null) {
    referencePrice = latestPrice;
    console.log(
      `🕒 Precio de referencia actualizado: ${referencePrice}, isTrading=${isTrading}`
    );
  }
}, 30000);

ws.on("message", async (data) => {
  const trade = JSON.parse(data);
  const currentPrice = parseFloat(trade.p);
  latestPrice = currentPrice;
  priceHistory.push(currentPrice);
  if (priceHistory.length > MAX_HISTORY) priceHistory.shift();

  if (!referencePrice) return;

  const change = (currentPrice - referencePrice) / referencePrice;
  if (
    !isTrading &&
    buyPrice === null &&
    (change * 100).toFixed(2) <= BUY_THRESHOLD
  ) {
    const rsiValue = RSI.calculate({ values: priceHistory, period: 14 }).pop();
    const smaValue = SMA.calculate({ values: priceHistory, period: 14 }).pop();
    console.log(`📊 RSI actual: ${rsiValue?.toFixed(2)}`);
    console.log(`📉 SMA actual: ${smaValue?.toFixed(2)}`);

    if (rsiValue && smaValue && rsiValue < 30 && currentPrice < smaValue) {
      console.log(
        `🟢 RSI ${rsiValue.toFixed(2)} y precio ${currentPrice.toFixed(4)} < SMA ${smaValue.toFixed(4)} => Ejecutando compra...`
      );
      await buyWETH(currentPrice);
    } else {
      console.log("⏸ Condiciones de compra no cumplidas. RSI o SMA no favorables.");
    }
    
  }

  if (!isTrading && buyPrice !== null) {
    const gain = (currentPrice - buyPrice) / buyPrice;
    console.log(`📈 Ganancia desde compra: ${(gain * 100).toFixed(2)}%`);

    // Inicializar trailingStop si no está definido
    if (trailingStop === null && gain > 0) {
      trailingStop = currentPrice * 0.995; // ejemplo: 1.5% por debajo del precio actual
      console.log(
        `🛡️ Trailing Stop iniciado en: ${trailingStop.toFixed(4)} USDT`
      );
    }

    // Si el precio sube, actualizamos el trailingStop hacia arriba
    if (
      trailingStop &&
      currentPrice > buyPrice &&
      currentPrice * 0.985 > trailingStop
    ) {
      trailingStop = currentPrice * 0.985;
      console.log(
        `🔼 Trailing Stop ajustado a: ${trailingStop.toFixed(4)} USDT`
      );
    }

    // Si el precio baja y toca el trailing stop => vender
    if (trailingStop && currentPrice <= trailingStop) {
      console.log(
        `🛑 Precio cayó por debajo del trailing stop (${trailingStop.toFixed(
          4
        )}). Vendiendo...`
      );
      await sellWETH(currentPrice);
      trailingStop = null; // reiniciamos
    }
  }
});

async function buyWETH(currentPrice) {
  if (isTrading) return;
  isTrading = true;

  try {
    const quote = await getParaswapQuote(TRADE_AMOUNT, USDT, WETH);
    if (!quote || !quote.destAmount || quote.destAmount === "0")
      throw new Error("Cotización inválida.");

    const revalidated = await getParaswapQuote(TRADE_AMOUNT, USDT, WETH);
    const minAmount = parseFloat(quote.destAmount) * (1 - SLIPPAGE_TOLERANCE);
    if (!revalidated || parseFloat(revalidated.destAmount) < minAmount)
      throw new Error("Slippage muy alto");

    console.log(`🚀 Comprando WETH a ${currentPrice} USDT...`);
    const txDataRes = await axios.post(`${paraswapAPI}/transactions/137`, {
      srcToken: USDT,
      destToken: WETH,
      srcAmount: TRADE_AMOUNT.toString(),
      destAmount: revalidated.destAmount,
      priceRoute: revalidated,
      userAddress: wallet.address,
    });

    console.log("🔍 Enviando datos a Paraswap:", {
      srcToken: USDT,
      destToken: WETH,
      srcAmount: TRADE_AMOUNT.toString(),
      destAmount: revalidated.destAmount,
      userAddress: wallet.address,
    });
    const tx = await wallet.sendTransaction({
      to: txDataRes.data.to,
      data: txDataRes.data.data,
      value: txDataRes.data.value
        ? ethers.parseUnits(txDataRes.data.value, "wei")
        : 0,
      gasLimit: txDataRes.data.gas,
      gasPrice:
        (await getFastGasPrice()) ||
        ethers.parseUnits(txDataRes.data.gasPrice, "wei"),
    });

    console.log(`📌 Compra enviada: ${tx.hash}`);
    await tx.wait();
    sendEmail("Compra exitosa: ", "");
    buyPrice = currentPrice;
    console.log(`✅ Compra exitosa a ${buyPrice.toFixed(6)} USDT.`);
  } catch (error) {
    console.error("❌ Error al ejecutar la compra:", error.message);
    sendEmail("Problemas en la compra", error.message);
  } finally {
    isTrading = false;
  }
}

async function sellWETH(currentPrice) {
  if (isTrading) return;
  isTrading = true;

  try {
    const balance = await getBalance(WETH, 18);
    if (!balance || parseFloat(balance) <= 0)
      throw new Error("No hay WETH suficiente.");

    const amount = ethers.parseUnits(balance, 18);
    const quote = await getParaswapQuote(amount, WETH, USDT);
    if (!quote) throw new Error("Cotización inválida.");

    const quoteUSDT = parseFloat(ethers.formatUnits(quote.destAmount, 6));
    const expectedMin =
      currentPrice * parseFloat(balance) * (1 - SLIPPAGE_TOLERANCE);
    if (quoteUSDT < expectedMin)
      throw new Error("Slippage en venta supera el límite");

    console.log(`🚀 Vendiendo WETH a ${currentPrice} USDT...`);
    const txDataRes = await axios.post(`${paraswapAPI}/transactions/137`, {
      srcToken: WETH,
      destToken: USDT,
      srcAmount: amount.toString(),
      destAmount: quote.destAmount,
      priceRoute: quote,
      userAddress: wallet.address,
    });

    const tx = await wallet.sendTransaction({
      to: txDataRes.data.to,
      data: txDataRes.data.data,
      value: txDataRes.data.value
        ? ethers.parseUnits(txDataRes.data.value, "wei")
        : 0,
      gasLimit: txDataRes.data.gas,
      gasPrice:
        (await getFastGasPrice()) ||
        ethers.parseUnits(txDataRes.data.gasPrice, "wei"),
    });

    console.log(`📌 Venta enviada: ${tx.hash}`);
    await tx.wait();
    console.log("✅ Venta exitosa.");
    sendEmail("Venta exitosa", `Ganancia: $${currentPrice - buyPrice}`);
    buyPrice = null;
  } catch (error) {
    console.error("❌ Error al ejecutar la venta:", error.message);
    sendEmail("Error al vender", error.message);
  } finally {
    isTrading = false;
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

console.log("🔄 Bot de scalping iniciado con WebSockets...");
