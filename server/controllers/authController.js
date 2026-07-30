const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Helper to generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res, next) => {
  try {
    const { username, fullName, email, password, profilePicture } = req.body;
    const nameToUse = fullName || username;

    if (!nameToUse || !email || !password) {
      res.status(400);
      throw new Error('Please fill in all fields');
    }

    const memoryDb = require('../config/memoryDb');
    const mongoose = require('mongoose');

    if (!memoryDb.isOnline()) {
      const emailExists = memoryDb.users.find(u => u.email === email);
      if (emailExists) {
        res.status(400);
        throw new Error('User with this email already exists');
      }

      const user = {
        _id: new mongoose.Types.ObjectId().toString(),
        fullName: nameToUse,
        email,
        password, // stored plain for offline/mock ease
        profilePicture: profilePicture || '',
        avatarColor: ['#8b5cf6', '#06b6d4', '#ec4899'][Math.floor(Math.random() * 3)],
      };
      
      memoryDb.users.push(user);

      // Log mock activity in memory
      memoryDb.messages.push({
        _id: `act-${Date.now()}`,
        text: `Registered account for ${user.fullName}`,
        sender: user,
        createdAt: new Date()
      });

      return res.status(201).json({
        _id: user._id,
        fullName: user.fullName,
        username: user.fullName,
        email: user.email,
        profilePicture: user.profilePicture,
        avatarColor: user.avatarColor,
        token: generateToken(user._id),
      });
    }

    // Check if user exists by email
    const userExistsByEmail = await User.findOne({ email });
    if (userExistsByEmail) {
      res.status(400);
      throw new Error('User with this email already exists');
    }

    // Create user
    const user = await User.create({
      fullName: nameToUse,
      email,
      password,
      profilePicture: profilePicture || '',
    });

    if (user) {
      const Activity = require('../models/Activity');
      await Activity.create({
        user: user._id,
        text: 'Registered account and logged in.'
      });

      res.status(201).json({
        _id: user._id,
        fullName: user.fullName,
        username: user.fullName,
        email: user.email,
        profilePicture: user.profilePicture,
        avatarColor: user.avatarColor,
        token: generateToken(user._id),
      });
    } else {
      res.status(400);
      throw new Error('Invalid user data');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      throw new Error('Please enter email and password');
    }

    const memoryDb = require('../config/memoryDb');
    if (!memoryDb.isOnline()) {
      const user = memoryDb.users.find(u => u.email === email);
      if (user && user.password === password) {
        return res.json({
          _id: user._id,
          fullName: user.fullName,
          username: user.fullName,
          email: user.email,
          profilePicture: user.profilePicture,
          avatarColor: user.avatarColor,
          token: generateToken(user._id),
        });
      } else {
        res.status(401);
        throw new Error('Invalid credentials');
      }
    }

    // Check for user email
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        fullName: user.fullName,
        username: user.fullName,
        email: user.email,
        profilePicture: user.profilePicture,
        avatarColor: user.avatarColor,
        token: generateToken(user._id),
      });
    } else {
      res.status(401);
      throw new Error('Invalid credentials');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const memoryDb = require('../config/memoryDb');
    if (!memoryDb.isOnline()) {
      const mockUser = {
        ...req.user,
        username: req.user.fullName
      };
      return res.status(200).json(mockUser);
    }

    const user = await User.findById(req.user.id).select('-password');
    if (user) {
      res.status(200).json({
        _id: user._id,
        fullName: user.fullName,
        username: user.fullName,
        email: user.email,
        profilePicture: user.profilePicture,
        avatarColor: user.avatarColor,
      });
    } else {
      res.status(404);
      throw new Error('User not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const { fullName, profilePicture } = req.body;

    const memoryDb = require('../config/memoryDb');
    if (!memoryDb.isOnline()) {
      const userIndex = memoryDb.users.findIndex(u => u._id === req.user._id);
      if (userIndex === -1) {
        res.status(404);
        throw new Error('User not found');
      }
      const updatedUser = {
        ...memoryDb.users[userIndex],
        fullName: fullName || memoryDb.users[userIndex].fullName,
        profilePicture: profilePicture !== undefined ? profilePicture : memoryDb.users[userIndex].profilePicture,
      };
      memoryDb.users[userIndex] = updatedUser;
      
      // Log mock activity in memory
      memoryDb.messages.push({
        _id: `act-${Date.now()}`,
        text: `Updated profile details`,
        sender: updatedUser,
        createdAt: new Date()
      });

      return res.json({
        _id: updatedUser._id,
        fullName: updatedUser.fullName,
        username: updatedUser.fullName,
        email: updatedUser.email,
        profilePicture: updatedUser.profilePicture,
        avatarColor: updatedUser.avatarColor,
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    user.fullName = fullName || user.fullName;
    if (profilePicture !== undefined) {
      user.profilePicture = profilePicture;
    }

    const updatedUser = await user.save();
    
    // Log Activity
    const Activity = require('../models/Activity');
    await Activity.create({
      user: req.user._id,
      text: 'Updated profile settings.'
    });

    res.json({
      _id: updatedUser._id,
      fullName: updatedUser.fullName,
      username: updatedUser.fullName,
      email: updatedUser.email,
      profilePicture: updatedUser.profilePicture,
      avatarColor: updatedUser.avatarColor,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  updateProfile,
};
