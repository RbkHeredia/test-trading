const { ethers } = require("ethers");
require("dotenv").config();
const { provider, wallet, router } = require("../config/config");
//si funciona pero no muestra cambio
async function swapTokens() {
  try {
      console.log("🚀 Intentando swap de 1 USDT a WETH en QuickSwap...");

      const amountIn = ethers.parseUnits("1", 6); // 1 USDT (6 decimales)
      const path = [process.env.USDT_ADDRESS, process.env.WETH_ADDRESS];
      const deadline = Math.floor(Date.now() / 1000) + 60 * 5; // 5 minutos

      console.log("📌 Datos para el swap:");
      console.log("  - Cantidad de entrada:", amountIn.toString());
      console.log("  - Dirección de USDT:", process.env.USDT_ADDRESS);
      console.log("  - Dirección de WETH:", process.env.WETH_ADDRESS);
      console.log("  - Deadline:", deadline);

      // Aprobar el gasto de USDT si es necesario
      const usdtContract = new ethers.Contract(
          process.env.USDT_ADDRESS,
          ["function approve(address spender, uint256 amount) external returns (bool)"],
          wallet
      );

      console.log("🔹 Aprobando USDT para el router...");
      const approveTx = await usdtContract.approve(process.env.QUICKSWAP_ROUTER, amountIn);
      await approveTx.wait();
      console.log("✅ USDT aprobado correctamente.");

      // Intentar hacer el swap
      console.log("🔹 Ejecutando swap...");
      const tx = await router.swapExactTokensForTokens(
          amountIn, // Cantidad de entrada
          0, // Cantidad mínima de salida (0 para prueba)
          path,
          wallet.address,
          deadline
      );

      await tx.wait();
      console.log("✅ Swap exitoso.");

  } catch (error) {
      console.error("❌ Error en el swap:", error.message || error);
  }
}

swapTokens();



/* async function checkTokenBalance() {
  const tokenABI = ["function balanceOf(address owner) external view returns (uint256)"];
  const usdtContract = new ethers.Contract(process.env.USDT_ADDRESS, tokenABI, provider);

  try {
      const balance = await usdtContract.balanceOf(wallet.address);
      console.log(`💰 Balance de USDT: ${ethers.formatUnits(balance, 6)} USDT`);
  } catch (error) {
      console.error("❌ Error obteniendo el balance de USDT:", error.message || error);
  }
}

checkTokenBalance(); */