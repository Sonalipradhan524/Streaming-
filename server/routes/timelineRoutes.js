const express = require('express');
const router = express.Router();
const {
  getTimelineEvents,
  addTimelineEvent,
  generateAISummary
} = require('../controllers/timelineController');
const { protect } = require('../middleware/auth');

router.route('/:roomId')
  .get(protect, getTimelineEvents)
  .post(protect, addTimelineEvent);

router.post('/:roomId/summary', protect, generateAISummary);

module.exports = router;
