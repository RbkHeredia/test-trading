const { router, wallet, provider } = require("../config/config");
const { sendEmail } = require("../utils/email");
const ethers = require("ethers");

async function sellToken() {
    const path = [process.env.TOKEN_ADDRESS, process.env.WBNB_ADDRESS];
    const tokenContract = new ethers.Contract(
        process.env.TOKEN_ADDRESS,
        ["function balanceOf(address owner) view returns (uint256)", "function approve(address spender, uint256 amount)"],
        wallet
    );

    try {
        console.log("🔍 Verificando saldo de tokens para vender...");
        
        // ✅ Convertir balance a BigInt y verificar si hay tokens
        let balance = await tokenContract.balanceOf(wallet.address);
        balance = BigInt(balance.toString()); // Convertir a BigInt

        let attempts = 0;
        while (balance === BigInt(0) && attempts < 5) {  // Reintentar hasta 5 veces
            console.log("⏳ Esperando tokens en la billetera...");
            await new Promise(resolve => setTimeout(resolve, 5000));  // Espera 5 segundos
            balance = await tokenContract.balanceOf(wallet.address);
            balance = BigInt(balance.toString()); // Convertir a BigInt
            attempts++;
        }

        if (balance === BigInt(0)) {
            console.log("❌ No hay tokens para vender.");
            await sendEmail("⚠️ Error en Venta", "No hay tokens disponibles para vender.");
            return;
        }

        console.log(`🔄 Intentando vender ${ethers.formatUnits(balance, 18)} tokens...`);

        // ✅ Aprobar tokens antes de vender
        const approveTx = await tokenContract.approve(process.env.PANCAKE_ROUTER, balance);
        await approveTx.wait();
        console.log("✅ Aprobación de tokens realizada.");

        // ✅ Ejecutar la venta
        const deadline = Math.floor(Date.now() / 1000) + 60 * 5;
        const tx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            balance,
            0, // Cantidad mínima de BNB (ajustar en producción)
            path,
            wallet.address,
            deadline,
            { gasLimit: 200000, gasPrice: ethers.parseUnits("5", "gwei") }
        );

        console.log(`✅ Venta exitosa: ${tx.hash}`);
        await sendEmail("💰 Venta Exitosa", `Se ha vendido el token con hash: ${tx.hash}`);
        await tx.wait();
    } catch (error) {
        console.error("❌ Error vendiendo tokens:", error);
        await sendEmail("❌ Error en Venta", `Hubo un error vendiendo el token: ${error.message}`);
    }
}

module.exports = { sellToken };
