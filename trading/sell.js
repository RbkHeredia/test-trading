const { router, wallet } = require("../config/config");
const { sendEmail } = require("../utils/email");
const ethers = require("ethers");

async function sellToken() {
    const path = [process.env.TOKEN_ADDRESS, process.env.WBNB_ADDRESS];
    const tokenContract = new ethers.Contract(process.env.TOKEN_ADDRESS, ["function balanceOf(address owner) view returns (uint)", "function approve(address spender, uint256 amount)"], wallet);
    
    const balance = await tokenContract.balanceOf(wallet.address);
    if (balance.eq(0)) {
        console.log("❌ No hay tokens para vender.");
        return;
    }

    const deadline = Math.floor(Date.now() / 1000) + 60 * 5;

    try {
        await tokenContract.approve(process.env.PANCAKE_ROUTER, balance);
        console.log("✅ Aprobación de tokens para vender realizada.");

        const tx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            balance,
            0,
            path,
            wallet.address,
            deadline,
            { gasLimit: 200000, gasPrice: ethers.utils.parseUnits("5", "gwei") }
        );

        console.log(`✅ Venta exitosa: ${tx.hash}`);
        await sendEmail("💰 Venta Exitosa", `Se ha vendido el token con hash: ${tx.hash}`);
        await tx.wait();
    } catch (error) {
        console.error("❌ Error vendiendo tokens", error);
        await sendEmail("❌ Error en Venta", `Hubo un error vendiendo el token: ${error.message}`);
    }
}

module.exports = { sellToken };