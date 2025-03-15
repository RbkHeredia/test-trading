const { wallet, provider } = require("../config/config");
const ethers = require("ethers");

async function checkBalance() {
    try {
        console.log("🔍 Verificando saldo en la billetera...");

        // ✅ Obtener saldo en BNB
        const balanceBNB = await provider.getBalance(wallet.address);
        console.log(`💰 Saldo en BNB: ${ethers.formatEther(balanceBNB)} BNB`);

        // ✅ Obtener saldo del token a tradear
        const tokenContract = new ethers.Contract(
            process.env.TOKEN_ADDRESS,
            ["function balanceOf(address owner) view returns (uint)"],
            wallet
        );

        const tokenBalance = await tokenContract.balanceOf(wallet.address);
        console.log(`🔹 Saldo de Tokens: ${ethers.formatEther(tokenBalance)} ${process.env.TOKEN_SYMBOL}`);

    } catch (error) {
        console.error("❌ Error obteniendo saldo:", error);
    }
}

// Ejecutar la función
checkBalance();

