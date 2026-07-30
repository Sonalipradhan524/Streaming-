const Activity = require('../models/Activity');
const memoryDb = require('../config/memoryDb');

// @desc    Get user activities logs
// @route   GET /api/activities
// @access  Private
const getUserActivities = async (req, res, next) => {
  try {
    if (!memoryDb.isOnline()) {
      const userActivities = memoryDb.messages // reuse messages log or mock array fallback
        .filter(m => m.sender?._id === req.user._id)
        .slice(-10)
        .map((m, idx) => ({
          _id: `act-${idx}`,
          text: `Sent chat message "${m.text.substring(0, 15)}..."`,
          createdAt: m.createdAt,
        }));
      return res.status(200).json(userActivities);
    }

    const activities = await Activity.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json(activities);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserActivities,
};
