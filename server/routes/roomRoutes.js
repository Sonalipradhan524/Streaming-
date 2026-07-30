const express = require('express');
const router = express.Router();
const {
  createRoom,
  getRooms,
  getRoomDetails,
  deleteRoom,
  getRoomMessages,
  getRoomsStats,
  getScheduledRooms,
} = require('../controllers/roomController');
const { protect } = require('../middleware/auth');

router.route('/')
  .post(protect, createRoom)
  .get(protect, getRooms);

router.get('/stats', protect, getRoomsStats);
router.get('/scheduled', protect, getScheduledRooms);

router.route('/:roomId')
  .get(protect, getRoomDetails)
  .delete(protect, deleteRoom);

router.route('/:roomId/messages')
  .get(protect, getRoomMessages);

module.exports = router;
