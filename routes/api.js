const express = require('express');
const router = express.Router();
const Application = require('../models/Application');
const Agreement = require('../models/Agreement');
const { verifyAdmin } = require('../middleware/auth');
const jwt = require('jsonwebtoken');


const nodemailer = require('nodemailer');
const dns = require('dns');

let cachedSmtpIp = null;

function resolveSmtpHost() {
  dns.lookup('smtp.gmail.com', { family: 4 }, (err, address) => {
    if (!err && address) {
      cachedSmtpIp = address;
      console.log(`SMTP host resolved and cached: ${cachedSmtpIp}`);
    } else {
      console.error('Failed to resolve SMTP host:', err ? err.message : 'unknown error');
    }
  });
}

// Resolve SMTP host IP at startup and refresh it every 10 minutes
resolveSmtpHost();
setInterval(resolveSmtpHost, 10 * 60 * 1000);

const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || 'akhilthadaka97@gmail.com';
const frontendUrl = process.env.FRONTEND_URL || 'https://client-registration-portal.vercel.app';

function getTransporter() {
  const emailPassword = process.env.EMAIL_PASS.replace(/\s+/g, '');
  const host = cachedSmtpIp || 'smtp.gmail.com';
  return nodemailer.createTransport({
    host: host,
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: emailPassword
    },
    tls: {
      servername: 'smtp.gmail.com',
      rejectUnauthorized: false
    }
  });
}

