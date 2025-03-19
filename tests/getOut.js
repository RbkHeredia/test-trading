const { ethers } = require("ethers");
require("dotenv").config();
const axios = require("axios");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const paraswapAPI = "https://apiv5.paraswap.io";  // Versión más estable

const USDT = process.env.USDT_ADDRESS;
const WETH = process.env.WETH_ADDRESS;

// ✅ Obtener cotización desde ParaSwap
async function getParaswapQuote(amountIn) {
    const url = `${paraswapAPI}/prices/?srcToken=${USDT}&destToken=${WETH}&amount=${amountIn}&network=137`;
    
    try {
        const response = await axios.get(url, {
            headers: { 
                'X-Partner': 'anon',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', // Simula un navegador
                'Accept': 'application/json',
                'Origin': 'https://app.paraswap.io'  // Simula una solicitud legítima
            }
        });
        console.log("🚀 Cotización obtenida:", response.data);
        return response.data.priceRoute;
    } catch (error) {
        console.error("❌ Error obteniendo cotización en ParaSwap:", error.response?.data || error.message);
        return null;
    }
}

// ✅ Aprobar tokens antes del swap
async function approveToken(spender, amount) {
    if (!spender) {
        console.error("❌ Error: Spender no válido.");
        return;
    }

    try {
        const tokenABI = [
            "function approve(address spender, uint256 amount) external returns (bool)"
        ];
        const tokenContract = new ethers.Contract(USDT, tokenABI, wallet);

        console.log(`🔹 Aprobando gasto de ${ethers.formatUnits(amount, 6)} USDT para ${spender}...`);
        const tx = await tokenContract.approve(spender, amount);
        await tx.wait();
        console.log(`✅ Aprobación exitosa: ${tx.hash}`);
    } catch (error) {
        console.error("❌ Error al aprobar USDT:", error.message);
    }
}

// ✅ Ejecutar swap en ParaSwap
async function swapTokens() {
    try {
        console.log("🚀 Intentando swap de 1 USDT a WETH en ParaSwap...");

        const amountIn = ethers.parseUnits("1", 6);
        const quote = await getParaswapQuote(amountIn);
        if (!quote) return;

        const spender = quote.tokenTransferProxy;
        if (!spender) {
            console.error("❌ Error: `spender` no definido.");
            return;
        }

        // Aprobar el gasto del token
        await approveToken(spender, amountIn);

        console.log("🔹 Obteniendo datos de la transacción...");

        // 📌 Solicitar la transacción sin API Key
        const txDataResponse = await axios.post(`${paraswapAPI}/transactions/137`, {
            srcToken: USDT,
            destToken: WETH,
            srcAmount: amountIn.toString(),
            destAmount: quote.destAmount,
            priceRoute: quote,
            userAddress: wallet.address
        }, {
            headers: { 
                'X-Partner': 'anon',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': 'application/json',
                'Origin': 'https://app.paraswap.io'
            }
        });

        const txData = txDataResponse.data;
        console.log("📌 Datos de la transacción:", txData);

        // 📌 Enviar la transacción con ethers.js
        const tx = await wallet.sendTransaction({
            to: txData.to,
            data: txData.data,
            value: txData.value ? ethers.parseUnits(txData.value, "wei") : 0,
            gasLimit: txData.gas,
            gasPrice: txData.gasPrice ? ethers.parseUnits(txData.gasPrice, "wei") : undefined
        });

        console.log(`📌 Transacción enviada: ${tx.hash}`);
        await tx.wait();
        console.log("✅ Swap exitoso.");
    } catch (error) {
        console.error("❌ Error en el swap:", error.response?.data || error.message);
    }
}

// ✅ Ejecutar el swap
swapTokens();
