const { router, wallet, provider } = require("../config/config");
const { sendEmail } = require("../utils/email");
const ethers = require("ethers");

async function buyToken(amountInBNB) {
    const path = [process.env.WBNB_ADDRESS, process.env.TOKEN_ADDRESS];
    const deadline = Math.floor(Date.now() / 1000) + 60 * 5;

    try {
        // Verificar saldo en la billetera antes de comprar
        const balance = await provider.getBalance(wallet.address);
        if (balance < amountInBNB) {
            console.log("❌ Saldo insuficiente para comprar.");
            await sendEmail("⚠️ Error en Compra", "Saldo insuficiente para realizar la compra.");
            return;
        }

        console.log(`🛒 Intentando comprar ${ethers.formatEther(amountInBNB)} BNB en tokens...`);

        const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
            0, // Cantidad mínima de tokens (ajustar en producción)
            path,
            wallet.address,
            deadline,
            { value: amountInBNB, gasLimit: 200000, gasPrice: ethers.parseUnits("5", "gwei") }
        );

        console.log(`✅ Compra exitosa: ${tx.hash}`);
        await tx.wait();
    } catch (error) {
        console.error("❌ Error comprando tokens:", error);
        await sendEmail("❌ Error en Compra", `Hubo un error comprando el token: ${error.message}`);
    }
}

module.exports = { buyToken };
