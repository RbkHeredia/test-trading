require("dotenv").config();
const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const router = new ethers.Contract(
    process.env.PANCAKE_ROUTER,
    [
        "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
        "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable",
        "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external"
    ],
    wallet
);

module.exports = { provider, wallet, router };