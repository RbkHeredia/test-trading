const { ethers } = require("ethers");
require("dotenv").config();

const quickswapRouterAddress = process.env.QUICKSWAP_ROUTER.toLowerCase(); // Convertir a minúsculas
const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Verifica que la dirección tenga el formato correcto
console.log("📌 Dirección del Router QuickSwap:", quickswapRouterAddress);

const router = new ethers.Contract(
    quickswapRouterAddress,
    [
        "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
        "function getAmountsIn(uint amountOut, address[] memory path) external view returns (uint[] memory)",
        "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external",
        "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external"
    ],
    wallet
);

module.exports = { provider, wallet, router };
