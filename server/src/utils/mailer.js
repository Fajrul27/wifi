const nodemailer = require("nodemailer");

/* =========================
   TRANSPORTER
========================= */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* =========================
   BASE SEND EMAIL
========================= */
const sendEmail = async ({ to, subject, html, text }) => {
  return transporter.sendMail({
    from: `"Auth System" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
};

/* =========================
   OTP EMAIL TEMPLATE
========================= */
const sendOTPEmail = async (email, otp, type = "OTP") => {
  const subject = `${type} Code`;

  const html = `
    <div style="font-family: Arial; padding: 20px;">
      <h2>${type}</h2>
      <p>Kode OTP kamu:</p>

      <div style="
        font-size: 24px;
        letter-spacing: 5px;
        font-weight: bold;
        padding: 10px;
        background: #f3f3f3;
        display: inline-block;
        border-radius: 8px;
      ">
        ${otp}
      </div>

      <p style="margin-top: 20px; color: gray;">
        OTP berlaku selama 10 menit.
      </p>
    </div>
  `;

  const text = `Kode ${type} kamu: ${otp}`;

  return sendEmail({
    to: email,
    subject,
    html,
    text,
  });
};

module.exports = {
  sendEmail,
  sendOTPEmail,
};