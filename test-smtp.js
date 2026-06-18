require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('--- SMTP Connection Test ---');
console.log('Using EMAIL_USER:', process.env.EMAIL_USER);
console.log('Using EMAIL_PASS length:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0);

const dns = require('dns');

async function runTest() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('ERROR: Missing EMAIL_USER or EMAIL_PASS in backend/.env');
    return;
  }

  // Auto-strip spaces like Gmail console App Passwords usually have
  const emailPassword = process.env.EMAIL_PASS.replace(/\s+/g, '');
  console.log('Sanitized password length:', emailPassword.length);

  console.log('Resolving smtp.gmail.com to IPv4...');
  dns.lookup('smtp.gmail.com', { family: 4 }, async (err, address) => {
    if (err || !address) {
      console.error('ERROR: DNS resolution failed:', err ? err.message : 'unknown');
      return;
    }
    console.log(`Resolved smtp.gmail.com to IPv4: ${address}`);

    const transporter = nodemailer.createTransport({
      host: address,
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: emailPassword
      },
      tls: {
        servername: 'smtp.gmail.com',
        rejectUnauthorized: false
      },
      debug: true,
      logger: true
    });

    const mailOptions = {
      from: `"Strategic Brand Solutions" <${process.env.EMAIL_USER}>`,
      to: 'akhilthadaka97@gmail.com, strategicbrandsolutions77@gmail.com',
      subject: 'Strategic Brand Solutions - SMTP Test Email',
      text: 'Success! Your backend email notification system is fully operational.'
    };

    try {
      console.log(`Connecting directly to ${address}:465...`);
      const info = await transporter.sendMail(mailOptions);
      console.log('SUCCESS: Email sent successfully!');
      console.log('Response:', info.response);
    } catch (error) {
      console.error('ERROR: Failed to send email.');
      console.error(error.message);
      if (error.message.includes('535') || error.message.includes('Username and Password not accepted')) {
        console.log('\n--- SMTP TROUBLESHOOTING HINT ---');
        console.log('Gmail rejected your credentials. This usually means:');
        console.log('1. You need to enable 2-Step Verification on your Google Account.');
        console.log('2. You need to generate an "App Password" specifically for this application.');
        console.log('   Go to: https://myaccount.google.com/security -> 2-Step Verification -> App passwords');
        console.log('3. Copy the 16-character code (without spaces) and paste it into backend/.env as EMAIL_PASS.');
        console.log('----------------------------------\n');
      }
    }
  });
}

runTest();
