require("dotenv").config();
const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

async function checkWalletBalance() {
  try {
    const balance = await provider.getBalance(wallet.address);
    console.log(`✅ Conexión exitosa. Saldo en BNB: ${ethers.formatEther(balance)} BNB`);
  } catch (error) {
    console.error("❌ Error verificando la conexión a la billetera:", error);
  }
}

checkWalletBalance();
