const express = require('express');
const router = express.Router();
const { askQuestion, getHistory } = require('../controllers/aiController');
const { protect } = require('../middleware/auth');

router.post('/ask', protect, askQuestion);
router.get('/history/:meetingId?', protect, getHistory);

module.exports = router;
