const { buyToken } = require("../trading/buy");
require("dotenv").config();

async function testBuyToken() {
    try {
        console.log("🚀 Iniciando test de compra...");
        
        // Prueba con 10 USDT -> ETH en Polygon
        const amount = "10"; // 10 USDT
        const tokenIn = process.env.USDT_ADDRESS; 
        const tokenOut = process.env.WETH_ADDRESS; 
        const slippage = 0.5; // 0.5% de slippage

        await buyToken(amount, tokenIn, tokenOut, slippage);
        console.log("✅ Test de compra completado con éxito.");
    } catch (error) {
        console.error("❌ Error en el test de compra:", error.message || error);
    }
}

testBuyToken();
