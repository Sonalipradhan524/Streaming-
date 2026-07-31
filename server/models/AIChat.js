const mongoose = require('mongoose');

const aiChatSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  meetingId: {
    type: String,
    default: 'global'
  },
  question: {
    type: String,
    required: true
  },
  response: {
    type: String,
    required: true
  },
  language: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AIChat', aiChatSchema);