// Send application submission emails to both Admin and Client
async function sendApplicationEmails(appData) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('SMTP credentials missing. Skipping application email dispatch.');
    try {
      await Application.findByIdAndUpdate(appData._id, {
        emailSentToAdmin: 'Failed',
        emailSentToClient: 'Failed',
        emailError: 'SMTP credentials missing in backend/.env'
      });
    } catch (dbErr) {
      console.error(dbErr);
    }
    return;
  }

  const transporter = getTransporter();

  // HTML content for Admin Notification
  const adminHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0c0e; color: #d1d5db; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #121215; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
        .header { background: linear-gradient(135deg, #18181b 0%, #09090b 100%); padding: 30px 24px; border-bottom: 2px solid #ff6b00; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; }
        .header p { color: #ff6b00; margin: 5px 0 0 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
        .content { padding: 24px; }
        .intro { font-size: 14px; line-height: 1.6; color: #a1a1aa; margin-top: 0; }
        .detail-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .detail-table td { padding: 12px; border-bottom: 1px solid #27272a; font-size: 14px; vertical-align: top; }
        .detail-table td.label { color: #82828c; font-weight: 600; width: 35%; }
        .detail-table td.value { color: #f4f4f5; font-weight: 500; }
        .badge { display: inline-block; padding: 2px 8px; background-color: rgba(255, 107, 0, 0.15); color: #ff6b00; border: 1px solid rgba(255, 107, 0, 0.25); border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .footer { background-color: #18181b; padding: 16px 24px; text-align: center; border-top: 1px solid #27272a; font-size: 11px; color: #71717a; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Strategic Brand Solutions</h1>
          <p>New Client Registration</p>
        </div>
        <div class="content">
          <p class="intro">A new client application has been submitted through the onboarding portal. Below are the registration details:</p>
          
          <table class="detail-table">
            <tr>
              <td class="label">Full Name</td>
              <td class="value">${appData.fullName}</td>
            </tr>
            <tr>
              <td class="label">Study/Occupation</td>
              <td class="value">${appData.studyOccupation}</td>
            </tr>
            <tr>
              <td class="label">Cell Number</td>
              <td class="value">${appData.cellNumber}</td>
            </tr>
            <tr>
              <td class="label">Email Address</td>
              <td class="value">${appData.emailAddress}</td>
            </tr>
            <tr>
              <td class="label">Pincode</td>
              <td class="value">${appData.pincode}</td>
            </tr>
            <tr>
              <td class="label">Project Category</td>
              <td class="value"><span class="badge">${appData.projectType}</span></td>
            </tr>
            <tr>
              <td class="label">Page Count</td>
              <td class="value">${appData.pageCount}</td>
            </tr>
            <tr>
              <td class="label">Website Purpose</td>
              <td class="value" style="white-space: pre-wrap; line-height: 1.5;">${appData.websitePurpose}</td>
            </tr>
            <tr>
              <td class="label">Why Choose Me</td>
              <td class="value">${appData.whyChooseMe ? appData.whyChooseMe.join(', ') : 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">Additional Notes</td>
              <td class="value" style="white-space: pre-wrap; line-height: 1.5;">${appData.additionalNotes || 'N/A'}</td>
            </tr>
          </table>
        </div>
        <div class="footer">
          Submitted at ${new Date(appData.submittedAt).toLocaleString()} • SBS System Alert
        </div>
      </div>
    </body>
    </html>
  `;

  // HTML content for Client Confirmation Receipt
  const clientHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0c0e; color: #d1d5db; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #121215; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
        .header { background: linear-gradient(135deg, #18181b 0%, #09090b 100%); padding: 30px 24px; border-bottom: 2px solid #ff6b00; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; }
        .header p { color: #ff6b00; margin: 5px 0 0 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
        .content { padding: 24px; }
        .greeting { font-size: 16px; font-weight: 700; color: #ffffff; margin-top: 0; }
        .message { font-size: 14px; line-height: 1.6; color: #a1a1aa; }
        .summary-card { background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 18px; margin: 20px 0; }
        .summary-title { font-size: 12px; font-weight: 700; color: #ff6b00; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; border-bottom: 1px solid #27272a; padding-bottom: 8px; }
        .detail-row { display: flex; justify-content: space-between; font-size: 13px; margin: 8px 0; }
        .detail-label { color: #71717a; }
        .detail-val { color: #e4e4e7; font-weight: 600; }
        .next-steps { font-size: 14px; line-height: 1.6; color: #a1a1aa; margin: 20px 0; }
        .next-steps h3 { font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 8px; }
        .next-steps ul { padding-left: 20px; margin: 8px 0; }
        .next-steps li { margin: 6px 0; }
        .footer { background-color: #18181b; padding: 20px 24px; text-align: center; border-top: 1px solid #27272a; font-size: 11px; color: #71717a; }
        .footer a { color: #ff6b00; text-decoration: none; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Strategic Brand Solutions</h1>
          <p>Application Received 🎉</p>
        </div>
        <div class="content">
          <p class="greeting">Dear ${appData.fullName},</p>
          <p class="message">Thank you for submitting your client application form. We are thrilled at the prospect of collaborating on your new digital portal. Below is a receipt of the parameters we received:</p>
          
          <div class="summary-card">
            <div class="summary-title">Your Submission Details</div>
            <div class="detail-row">
              <span class="detail-label">Project Type</span>
              <span class="detail-val">${appData.projectType}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Page Count</span>
              <span class="detail-val">${appData.pageCount}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Cell Number</span>
              <span class="detail-val">${appData.cellNumber}</span>
            </div>
          </div>

          <div class="next-steps">
            <h3>What Happens Next?</h3>
            <ul>
              <li><strong>Review:</strong> Our developers are currently reviewing your project parameters (takes up to 24 hours).</li>
              <li><strong>Signing:</strong> If you haven't signed the <a href="${frontendUrl}/agreement" style="color: #ff6b00; font-weight: 600;">Service Agreement</a>, please review and submit it.</li>
              <li><strong>Onboarding:</strong> We will reach out to schedule a planning briefing.</li>
            </ul>
          </div>
        </div>
        <div class="footer">
          Strategic Brand Solutions Team • <a href="mailto:akhilthadaka97@gmail.com">Contact Support</a>
        </div>
      </div>
    </body>
    </html>
  `;

  // Email to Admin
  const adminMailOptions = {
    from: `"Strategic Brand Solutions" <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: `Strategic Brand Solutions - New Client Application: ${appData.fullName}`,
    text: `A new client application has been submitted by ${appData.fullName}.`,
    html: adminHtml
  };

  // Email to Client
  const clientMailOptions = {
    from: `"Strategic Brand Solutions" <${process.env.EMAIL_USER}>`,
    to: appData.emailAddress,
    subject: 'Strategic Brand Solutions - Application Received! 🎉',
    text: `Dear ${appData.fullName}, Thank you for submitting your client application form to Strategic Brand Solutions. We have successfully received your details.`,
    html: clientHtml
  };

  let adminStatus = 'Sent';
  let clientStatus = 'Sent';
  let errorMsg = null;

  try {
    await transporter.sendMail(adminMailOptions);
    console.log(`Application alert sent to Admin: ${adminEmail}`);
  } catch (err) {
    console.error('Nodemailer error sending application email to Admin:', err.message);
    adminStatus = 'Failed';
    errorMsg = `Admin Email: ${err.message}`;
  }

  try {
    await transporter.sendMail(clientMailOptions);
    console.log(`Application receipt sent to Client: ${appData.emailAddress}`);
  } catch (err) {
    console.error('Nodemailer error sending application email to Client:', err.message);
    clientStatus = 'Failed';
    const clientErr = `Client Email: ${err.message}`;
    errorMsg = errorMsg ? `${errorMsg}; ${clientErr}` : clientErr;
  }

  try {
    await Application.findByIdAndUpdate(appData._id, {
      emailSentToAdmin: adminStatus,
      emailSentToClient: clientStatus,
      emailError: errorMsg
    });
  } catch (dbErr) {
    console.error('Failed to update email status in database:', dbErr.message);
  }
}

// Send agreement signing emails to both Admin and Client
async function sendAgreementEmails(agreementData) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('SMTP credentials missing. Skipping agreement email dispatch.');
    try {
      await Agreement.findByIdAndUpdate(agreementData._id, {
        emailSentToAdmin: 'Failed',
        emailSentToClient: 'Failed',
        emailError: 'SMTP credentials missing in backend/.env'
      });
    } catch (dbErr) {
      console.error(dbErr);
    }
    return;
  }

  const transporter = getTransporter();

  // HTML content for Admin Notification
  const adminAgreementHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0c0e; color: #d1d5db; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #121215; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
        .header { background: linear-gradient(135deg, #18181b 0%, #09090b 100%); padding: 30px 24px; border-bottom: 2px solid #10b981; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; }
        .header p { color: #10b981; margin: 5px 0 0 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
        .content { padding: 24px; }
        .intro { font-size: 14px; line-height: 1.6; color: #a1a1aa; margin-top: 0; }
        .detail-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .detail-table td { padding: 12px; border-bottom: 1px solid #27272a; font-size: 14px; }
        .detail-table td.label { color: #82828c; font-weight: 600; width: 35%; }
        .detail-table td.value { color: #f4f4f5; font-weight: 500; }
        .badge { display: inline-block; padding: 2px 8px; background-color: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .footer { background-color: #18181b; padding: 16px 24px; text-align: center; border-top: 1px solid #27272a; font-size: 11px; color: #71717a; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Strategic Brand Solutions</h1>
          <p>Agreement Signed 📄</p>
        </div>
        <div class="content">
          <p class="intro">A client has signed and authorized the Service Agreement via the onboarding portal. Signee details:</p>
          
          <table class="detail-table">
            <tr>
              <td class="label">Full Name</td>
              <td class="value">${agreementData.fullName}</td>
            </tr>
            <tr>
              <td class="label">Email Address</td>
              <td class="value">${agreementData.email}</td>
            </tr>
            <tr>
              <td class="label">IP Address</td>
              <td class="value">${agreementData.ipAddress || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">Signature Date</td>
              <td class="value">${new Date(agreementData.signatureDate).toLocaleString()}</td>
            </tr>
            <tr>
              <td class="label">Consent Status</td>
              <td class="value"><span class="badge">Acknowledged & Agreed</span></td>
            </tr>
          </table>
        </div>
        <div class="footer">
          Signed at ${new Date(agreementData.signatureDate).toLocaleString()} • SBS System Alert
        </div>
      </div>
    </body>
    </html>
  `;

  // HTML content for Client Confirmation Receipt
  const clientAgreementHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0c0e; color: #d1d5db; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #121215; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
        .header { background: linear-gradient(135deg, #18181b 0%, #09090b 100%); padding: 30px 24px; border-bottom: 2px solid #ff6b00; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; }
        .header p { color: #ff6b00; margin: 5px 0 0 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
        .content { padding: 24px; }
        .greeting { font-size: 16px; font-weight: 700; color: #ffffff; margin-top: 0; }
        .message { font-size: 14px; line-height: 1.6; color: #a1a1aa; }
        .summary-card { background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 18px; margin: 20px 0; }
        .summary-title { font-size: 12px; font-weight: 700; color: #ff6b00; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; border-bottom: 1px solid #27272a; padding-bottom: 8px; }
        .detail-row { display: flex; justify-content: space-between; font-size: 13px; margin: 8px 0; }
        .detail-label { color: #71717a; }
        .detail-val { color: #e4e4e7; font-weight: 600; }
        .next-steps { font-size: 14px; line-height: 1.6; color: #a1a1aa; margin: 20px 0; }
        .next-steps h3 { font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 8px; }
        .next-steps ul { padding-left: 20px; margin: 8px 0; }
        .next-steps li { margin: 6px 0; }
        .footer { background-color: #18181b; padding: 20px 24px; text-align: center; border-top: 1px solid #27272a; font-size: 11px; color: #71717a; }
        .footer a { color: #ff6b00; text-decoration: none; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Strategic Brand Solutions</h1>
          <p>Agreement Signed Copies 📄</p>
        </div>
        <div class="content">
          <p class="greeting">Dear ${agreementData.fullName},</p>
          <p class="message">Thank you for signing the Service Agreement. A secure copy of the legal signature and consent has been stored in our system. Below is a copy of your signee details:</p>
          
          <div class="summary-card">
            <div class="summary-title">Signed Service Details</div>
            <div class="detail-row">
              <span class="detail-label">Signee Name</span>
              <span class="detail-val">${agreementData.fullName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Email Address</span>
              <span class="detail-val">${agreementData.email}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Consent Status</span>
              <span class="detail-val" style="color: #10b981;">Authorized & Legal</span>
            </div>
          </div>

          <div class="next-steps">
            <h3>What Happens Next?</h3>
            <p>We are ready to initiate the development phase of your website! Our design team will contact you shortly to launch the mockup process.</p>
          </div>
        </div>
        <div class="footer">
          Strategic Brand Solutions Team • <a href="mailto:akhilthadaka97@gmail.com">Contact Support</a>
        </div>
      </div>
    </body>
    </html>
  `;

  // Email to Admin
  const adminMailOptions = {
    from: `"Strategic Brand Solutions" <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: `Strategic Brand Solutions - Signed Service Agreement: ${agreementData.fullName}`,
    text: `A client has signed the Service Agreement: ${agreementData.fullName}.`,
    html: adminAgreementHtml
  };

  // Email to Client
  const clientMailOptions = {
    from: `"Strategic Brand Solutions" <${process.env.EMAIL_USER}>`,
    to: agreementData.email,
    subject: 'Strategic Brand Solutions - Service Agreement Signed Copies 📄',
    text: `Dear ${agreementData.fullName}, Thank you for signing the Service Agreement.`,
    html: clientAgreementHtml
  };

  let adminStatus = 'Sent';
  let clientStatus = 'Sent';
  let errorMsg = null;

  try {
    await transporter.sendMail(adminMailOptions);
    console.log(`Agreement alert sent to Admin: ${adminEmail}`);
  } catch (err) {
    console.error('Nodemailer error sending agreement email to Admin:', err.message);
    adminStatus = 'Failed';
    errorMsg = `Admin Email: ${err.message}`;
  }

  try {
    await transporter.sendMail(clientMailOptions);
    console.log(`Agreement copy sent to Client: ${agreementData.email}`);
  } catch (err) {
    console.error('Nodemailer error sending agreement email to Client:', err.message);
    clientStatus = 'Failed';
    const clientErr = `Client Email: ${err.message}`;
    errorMsg = errorMsg ? `${errorMsg}; ${clientErr}` : clientErr;
  }

  try {
    await Agreement.findByIdAndUpdate(agreementData._id, {
      emailSentToAdmin: adminStatus,
      emailSentToClient: clientStatus,
      emailError: errorMsg
    });
  } catch (dbErr) {
    console.error('Failed to update email status in database:', dbErr.message);
  }
}

// --- Public Routes ---

// Submit Application
router.post('/applications', async (req, res) => {
  try {
    const newApp = new Application(req.body);
    const savedApp = await newApp.save();
    
    // Send email asynchronously
    sendApplicationEmails(savedApp).catch(console.error);

    res.status(201).json(savedApp);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// Submit Agreement
router.post('/agreements', async (req, res) => {
  try {
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const agreementData = {
      ...req.body,
      ipAddress: clientIp
    };
    const newAgreement = new Agreement(agreementData);
    const savedAgreement = await newAgreement.save();
    
    // Send email asynchronously
    sendAgreementEmails(savedAgreement).catch(console.error);

    res.status(201).json(savedAgreement);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to submit agreement' });
  }
});

// Get Email Config Status (Protected)
router.get('/email-config', verifyAdmin, (req, res) => {
  res.json({
    emailUser: process.env.EMAIL_USER || '',
    isConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
  });
});

// Test Email Route (Protected Diagnostic)
router.get('/test-email', verifyAdmin, async (req, res) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return res.status(500).json({
      error: 'SMTP Config Missing',
      user: process.env.EMAIL_USER || 'undefined',
      pass: process.env.EMAIL_PASS ? 'configured' : 'undefined'
    });
  }

  const recipient = req.query.to || 'akhilthadaka77@gmail.com';
  const transporter = getTransporter();

  const mailOptions = {
    from: `"Strategic Brand Solutions" <${process.env.EMAIL_USER}>`,
    to: recipient,
    subject: 'Strategic Brand Solutions - Diagnostic Test Email',
    text: `Success! Your backend email notification system is fully operational. This test email was sent to ${recipient}.`
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return res.json({
      success: true,
      message: 'Email sent successfully!',
      recipient: recipient,
      response: info.response
    });
  } catch (error) {
    console.error('SMTP Diagnostic Failure:', error);
    return res.status(500).json({
      success: false,
      message: 'SMTP connection or credential failure.',
      error: error.message,
      stack: error.stack
    });
  }
});

// Admin Login Route
router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  const expectedAdminEmail = process.env.ADMIN_EMAIL || 'akhilthadaka97@gmail.com';
  const expectedAdminPass = process.env.ADMIN_PASS || 'Happy@7777';

  if (email === expectedAdminEmail && password === expectedAdminPass) {
    try {
      const token = jwt.sign(
        { email: expectedAdminEmail },
        process.env.JWT_SECRET || 'super_secret_jwt_key_sbs_123',
        { expiresIn: '24h' }
      );
      return res.json({ token });
    } catch (err) {
      console.error('JWT Signing Error:', err);
      return res.status(500).json({ error: 'Failed to sign token' });
    }
  }

  return res.status(401).json({ error: 'Invalid email or password' });
});

// --- Admin Routes (Protected) ---

// Get all applications
router.get('/applications', verifyAdmin, async (req, res) => {
  try {
    const applications = await Application.find().sort({ submittedAt: -1 });
    res.json(applications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Get all agreements
router.get('/agreements', verifyAdmin, async (req, res) => {
  try {
    const agreements = await Agreement.find().sort({ signatureDate: -1 });
    res.json(agreements);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch agreements' });
  }
});

// Update application
router.put('/applications/:id', verifyAdmin, async (req, res) => {
  try {
    const updatedApp = await Application.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedApp) return res.status(404).json({ error: 'Application not found' });
    res.json(updatedApp);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update application' });
  }
});

// Delete application
router.delete('/applications/:id', verifyAdmin, async (req, res) => {
  try {
    const deletedApp = await Application.findByIdAndDelete(req.params.id);
    if (!deletedApp) return res.status(404).json({ error: 'Application not found' });
    res.json({ message: 'Application deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete application' });
  }
});

// Update agreement
router.put('/agreements/:id', verifyAdmin, async (req, res) => {
  try {
    const updatedAgreement = await Agreement.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedAgreement) return res.status(404).json({ error: 'Agreement not found' });
    res.json(updatedAgreement);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update agreement' });
  }
});

// Delete agreement
router.delete('/agreements/:id', verifyAdmin, async (req, res) => {
  try {
    const deletedAgreement = await Agreement.findByIdAndDelete(req.params.id);
    if (!deletedAgreement) return res.status(404).json({ error: 'Agreement not found' });
    res.json({ message: 'Agreement deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete agreement' });
  }
});

module.exports = router;
