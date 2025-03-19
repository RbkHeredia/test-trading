const { ethers } = require("ethers");
require("dotenv").config();
const { provider } = require("../config/config");

async function checkBestPath() {
    const factoryAddress = "0x5757371414417b8c6caad45baef941abc7d3ab32"; // QuickSwap Factory
    const factoryABI = [
        "function getPair(address tokenA, address tokenB) external view returns (address pair)"
    ];

    const factory = new ethers.Contract(factoryAddress, factoryABI, provider);

    try {
        console.log("🔍 Buscando ruta de swap en QuickSwap...");

        // 1. USDT -> WETH
        let pair = await factory.getPair(process.env.USDT_ADDRESS, process.env.WETH_ADDRESS);
        if (pair !== ethers.ZeroAddress) {
            console.log(`✅ Ruta directa USDT → WETH encontrada: ${pair}`);
            return;
        }

        // 2. USDT -> WMATIC -> WETH
        pair = await factory.getPair(process.env.USDT_ADDRESS, "0x831753dd7087cac61ab5644b308642cc1c33dc13"); // WMATIC
        if (pair !== ethers.ZeroAddress) {
            pair = await factory.getPair("0x831753dd7087cac61ab5644b308642cc1c33dc13", process.env.WETH_ADDRESS);
            if (pair !== ethers.ZeroAddress) {
                console.log("✅ Ruta indirecta USDT → WMATIC → WETH encontrada.");
                return;
            }
        }

        console.log("❌ No se encontró una ruta válida en QuickSwap.");
    } catch (error) {
        console.error("❌ Error verificando rutas en QuickSwap:", error.message || error);
    }
}

checkBestPath();
