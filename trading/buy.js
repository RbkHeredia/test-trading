const { router, wallet } = require("../config/config");
const { sendEmail } = require("../utils/email");
const ethers = require("ethers");

async function buyToken(amountInBNB) {
    const path = [process.env.WBNB_ADDRESS, process.env.TOKEN_ADDRESS];
    const deadline = Math.floor(Date.now() / 1000) + 60 * 5;

    try {
        const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
            0,
            path,
            wallet.address,
            deadline,
            { value: amountInBNB, gasLimit: 200000, gasPrice: ethers.utils.parseUnits("5", "gwei") }
        );

        console.log(`✅ Compra exitosa: ${tx.hash}`);
        await tx.wait();
    } catch (error) {
      console.error("❌ Error comprando tokens", error);
      await sendEmail("❌ Error en Compra", `Hubo un error comprando el token: ${error.message}`);
  }
}

module.exports = { buyToken };