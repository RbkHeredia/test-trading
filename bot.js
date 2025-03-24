// 🔄 Bot de scalping con WebSocket y control de reintentos mejorado
const { ethers } = require("ethers");
const WebSocket = require("ws");
require("dotenv").config();
const axios = require("axios");
const { sendEmail } = require("./utils/email");
const { getBalance } = require("./trading/getBallance");
const { getParaswapQuote } = require("./trading/getParaswap");
const connectDB = require("./db");
const Trade = require("./models/trade");
connectDB();

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const paraswapAPI = "https://apiv5.paraswap.io";

// Tokens en Polygon
const USDT = process.env.USDT_ADDRESS;
const WETH = process.env.WETH_ADDRESS;

// Configuración del Scalping
const SLIPPAGE_TOLERANCE = 0.005; // 0.5% de tolerancia
const TRADE_AMOUNT = ethers.parseUnits("80", 6); // 30 USDT

let isTrading = false;
let buyPrice = null;
let latestPrice = null;
let referencePrice = null;

const ws = new WebSocket("wss://stream.binance.com:9443/ws/ethusdt@trade");

ws.on("open", () => {
  console.log("📡 Conectado a Binance WebSocket");
});

const priceWindow = [];
const WINDOW_SIZE = 120;
const DEVIATION_FACTOR = 2; // Usamos 2 desviaciones estándar
const RETURN_TO_MEAN_THRESHOLD = 0.002; // 0.2% arriba de la media para vender
const STOP_LOSS_PERCENT = -0.01;

let isInitialized = false;

ws.on("message", (data) => {
  const trade = JSON.parse(data);
  latestPrice = parseFloat(trade.p);
});

setInterval(async () => {
  if (latestPrice === null) return;

  // Guardamos en ventana de precios (1 dato cada 30s)
  priceWindow.push(latestPrice);
  if (priceWindow.length > WINDOW_SIZE) priceWindow.shift();

  referencePrice = latestPrice;
  console.log(
    `🕒 Precio de referencia actualizado: ${referencePrice}, isTrading=${isTrading}`
  );

  if (priceWindow.length < WINDOW_SIZE) {
    console.log(
      `⏳ Esperando llenar ventana de precios... (${priceWindow.length}/${WINDOW_SIZE})`
    );
    return;
  }

  if (!isInitialized) {
    isInitialized = true;
    console.log("✅ Ventana llena. Estrategia de scalping activada.");
    return;
  }

  // Calcular estadísticas
  const mean = priceWindow.reduce((a, b) => a + b, 0) / priceWindow.length;
  const stdDev = Math.sqrt(
    priceWindow.map((p) => (p - mean) ** 2).reduce((a, b) => a + b) /
      priceWindow.length
  );
  const lowerBound = mean - DEVIATION_FACTOR * stdDev;
  const upperBound = mean + RETURN_TO_MEAN_THRESHOLD * mean;

  console.log(
    `📊 mean=${mean.toFixed(2)}, stdDev=${stdDev.toFixed(
      4
    )}, lower=${lowerBound.toFixed(2)}, upper=${upperBound.toFixed(
      2
    )}, latest=${latestPrice}`
  );

  // Comprar
  if (!isTrading && buyPrice === null && latestPrice < lowerBound) {
    console.log(
      `🟢 Precio por debajo de banda baja (${lowerBound.toFixed(
        2
      )}). Ejecutando compra a ${latestPrice}`
    );
    await buyWETH(latestPrice);
    return;
  }

  // Vender
  if (isTrading && buyPrice !== null) {
    const priceChange = (latestPrice - buyPrice) / buyPrice;
  
    if (priceChange <= STOP_LOSS_PERCENT) {
      console.warn(`🔻 Activando Stop-Loss (${(priceChange * 100).toFixed(2)}%). Vendiendo a ${latestPrice}`);
      await sellWETH(latestPrice);
      return;
    }
  }
  if (isTrading && buyPrice !== null && latestPrice >= upperBound) {
    console.log(
      `🔴 Precio regresó a la media (${upperBound.toFixed(
        2
      )}). Ejecutando venta a ${latestPrice}`
    );
    await sellWETH(latestPrice);
    return;
  }
}, 30000); // cada 30 segundos

async function buyWETH(currentPrice) {
  if (isTrading) return;

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
    buyPrice = currentPrice;
    isTrading = true;
    console.log(`✅ Compra exitosa a ${buyPrice.toFixed(6)} USDT.`);
  } catch (error) {
    isTrading = false;
    if (error.response) {
      console.error("❌ Error al ejecutar la compra:");
      console.error("➡️ Código:", error.response.status);
      console.error("➡️ Datos:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("❌ Error al ejecutar la compra:", error.message);
    }
  }
}

async function sellWETH(currentPrice) {
  if (!isTrading || buyPrice === null) return;

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
    const gainPercent = ((currentPrice - buyPrice) / buyPrice) * 100;
    const profitUSDT =
      (currentPrice - buyPrice) *
      parseFloat(ethers.formatUnits(await getBalance(WETH, 18), 18));

    await Trade.create({
      buyPrice,
      sellPrice: currentPrice,
      gainPercent,
      profitUSDT,
      txBuyHash: "tx_buy_hash_placeholder", // puedes guardarlo desde buyWETH en una variable global si querés
      txSellHash: tx.hash,
    });
    buyPrice = null;
    isTrading = false;
  } catch (error) {
    console.error("❌ Error al ejecutar la venta:", error.message);
    isTrading = true;
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
