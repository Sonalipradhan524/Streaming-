const Room = require('../models/Room');

// Helper to generate a room code (e.g., xxx-xxxx-xxx)
const generateRoomId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const part1 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part3 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${part1}-${part2}-${part3}`;
};

// @desc    Create a new room
// @route   POST /api/rooms
// @access  Private
const createRoom = async (req, res, next) => {
  try {
    const { name, scheduledAt, isScheduled } = req.body;

    if (!name) {
      res.status(400);
      throw new Error('Please add a room name');
    }

    const roomId = generateRoomId();

    const memoryDb = require('../config/memoryDb');
    const mongoose = require('mongoose');
    const Activity = require('../models/Activity');

    if (!memoryDb.isOnline()) {
      const room = {
        _id: new mongoose.Types.ObjectId().toString(),
        roomId,
        name,
        host: req.user,
        participants: [req.user],
        isLive: !isScheduled,
        isScheduled: !!isScheduled,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        createdAt: new Date()
      };
      memoryDb.rooms.push(room);

      // Log mock activity
      memoryDb.messages.push({
        _id: `act-${Date.now()}`,
        text: `Created room "${name}"${isScheduled ? ' (Scheduled)' : ''}`,
        sender: req.user,
        createdAt: new Date()
      });

      return res.status(201).json(room);
    }

    const room = await Room.create({
      roomId,
      name,
      host: req.user._id,
      participants: [req.user._id],
      isLive: !isScheduled,
      isScheduled: !!isScheduled,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    });

    // Log Activity
    await Activity.create({
      user: req.user._id,
      text: `Created stream room "${name}"${isScheduled ? ' (Scheduled)' : ''}`
    });

    const populatedRoom = await Room.findById(room._id).populate('host', 'username email avatarColor');

    res.status(201).json(populatedRoom);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all active rooms
// @route   GET /api/rooms
// @access  Private
const getRooms = async (req, res, next) => {
  try {
    const memoryDb = require('../config/memoryDb');
    if (!memoryDb.isOnline()) {
      const activeRooms = memoryDb.rooms.filter(r => r.isLive && !r.isScheduled);
      return res.status(200).json(activeRooms);
    }

    const rooms = await Room.find({ isLive: true, isScheduled: false })
      .populate('host', 'username email avatarColor')
      .populate('participants', 'username avatarColor')
      .sort({ createdAt: -1 });

    res.status(200).json(rooms);
  } catch (error) {
    next(error);
  }
};

// @desc    Get room details
// @route   GET /api/rooms/:roomId
// @access  Private
const getRoomDetails = async (req, res, next) => {
  try {
    const memoryDb = require('../config/memoryDb');
    if (!memoryDb.isOnline()) {
      const room = memoryDb.rooms.find(r => r.roomId === req.params.roomId);
      if (!room) {
        res.status(404);
        throw new Error('Room not found');
      }
      return res.status(200).json(room);
    }

    const room = await Room.findOne({ roomId: req.params.roomId })
      .populate('host', 'username email avatarColor')
      .populate('participants', 'username email avatarColor');

    if (!room) {
      res.status(404);
      throw new Error('Room not found');
    }

    res.status(200).json(room);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a room
// @route   DELETE /api/rooms/:roomId
// @access  Private
const deleteRoom = async (req, res, next) => {
  try {
    const memoryDb = require('../config/memoryDb');
    const Activity = require('../models/Activity');

    if (!memoryDb.isOnline()) {
      const roomIndex = memoryDb.rooms.findIndex(r => r.roomId === req.params.roomId);
      if (roomIndex === -1) {
        res.status(404);
        throw new Error('Room not found');
      }
      
      const room = memoryDb.rooms[roomIndex];
      if (room.host._id.toString() !== req.user._id.toString()) {
        res.status(401);
        throw new Error('Not authorized to delete this room');
      }
      
      memoryDb.rooms.splice(roomIndex, 1);

      // Log mock activity
      memoryDb.messages.push({
        _id: `act-${Date.now()}`,
        text: `Deleted room "${room.name}"`,
        sender: req.user,
        createdAt: new Date()
      });

      return res.status(200).json({ message: 'Room deleted successfully', roomId: req.params.roomId });
    }

    const room = await Room.findOne({ roomId: req.params.roomId });

    if (!room) {
      res.status(404);
      throw new Error('Room not found');
    }

    if (room.host.toString() !== req.user._id.toString()) {
      res.status(401);
      throw new Error('Not authorized to delete this room');
    }

    await Room.deleteOne({ _id: room._id });

    // Log Activity
    await Activity.create({
      user: req.user._id,
      text: `Deleted stream room "${room.name}"`
    });

    res.status(200).json({ message: 'Room deleted successfully', roomId: req.params.roomId });
  } catch (error) {
    next(error);
  }
};

// @desc    Get room messages history
// @route   GET /api/rooms/:roomId/messages
// @access  Private
const getRoomMessages = async (req, res, next) => {
  try {
    const Message = require('../models/Message');
    const memoryDb = require('../config/memoryDb');

    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) {
      res.status(404);
      throw new Error('Room not found');
    }

    if (!memoryDb.isOnline()) {
      const roomMessages = memoryDb.messages.filter(
        (m) => m.room.toString() === room._id.toString()
      );
      return res.status(200).json(roomMessages);
    }

    const messages = await Message.find({ room: room._id })
      .populate('sender', 'username email avatarColor profilePicture')
      .sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
};

// @desc    Get rooms stats (Real database query)
// @route   GET /api/rooms/stats
// @access  Private
const getRoomsStats = async (req, res, next) => {
  try {
    const memoryDb = require('../config/memoryDb');
    const User = require('../models/User');

    let onlineCount = 1;
    if (global.ioInstance) {
      onlineCount = global.ioInstance.engine.clientsCount;
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    if (!memoryDb.isOnline()) {
      const activeStreamsCount = memoryDb.rooms.filter(r => r.isLive && !r.isScheduled).length;
      const totalUsersCount = memoryDb.users.length;
      const meetingsTodayCount = memoryDb.rooms.filter(r => new Date(r.createdAt) >= startOfToday).length;

      return res.status(200).json({
        activeStreams: activeStreamsCount,
        usersOnline: onlineCount || 1,
        meetingsToday: meetingsTodayCount,
        totalUsers: totalUsersCount || 1,
      });
    }

    const activeStreamsCount = await Room.countDocuments({ isLive: true, isScheduled: false });
    const totalUsersCount = await User.countDocuments({});
    const meetingsTodayCount = await Room.countDocuments({ createdAt: { $gte: startOfToday } });

    res.status(200).json({
      activeStreams: activeStreamsCount,
      usersOnline: onlineCount || 1,
      meetingsToday: meetingsTodayCount,
      totalUsers: totalUsersCount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get upcoming scheduled meetings
// @route   GET /api/rooms/scheduled
// @access  Private
const getScheduledRooms = async (req, res, next) => {
  try {
    const memoryDb = require('../config/memoryDb');
    if (!memoryDb.isOnline()) {
      const scheduled = memoryDb.rooms.filter(r => r.isScheduled && new Date(r.scheduledAt) >= new Date());
      return res.status(200).json(scheduled);
    }

    const rooms = await Room.find({ isScheduled: true, scheduledAt: { $gte: new Date() } })
      .populate('host', 'username email avatarColor')
      .sort({ scheduledAt: 1 });

    res.status(200).json(rooms);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRoom,
  getRooms,
  getRoomDetails,
  deleteRoom,
  getRoomMessages,
  getRoomsStats,
  getScheduledRooms,
};
