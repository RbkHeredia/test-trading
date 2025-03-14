const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
      user: process.env.EMAIL_FROM,
      pass: process.env.EMAIL_SERVER_PASS,
  },
});

async function sendEmail(subject, message) {
  const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_FROM,
      subject: subject,
      text: message,
  };

  try {
      await transporter.sendMail(mailOptions);
      console.log("📧 Email enviado correctamente.");
  } catch (error) {
      console.error("❌ Error enviando el email:", error);
  }
}

module.exports = { sendEmail };