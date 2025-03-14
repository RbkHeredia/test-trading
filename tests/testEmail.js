require("dotenv").config();
const { sendEmail } = require("../utils/email");

async function testEmail() {
  console.log("📧 Enviando prueba de correo...");
  await sendEmail("🔍 Prueba de Email", "Este es un email de prueba para verificar la configuración.");
  console.log("✅ Email de prueba enviado con éxito.");
}

testEmail();