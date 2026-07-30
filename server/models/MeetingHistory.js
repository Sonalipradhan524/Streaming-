const mongoose = require('mongoose');

const meetingHistorySchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    startedAt: {
      type: Date,
      required: true,
    },
    endedAt: {
      type: Date,
    },
    duration: {
      type: Number, // in seconds
    },
    meetingSummary: {
      type: String,
    }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('MeetingHistory', meetingHistorySchema);
