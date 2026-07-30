const mongoose = require('mongoose');

const timelineEventSchema = new mongoose.Schema({
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  type: {
    type: String,
    enum: ['join', 'leave', 'screen_share', 'hand_raise', 'recording', 'poll', 'decision', 'task', 'highlight'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: 'Clock'
  },
  color: {
    type: String,
    default: '#3b82f6'
  },
  referenceId: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('TimelineEvent', timelineEventSchema);
