require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Application = require('./models/Application');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/client_app_db';

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    const lastApp = await Application.findOne().sort({ submittedAt: -1 });
    if (!lastApp) {
      console.log('No applications found in database.');
    } else {
      console.log('Last Application Details:');
      console.log(JSON.stringify(lastApp, null, 2));
    }
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('MongoDB error:', err);
  });
