const { ethers } = require("ethers");
require("dotenv").config();
const axios = require("axios");

// Función para obtener el precio del gas en tiempo real desde Polygonscan
async function getFastGasPrice() {
    try {
        const response = await axios.get("https://api.polygonscan.com/api", {
            params: {
                module: "gastracker",
                action: "gasoracle",
                apikey: process.env.ETHERSCAN_API_KEY, // API Key de Polygonscan
            },
        });

        if (response.data.status !== "1") {
            throw new Error(`API Error: ${response.data.message}`);
        }

        const gasPriceGwei = response.data.result.FastGasPrice;
        console.log(`⛽ Fast Gas Price: ${gasPriceGwei} Gwei`);
        return ethers.parseUnits(gasPriceGwei, "gwei");
    } catch (error) {
        console.error("⚠️ Error obteniendo gas price:", error.message);
        return null;
    }
}

// Función de prueba
(async () => {
    console.log("🔍 Obteniendo Fast Gas Price...");
    const gasPrice = await getFastGasPrice();
    if (gasPrice) {
        console.log(`✅ Gas Price en Wei: ${gasPrice.toString()}`);
        console.log(`✅ Gas Price en Gwei: ${ethers.formatUnits(gasPrice, "gwei")} Gwei`);
    } else {
        console.log("❌ No se pudo obtener el gas price.");
    }
})();
