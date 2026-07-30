const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler');
const socketHandler = require('./socket/socketHandler');

// Load environment variables
dotenv.config();

// Connect to MongoDB Database
connectDB();

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO Server
const io = new Server(server, {
  cors: {
    origin: '*', // In production, replace with specific domain(s)
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
  },
});

// Configure CORS
app.use(cors({
  origin: '*', // Allow all origins for convenience, restrict in production
}));

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Basic Health Check Route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to LiveLink API' });
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/rooms', require('./routes/roomRoutes'));
app.use('/api/activities', require('./routes/activityRoutes'));

// Socket.IO Handler
global.ioInstance = io;
socketHandler(io);

// Global Error Handler Middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
