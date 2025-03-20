const { ethers } = require("ethers");
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
const CHECK_INTERVAL = 30000; // Verifica cada 30 segundos
const BUY_THRESHOLD = -0.05; // Compra si cae -4%
const SELL_THRESHOLD = 0.05; // Vende si sube +4%
const STOP_LOSS_THRESHOLD = -0.05;
const TRADE_AMOUNT = ethers.parseUnits("30", 6); // Compra con 20 USDT
let lastPrice = null; // Último precio registrado
let isTrading = false; // Previene transacciones simultáneas
let buyPrice = null;

async function buyWETH() {
  if (isTrading) return;
  isTrading = true;

  console.log("🚀 Comprando WETH con USDT...");
  let retries = 3;
  let quote;
  while (retries > 0) {
    quote = await getParaswapQuote(TRADE_AMOUNT, USDT, WETH);
    if (quote) break;
    console.log("⚠️ Reintentando obtener cotización...");
    retries--;
  }
  if (!quote) {
    console.error("❌ No se pudo obtener una cotización válida.");
    isTrading = false;
    return;
  }

  console.log(
    "🔹 Verificando variación de precio antes de ejecutar la compra..."
  );
  let newQuote;
  retries = 3;
  while (retries > 0) {
    newQuote = await getParaswapQuote(TRADE_AMOUNT, USDT, WETH);
    if (newQuote && newQuote.destAmount === quote.destAmount) break;
    console.warn("⚠️ El precio cambió, volviendo a cotizar...");
    quote = newQuote;
    retries--;
  }

  if (!newQuote) {
    console.log(
      "❌ No se pudo obtener una cotización estable, cancelando compra."
    );
    isTrading = false;
    return;
  }

  console.log("🔹 Ejecutando compra...");
  try {
    const txDataResponse = await axios.post(
      `${paraswapAPI}/transactions/137`,
      {
        srcToken: USDT,
        destToken: WETH,
        srcAmount: TRADE_AMOUNT.toString(),
        destAmount: quote.destAmount,
        priceRoute: quote,
        userAddress: wallet.address,
      },
      { headers: { "X-Partner": "anon", "User-Agent": "Mozilla/5.0" } }
    );

    const txData = txDataResponse.data;
    const tx = await wallet.sendTransaction({
      to: txData.to,
      data: txData.data,
      value: txData.value ? ethers.parseUnits(txData.value, "wei") : 0,
      gasLimit: txData.gas,
      gasPrice: txData.gasPrice
        ? ethers.parseUnits(txData.gasPrice, "wei")
        : undefined,
    });

    console.log(`📌 Compra enviada: ${tx.hash}`);
    await tx.wait();
    buyPrice =
      parseFloat(ethers.formatUnits(TRADE_AMOUNT, 6)) /
      parseFloat(ethers.formatUnits(quote.destAmount, 18));
    console.log("✅ Compra exitosa.");
  } catch (error) {
    console.error(
      "❌ Error al ejecutar la compra:",
      error.response?.data || error.message
    );
    isTrading = false;
  }
}

async function sellWETH() {
  console.log("🚀 Vendiendo WETH por USDT...");
  let balanceWETH = await getBalance(WETH, 18);
  if (!balanceWETH || parseFloat(balanceWETH) <= 0) {
    console.log("❌ No hay WETH suficiente para vender.");
    return;
  }

  const amountToSell = ethers.parseUnits(balanceWETH, 18);
  let quote = await getParaswapQuote(amountToSell, WETH, USDT);
  if (!quote) {
    console.log("❌ No se pudo obtener una cotización válida.");
    return;
  }

  // 🔹 Verificar tolerancia de slippage antes de ejecutar
  const SLIPPAGE_TOLERANCE = 0.005; // 0.5% de tolerancia
  const maxAcceptablePrice = quote.destAmount * (1 - SLIPPAGE_TOLERANCE);

  let newQuote = await getParaswapQuote(amountToSell, WETH, USDT);
  if (!newQuote || parseFloat(newQuote.destAmount) < maxAcceptablePrice) {
    console.log(
      `⚠️ Cambio de precio fuera del margen aceptable. Cancelando venta.`
    );
    return;
  }

  console.log("🔹 Ejecutando venta...");
  try {
    const txDataResponse = await axios.post(
      `${paraswapAPI}/transactions/137`,
      {
        srcToken: WETH,
        destToken: USDT,
        srcAmount: amountToSell.toString(),
        destAmount: newQuote.destAmount,
        priceRoute: newQuote,
        userAddress: wallet.address,
      },
      { headers: { "X-Partner": "anon", "User-Agent": "Mozilla/5.0" } }
    );

    const txData = txDataResponse.data;
    const tx = await wallet.sendTransaction({
      to: txData.to,
      data: txData.data,
      value: txData.value ? ethers.parseUnits(txData.value, "wei") : 0,
      gasLimit: txData.gas,
      gasPrice: txData.gasPrice
        ? ethers.parseUnits(txData.gasPrice, "wei")
        : undefined,
    });

    console.log(`📌 Venta enviada: ${tx.hash}`);
    await tx.wait();
    console.log("✅ Venta exitosa.");
    isTrading = false;
    buyPrice = null;
    sendEmail("Venta exitosa", `Se ha realizado la venta ${tx.hash}`);
  } catch (error) {
    console.error(
      "❌ Error al ejecutar la venta:",
      error.response?.data || error.message
    );
    sendEmail(
      "Error al ejecutar la venta",
      `${error.response?.data || error.message}`
    );
    isTrading = false;
  }
}

