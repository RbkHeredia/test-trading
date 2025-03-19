const { ethers } = require("ethers");
require("dotenv").config();
const axios = require("axios");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const paraswapAPI = "https://apiv5.paraswap.io";

// Tokens en Polygon
const USDT = process.env.USDT_ADDRESS;
const WETH = process.env.WETH_ADDRESS;

// Configuración del Scalping
const CHECK_INTERVAL = 30000;  // Verifica cada 30 segundos
const BUY_THRESHOLD = -0.04;    // Compra si cae -0.5%
const SELL_THRESHOLD = 0.04;    // Vende si sube +0.5%
const TRADE_AMOUNT = ethers.parseUnits("20", 6); // Compra con 20 USDT
let lastPrice = null;         // Último precio registrado
let isTrading = false;        // Previene transacciones simultáneas

// ✅ Obtener balance de un token
async function getBalance(tokenAddress, decimals = 18) {
    const tokenABI = ["function balanceOf(address owner) external view returns (uint256)"];
    const tokenContract = new ethers.Contract(tokenAddress, tokenABI, provider);

    try {
        const balance = await tokenContract.balanceOf(wallet.address);
        return ethers.formatUnits(balance, decimals);
    } catch (error) {
        console.error("❌ Error obteniendo balance:", error.message);
        return null;
    }
}

// ✅ Obtener cotización en ParaSwap
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

// ✅ Aprobar tokens antes del swap
async function approveToken(spender, amount, tokenAddress) {
    try {
        const tokenABI = ["function approve(address spender, uint256 amount) external returns (bool)"];
        const tokenContract = new ethers.Contract(tokenAddress, tokenABI, wallet);

        console.log(`🔹 Aprobando gasto de ${ethers.formatUnits(amount, 6)} en ${tokenAddress} para ${spender}...`);
        const tx = await tokenContract.approve(spender, amount);
        await tx.wait();
        console.log(`✅ Aprobación exitosa: ${tx.hash}`);
    } catch (error) {
        console.error("❌ Error al aprobar token:", error.message);
    }
}

// ✅ Comprar WETH con USDT
async function buyWETH() {
    if (isTrading) return;
    isTrading = true;
    
    console.log("🚀 Comprando WETH con USDT...");
    const quote = await getParaswapQuote(TRADE_AMOUNT, USDT, WETH);
    if (!quote) {
        isTrading = false;
        return;
    }

    await approveToken(quote.tokenTransferProxy, TRADE_AMOUNT, USDT);

    console.log("🔹 Ejecutando compra...");
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
    isTrading = false;
}

// ✅ Vender WETH por USDT (solo si hay ganancias)
async function sellWETH() {
    if (isTrading) return;
    isTrading = true;

    console.log("🚀 Vendiendo WETH por USDT...");
    const balanceWETH = await getBalance(WETH);
    if (!balanceWETH || parseFloat(balanceWETH) <= 0) {
        console.log("❌ No hay WETH suficiente para vender.");
        isTrading = false;
        return;
    }

    const amountIn = ethers.parseUnits(balanceWETH, 18);
    const quote = await getParaswapQuote(amountIn, WETH, USDT);
    if (!quote) {
        isTrading = false;
        return;
    }

    // 📌 Calcular ganancia esperada (incluyendo fees)
    const expectedUSDT = parseFloat(ethers.formatUnits(quote.destAmount, 6));
    const fees = 0.002; // Suponiendo 0.2% de comisiones
    const profit = expectedUSDT - (parseFloat(ethers.formatUnits(TRADE_AMOUNT, 6)) * (1 + fees));

    if (profit < 0) {
        console.log("❌ No hay ganancias en esta operación. Esperando mejor precio...");
        isTrading = false;
        return;
    }

    await approveToken(quote.tokenTransferProxy, amountIn, WETH);

    console.log("🔹 Ejecutando venta...");
    const txDataResponse = await axios.post(`${paraswapAPI}/transactions/137`, {
        srcToken: WETH,
        destToken: USDT,
        srcAmount: amountIn.toString(),
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
    isTrading = false;
}

// ✅ Monitorear precio y ejecutar compra/venta
async function checkMarket() {
    console.log("📡 Monitoreando el mercado...");

    const quote = await getParaswapQuote(TRADE_AMOUNT, USDT, WETH);
    if (!quote) return;

    const currentPrice = parseFloat(ethers.formatUnits(TRADE_AMOUNT, 6)) / parseFloat(ethers.formatUnits(quote.destAmount, 18));
    console.log(`📊 Precio actual: ${currentPrice} USDT/WETH`);

    if (lastPrice !== null) {
        console.log(`📉 Variación del precio: ${priceChange.toFixed(2)}%`);

        if (priceChange <= BUY_THRESHOLD) {
            console.log("🟢 Precio bajó lo suficiente. Comprando WETH...");
            await buyWETH();
        } else if (priceChange >= SELL_THRESHOLD) {
            console.log("🔴 Precio subió lo suficiente. Evaluando venta...");
            await sellWETH();
        }
    }

    lastPrice = currentPrice;
    setTimeout(checkMarket, CHECK_INTERVAL);
}

// ✅ Iniciar el bot de scalping
checkMarket();
