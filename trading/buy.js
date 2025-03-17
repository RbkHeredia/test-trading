const { router, wallet, provider } = require("../config/config");
const { sendEmail } = require("../utils/email");
const ethers = require("ethers");

async function buyToken(amountInUSDT) {
    const path = [process.env.WBNB_ADDRESS, process.env.WBNB_ADDRESS];
    const deadline = Math.floor(Date.now() / 1000) + 60 * 5;

    try {
        const tokenContract = new ethers.Contract(
            process.env.USDT_ADDRESS,
            ["function balanceOf(address owner) view returns (uint256)", "function approve(address spender, uint256 amount)"],
            wallet
        );
        // Verificar saldo en la billetera antes de comprar
        let balance = await tokenContract.balanceOf(wallet.address);
        if (balance < amountInUSDT) {
            console.log("❌ Saldo insuficiente para comprar.");
            await sendEmail("⚠️ Error en Compra", "Saldo insuficiente para realizar la compra.");
            return;
        }

        console.log(`🛒 Intentando comprar ${ethers.formatEther(amountInBNB)} BNB en tokens...`);

        const approveTx = await tokenContract.approve(process.env.PANCAKE_ROUTER, amountInUSDT);
        await approveTx.wait();
        console.log("✅ Aprobación de USDT realizada.");
        const tx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            amountInUSDT,
            0, // cantidad mínima de BNB (ajustar en producción)
            path,
            wallet.address,
            deadline,
            { gasLimit: 200000, gasPrice: ethers.parseUnits("5", "gwei") }
        );

        console.log(`✅ Compra exitosa de BNB: ${tx.hash}`);
        await sendEmail("🚀 Compra realizada", `Compra ejecutada con hash: ${tx.hash}`);
        await tx.wait();
    } catch (error) {
        console.error("❌ Error comprando tokens:", error);
        await sendEmail("❌ Error en Compra", `Hubo un error comprando el token: ${error.message}`);
    }
}

module.exports = { buyToken };
