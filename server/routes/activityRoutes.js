const express = require('express');
const router = express.Router();
const { getUserActivities } = require('../controllers/activityController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getUserActivities);

module.exports = router;
