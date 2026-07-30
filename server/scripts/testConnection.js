const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Room = require('../models/Room');
const Message = require('../models/Message');

dotenv.config();

const runTest = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/livelink');
    console.log('MongoDB connection successful!');

    console.log('Cleaning up old test users/rooms...');
    await User.deleteMany({ email: 'test_livelink_user@example.com' });
    await Room.deleteMany({ name: 'Test LiveLink Room' });

    console.log('Testing User creation...');
    const testUser = await User.create({
      username: 'test_livelink_user',
      email: 'test_livelink_user@example.com',
      password: 'password123',
    });
    console.log(`Test user created successfully: ${testUser.username}`);

    console.log('Testing Room creation...');
    const testRoom = await Room.create({
      roomId: 'test-room-id',
      name: 'Test LiveLink Room',
      host: testUser._id,
      participants: [testUser._id],
    });
    console.log(`Test room created successfully: ${testRoom.name} (${testRoom.roomId})`);

    console.log('Testing Message creation...');
    const testMessage = await Message.create({
      room: testRoom._id,
      sender: testUser._id,
      text: 'Hello test message!',
    });
    console.log(`Test message created successfully: "${testMessage.text}"`);

    console.log('Testing query lookups...');
    const foundRoom = await Room.findOne({ roomId: 'test-room-id' }).populate('host', 'username');
    console.log(`Retrieved room host username: ${foundRoom.host.username}`);

    console.log('Cleaning up test data...');
    await User.deleteOne({ _id: testUser._id });
    await Room.deleteOne({ _id: testRoom._id });
    await Message.deleteOne({ _id: testMessage._id });
    console.log('Test clean up completed!');

    console.log('All tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  }
};

runTest();
