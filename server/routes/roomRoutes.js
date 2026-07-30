const express = require('express');
const router = express.Router();
const {
  createRoom,
  getRooms,
  getRoomDetails,
  deleteRoom,
  updateRoom,
  getRoomMessages,
  getRoomsStats,
  getScheduledRooms,
  getMeetingHistory,
} = require('../controllers/roomController');
const { protect } = require('../middleware/auth');

router.route('/')
  .post(protect, createRoom)
  .get(protect, getRooms);

router.get('/history', protect, getMeetingHistory);
router.get('/stats', protect, getRoomsStats);
router.get('/scheduled', protect, getScheduledRooms);

router.route('/:roomId')
  .get(protect, getRoomDetails)
  .put(protect, updateRoom)
  .delete(protect, deleteRoom);

router.route('/:roomId/messages')
  .get(protect, getRoomMessages);

module.exports = router;
