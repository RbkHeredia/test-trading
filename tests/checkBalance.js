require("dotenv").config();
const { ethers } = require("ethers");
const { provider, wallet } = require("../config/config");


/* async function testWalletConnection() {
    // Configurar proveedor de Alchemy
    const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_URL);

    // Conectar la billetera con el proveedor
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    // Obtener dirección y balance de la billetera
    const address = await wallet.getAddress();
    const balance = await provider.getBalance(address);

    console.log(`Dirección de la billetera: ${address}`);
    console.log(`Balance en MATIC: ${ethers.formatEther(balance)} MATIC`);
}

testWalletConnection().catch(console.error);
 */



async function checkWETHBalance() {
    try {
        console.log("🚀 Consultando balance de WETH...");

        const wethContract = new ethers.Contract(
            process.env.WETH_ADDRESS,
            ["function balanceOf(address owner) external view returns (uint256)"],
            provider
        );

        const balance = await wethContract.balanceOf(wallet.address);
        console.log(`💰 Balance de WETH: ${ethers.formatUnits(balance, 18)} WETH`);
    } catch (error) {
        console.error("❌ Error consultando balance de WETH:", error.message || error);
    }
}

checkWETHBalance();
