const mongoose = require('mongoose');

// Shared In-Memory Fallback Database
const memoryDb = {
  users: [],
  rooms: [],
  messages: [],
  useFallback: false, // Set to true only if mongoose connection fails
  
  // Helper to check if database is online
  isOnline: function() {
    return !this.useFallback;
  }
};

module.exports = memoryDb;
