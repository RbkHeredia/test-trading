const { ethers } = require("ethers");
require("dotenv").config();
const { provider, wallet, router } = require("../config/config");

async function swapTokens() {
  try {
    console.log("🚀 Intentando swap de 1 USDT a WETH en QuickSwap...");

    const amountIn = ethers.parseUnits("1", 6); // 1 USDT (6 decimales)
    const path = [
      process.env.USDT_ADDRESS,  
      "0x831753dd7087cac61ab5644b308642cc1c33dc13", // WMATIC (token intermedio)
      process.env.WETH_ADDRESS   
  ];
    const deadline = Math.floor(Date.now() / 1000) + 60 * 5; // 5 minutos

    console.log("📌 Datos para el swap:");
    console.log("  - Cantidad de entrada:", amountIn.toString());
    console.log("  - Dirección de USDT:", process.env.USDT_ADDRESS);
    console.log("  - Dirección de WETH:", process.env.WETH_ADDRESS);
    console.log("  - Deadline:", deadline);

    // Aprobar el gasto de USDT si es necesario
    const usdtContract = new ethers.Contract(
      process.env.USDT_ADDRESS,
      [
        "function approve(address spender, uint256 amount) external returns (bool)",
      ],
      wallet
    );

    try {
      console.log("🔹 Aprobando USDT para el router...");
      const approveTx = await usdtContract.approve(
        process.env.QUICKSWAP_ROUTER,
        amountIn
      );
      console.log(`📌 Transacción de aprobación enviada: ${approveTx.hash}`);
      await approveTx.wait();
      console.log("✅ USDT aprobado correctamente.");
    } catch (error) {
      console.error(
        "❌ Error al aprobar USDT:",
        error.reason || error.message || error
      );
      return; // Detener ejecución si falla la aprobación
    }

    // Intentar hacer el swap
    try {
      console.log("🔹 Ejecutando swap...");
      const amounts = await router.getAmountsOut(amountIn, path);

      // Aplicar un slippage del 1% para evitar recibir menos de lo esperado
      const amountOutMin = amounts[1].mul(99).div(100);

      const tx = await router.swapExactTokensForTokens(
        amountIn,
        amountOutMin, // Ahora tiene un valor real
        path,
        wallet.address,
        deadline
      );

      console.log(`📌 Transacción de swap enviada: ${tx.hash}`);
      const receipt = await tx.wait();

      if (receipt.status === 1) {
        console.log("✅ Swap exitoso.");
      } else {
        console.error("❌ Swap fallido. La transacción fue revertida.");
      }
    } catch (error) {
      console.error(
        "❌ Error en el swap:",
        error.reason || error.message || error
      );
    }
  } catch (error) {
    console.error("❌ Error general:", error.reason || error.message || error);
  }
}

// Ejecutar el swap
swapTokens();
