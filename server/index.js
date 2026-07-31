const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler');
const socketHandler = require('./socket/socketHandler');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

// Load environment variables
dotenv.config();

// Connect to MongoDB Database
connectDB();

const app = express();
app.set('trust proxy', 1);
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

// Security Middleware
app.use(helmet());
app.use(mongoSanitize());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
});
app.use('/api', limiter);

// Body Parsers (Increased limit for base64 if needed, though we use multer mostly)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: false }));

// Static folder for file uploads
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Basic Health Check Route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to LiveLink API' });
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/rooms', require('./routes/roomRoutes'));
app.use('/api/timeline', require('./routes/timelineRoutes'));
app.use('/api/activities', require('./routes/activityRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));

// Socket.IO Handler
global.ioInstance = io;
socketHandler(io);

// Global Error Handler Middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
