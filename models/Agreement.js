const mongoose = require('mongoose');

const agreementSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  ipAddress: { type: String },
  agreedToTerms: { type: Boolean, required: true },
  emailSentToAdmin: { type: String, default: 'Pending' },
  emailSentToClient: { type: String, default: 'Pending' },
  emailError: { type: String },
  signatureDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Agreement', agreementSchema);
