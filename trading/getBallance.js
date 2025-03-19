const { ethers } = require("ethers");
require("dotenv").config();
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);


const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

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

module.exports = { getBalance };
