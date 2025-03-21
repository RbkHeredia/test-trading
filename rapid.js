// 🔄 Bot de scalping con WebSocket y control de reintentos mejorado
const { ethers } = require("ethers");
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
const BUY_THRESHOLD = -0.08; // Compra si cae -8%
const SELL_THRESHOLD = 0.3;  // Vende si sube +10%
const SLIPPAGE_TOLERANCE = 0.005; // 0.5% de tolerancia
const TRADE_AMOUNT = ethers.parseUnits("30", 6); // 30 USDT

let isTrading = false;
let buyPrice = null;
let latestPrice = null;
let referencePrice = null;

const ws = new WebSocket("wss://stream.binance.com:9443/ws/ethusdt@trade");

ws.on("open", () => {
  console.log("📡 Conectado a Binance WebSocket");
});

setInterval(() => {
  if (latestPrice !== null) {
    referencePrice = latestPrice;
    console.log(`🕒 Precio de referencia actualizado: ${referencePrice}, isTrading=${isTrading}`);
  }
}, 30000);

ws.on("message", async (data) => {
  const trade = JSON.parse(data);
  const currentPrice = parseFloat(trade.p);
  latestPrice = currentPrice;

  if (!referencePrice) return;

  const change = (currentPrice - referencePrice) / referencePrice;
  if (!isTrading && buyPrice === null && (change*100).toFixed(2) <= BUY_THRESHOLD) {
    console.log(`🟢 Detectada caída del ${(change * 100).toFixed(2)}%. Ejecutando compra...`);
    await buyWETH(currentPrice);
  }

  if (!isTrading && buyPrice !== null) {
    const gain = (currentPrice - buyPrice) / buyPrice;
    console.log(`📈 Ganancia desde compra: ${(gain * 100).toFixed(2)}%, sell ${SELL_THRESHOLD}`);

    if ((gain * 100).toFixed(2) >= SELL_THRESHOLD) {
      console.log("🔴 Umbral de ganancia alcanzado. Ejecutando venta...");
      await sellWETH(currentPrice);
    }
  }
});

async function buyWETH(currentPrice) {
  if (isTrading) return;
  isTrading = true;

  try {
    const quote = await getParaswapQuote(TRADE_AMOUNT, USDT, WETH);
    if (!quote || !quote.destAmount || quote.destAmount === "0") throw new Error("Cotización inválida.");

    const revalidated = await getParaswapQuote(TRADE_AMOUNT, USDT, WETH);
    const minAmount = parseFloat(quote.destAmount) * (1 - SLIPPAGE_TOLERANCE);
    if (!revalidated || parseFloat(revalidated.destAmount) < minAmount) throw new Error("Slippage muy alto");

    console.log(`🚀 Comprando WETH a ${currentPrice} USDT...`);
    const txDataRes = await axios.post(`${paraswapAPI}/transactions/137`, {
      srcToken: USDT,
      destToken: WETH,
      srcAmount: TRADE_AMOUNT.toString(),
      destAmount: revalidated.destAmount,
      priceRoute: revalidated,
      userAddress: wallet.address,
    });

    const tx = await wallet.sendTransaction({
      to: txDataRes.data.to,
      data: txDataRes.data.data,
      value: txDataRes.data.value ? ethers.parseUnits(txDataRes.data.value, "wei") : 0,
      gasLimit: txDataRes.data.gas,
      gasPrice: await getFastGasPrice() || ethers.parseUnits(txDataRes.data.gasPrice, "wei"),
    });

    console.log(`📌 Compra enviada: ${tx.hash}`);
    await tx.wait();
    buyPrice = currentPrice;
    console.log(`✅ Compra exitosa a ${buyPrice.toFixed(6)} USDT.`);
  } catch (error) {
    console.error("❌ Error al ejecutar la compra:", error.message);
  } finally {
    isTrading = false;
  }
}

async function sellWETH(currentPrice) {
  if (isTrading) return;
  isTrading = true;

  try {
    const balance = await getBalance(WETH, 18);
    if (!balance || parseFloat(balance) <= 0) throw new Error("No hay WETH suficiente.");

    const amount = ethers.parseUnits(balance, 18);
    const quote = await getParaswapQuote(amount, WETH, USDT);
    if (!quote) throw new Error("Cotización inválida.");

    const quoteUSDT = parseFloat(ethers.formatUnits(quote.destAmount, 6));
    const expectedMin = currentPrice * parseFloat(balance) * (1 - SLIPPAGE_TOLERANCE);
    if (quoteUSDT < expectedMin) throw new Error("Slippage en venta supera el límite");

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
      value: txDataRes.data.value ? ethers.parseUnits(txDataRes.data.value, "wei") : 0,
      gasLimit: txDataRes.data.gas,
      gasPrice: await getFastGasPrice() || ethers.parseUnits(txDataRes.data.gasPrice, "wei"),
    });

    console.log(`📌 Venta enviada: ${tx.hash}`);
    await tx.wait();
    console.log("✅ Venta exitosa.");
    buyPrice = null;
  } catch (error) {
    console.error("❌ Error al ejecutar la venta:", error.message);
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
