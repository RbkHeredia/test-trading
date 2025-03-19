const { ethers } = require("ethers");
require("dotenv").config();
const axios = require("axios");
const { sendEmail } = require("../utils/email");
const { getBalance } = require("../trading/getBallance");
const { getParaswapQuote } = require("../trading/getParaswap");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const paraswapAPI = "https://apiv5.paraswap.io";

// Tokens en Polygon
const USDT = process.env.USDT_ADDRESS;
const WETH = process.env.WETH_ADDRESS;

// Configuración del Scalping
const CHECK_INTERVAL = 30000;  // Verifica cada 30 segundos
const BUY_THRESHOLD = -0.04;    // Compra si cae -4%
const SELL_THRESHOLD = 0.04;    // Vende si sube +4%
const STOP_LOSS_THRESHOLD = -0.05;
const TRADE_AMOUNT = ethers.parseUnits("20", 6); // Compra con 20 USDT
let lastPrice = null;         // Último precio registrado
let isTrading = false;        // Previene transacciones simultáneas



// ✅ Aprobar tokens antes del swap
/* async function approveToken(spender, amount, tokenAddress) {
    try {
        const tokenABI = ["function approve(address spender, uint256 amount) external returns (bool)"];
        const tokenContract = new ethers.Contract(tokenAddress, tokenABI, wallet);

        console.log(`🔹 Aprobando gasto de ${ethers.formatUnits(amount, 6)} en ${tokenAddress} para ${spender}...`);
        const tx = await tokenContract.approve(spender, amount.toString());
        await tx.wait();
        console.log(`✅ Aprobación exitosa: ${tx.hash}`);
    } catch (error) {
        console.error("❌ Error al aprobar token:", error.reason || error.message || error);
    }
} */


// ✅ Comprar WETH con USDT
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

    console.log("🔹 Verificando variación de precio antes de ejecutar la compra...");
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
        console.log("❌ No se pudo obtener una cotización estable, cancelando compra.");
        isTrading = false;
        return;
    }

    console.log("🔹 Ejecutando compra...");
    try {
        const txDataResponse = await axios.post(`${paraswapAPI}/transactions/137`, {
            srcToken: USDT,
            destToken: WETH,
            srcAmount: TRADE_AMOUNT.toString(),
            destAmount: quote.destAmount,
            priceRoute: quote,
            userAddress: wallet.address
        }, { headers: { 'X-Partner': 'anon', 'User-Agent': 'Mozilla/5.0' } });

        const txData = txDataResponse.data;
        const tx = await wallet.sendTransaction({
            to: txData.to,
            data: txData.data,
            value: txData.value ? ethers.parseUnits(txData.value, "wei") : 0,
            gasLimit: txData.gas,
            gasPrice: txData.gasPrice ? ethers.parseUnits(txData.gasPrice, "wei") : undefined
        });

        console.log(`📌 Compra enviada: ${tx.hash}`);
        await tx.wait();
        console.log("✅ Compra exitosa.");
    } catch (error) {
        console.error("❌ Error al ejecutar la compra:", error.response?.data || error.message);
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

    let quote;
    let retries = 3;
    while (retries > 0) {
        quote = await getParaswapQuote(ethers.parseUnits(balanceWETH, 18), WETH, USDT);
        if (quote) break;
        console.log("⚠️ Error en la cotización, reintentando...");
        retries--;
    }
    if (!quote) {
        console.log("❌ No se pudo obtener una cotización válida.");
        return;
    }

    // 🔹 Revalidar el precio justo antes del swap
    console.log("🔹 Verificando variación de precio antes de ejecutar la venta...");
    let newQuote;
    retries = 3;
    while (retries > 0) {
        newQuote = await getParaswapQuote(ethers.parseUnits(balanceWETH, 18), WETH, USDT);
        if (newQuote && newQuote.destAmount === quote.destAmount) break;
        console.warn("⚠️ El precio cambió, volviendo a cotizar...");
        quote = newQuote;
        retries--;
    }

    if (!newQuote) {
        console.log("❌ No se pudo obtener una cotización estable, cancelando venta.");
        return;
    }

    console.log("🔹 Ejecutando venta...");
    try {
        const txDataResponse = await axios.post(`${paraswapAPI}/transactions/137`, {
            srcToken: WETH,
            destToken: USDT,
            srcAmount: ethers.parseUnits(balanceWETH, 18).toString(),
            destAmount: quote.destAmount,
            priceRoute: quote,
            userAddress: wallet.address
        }, { headers: { 'X-Partner': 'anon', 'User-Agent': 'Mozilla/5.0' } });

        const txData = txDataResponse.data;
        const tx = await wallet.sendTransaction({
            to: txData.to,
            data: txData.data,
            value: txData.value ? ethers.parseUnits(txData.value, "wei") : 0,
            gasLimit: txData.gas,
            gasPrice: txData.gasPrice ? ethers.parseUnits(txData.gasPrice, "wei") : undefined
        });

        console.log(`📌 Venta enviada: ${tx.hash}`);
        await tx.wait();
        console.log("✅ Venta exitosa.");
        sendEmail('Venta exitosa', `Se ha realizado la venta ${tx.hash}`);
    } catch (error) {
        console.error("❌ Error al ejecutar la venta:", error.response?.data || error.message);
        sendEmail('Error al ejecutar la venta', `${error.response?.data || error.message}`);
    }
}




// ✅ Monitorear precio y ejecutar compra/venta
async function checkMarket() {
    console.log("📡 Monitoreando el mercado...");

    const quote = await getParaswapQuote(TRADE_AMOUNT, USDT, WETH);
    if (!quote) return;

    const currentPrice = parseFloat(ethers.formatUnits(TRADE_AMOUNT, 6)) / parseFloat(ethers.formatUnits(quote.destAmount, 18));
    console.log(`📊 Precio actual: ${currentPrice.toFixed(6)} USDT/WETH`);

    await sellWETH();


    lastPrice = currentPrice;
    setTimeout(checkMarket, CHECK_INTERVAL);
}

// ✅ Iniciar el bot de scalping
checkMarket();
