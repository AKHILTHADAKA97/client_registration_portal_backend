const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  studyOccupation: { type: String, required: true },
  cellNumber: { type: String, required: true },
  emailAddress: { type: String, required: true },
  pincode: { type: String, required: true },
  websitePurpose: { type: String, required: true },
  projectType: { type: String, required: true },
  pageCount: { type: String, default: '1-5' },
  whyChooseMe: [{ type: String }],
  additionalNotes: { type: String },
  emailSentToAdmin: { type: String, default: 'Pending' },
  emailSentToClient: { type: String, default: 'Pending' },
  emailError: { type: String },
  submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Application', applicationSchema);
