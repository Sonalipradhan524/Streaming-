const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Please add a room name'],
      trim: true,
      maxlength: [50, 'Room name cannot be more than 50 characters'],
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
    isLive: {
      type: Boolean,
      default: true,
    },
    scheduledAt: {
      type: Date,
    },
    isScheduled: {
      type: Boolean,
      default: false,
    },
    isLocked: {
      type: Boolean,
      default: false,
    },
    password: {
      type: String, // Hashed password
    },
    waitingRoomEnabled: {
      type: Boolean,
      default: false,
    },
    coHosts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      }
    ],
    bannedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      }
    ]
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Room', roomSchema);
