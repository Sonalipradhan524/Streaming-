const mongoose = require('mongoose');
const dns = require('dns');

// Force DNS lookup fallback using Google & Cloudflare DNS to handle Mongo Atlas SRV resolution
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (dnsErr) {
  console.warn('Unable to set DNS servers:', dnsErr.message);
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/livelink');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`MongoDB Connection Failed: ${error.message}. Running in fallback local mode.`);
    const memoryDb = require('./memoryDb');
    memoryDb.useFallback = true;
  }
};

module.exports = connectDB;