const priceHistory = []; // Historial de precios

// Función para calcular media móvil simple
function calculateSMA(prices, period) {
  if (prices.length < period) return null; // No hay suficientes datos aún
  const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
}

// ✅ Monitorear precio y ejecutar compra/venta
async function checkMarket() {
  console.log("📡 Monitoreando el mercado...");

  const quote = await getParaswapQuote(TRADE_AMOUNT, USDT, WETH);
  if (!quote) return;

  const currentPrice =
    parseFloat(ethers.formatUnits(TRADE_AMOUNT, 6)) /
    parseFloat(ethers.formatUnits(quote.destAmount, 18));
  console.log(`📊 Precio actual: ${currentPrice.toFixed(6)} USDT/WETH`);

  priceHistory.push(currentPrice);
  if (priceHistory.length > 20) priceHistory.shift();

  const ma20 = calculateSMA(priceHistory, 20);
  console.log(
    ma20 ? `📉 MA-20: ${ma20.toFixed(6)} USDT/WETH` : "⏳ Calculando MA-20..."
  );

  if (lastPrice !== null && lastPrice !== undefined) {
    const change = ((currentPrice - lastPrice) / lastPrice) * 100;
    console.log(`📈 Cambio: ${change.toFixed(2)}%`);
  } else {
    console.log(`📈 Cambio: N/A (primer registro)`);
  }

  if (buyPrice !== null) {
    const priceChange = ((currentPrice - buyPrice) / buyPrice) * 100;
    console.log(`📈 Cambio desde la última compra: ${priceChange.toFixed(2)}%`);

    if (priceChange >= SELL_THRESHOLD) {
      console.log("🔴 Precio subió lo suficiente. Evaluando venta...");
      await sellWETH();
    } else if (priceChange <= STOP_LOSS_THRESHOLD) {
      console.log(
        "🚨 Stop-loss activado. Vendiendo para minimizar pérdidas..."
      );
      await sellWETH();
    }
  } else {
    if (!isTrading && lastPrice !== null) {
      const priceChange = ((currentPrice - lastPrice) / lastPrice) * 100;
      if (
        priceChange <= BUY_THRESHOLD &&
        ma20 !== null &&
        currentPrice > ma20
      ) {
        console.log(
          "🟢 Precio bajó lo suficiente y está sobre la MA-20. Comprando WETH..."
        );
        await buyWETH();
      } else {
        console.log("⚠️ Tendencia bajista detectada. Evitando compra.");
      }
    }
  }

  lastPrice = currentPrice;
  setTimeout(checkMarket, CHECK_INTERVAL);
}

async function initializeBot() {
  console.log("🔄 Iniciando bot de scalping...");

  // Consultar balances
  let usdtBalance = await getBalance(USDT, 6);
  let wethBalance = await getBalance(WETH, 18);

  console.log(`💰 Saldo USDT: ${usdtBalance} | Saldo WETH: ${wethBalance}`);

  if (parseFloat(wethBalance) > 0) {
    console.log(
      "⚠️ Hay WETH disponible, ejecutando venta antes de iniciar monitoreo..."
    );
    await sellWETH();
    isTrading = true; // Evitar que se intente comprar mientras se vende
  } else {
    console.log("✅ No hay WETH pendiente, iniciando monitoreo normal.");
  }

  isTrading = false;
  checkMarket(); // Iniciar el monitoreo después del chequeo
}

initializeBot();
