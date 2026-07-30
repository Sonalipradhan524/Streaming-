const Room = require('../models/Room');
const Message = require('../models/Message');
const User = require('../models/User');

// Keep track of socket-to-user mappings in memory for fast lookup during disconnect
const socketToUser = {};
const socketToRoom = {};

const socketHandler = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // User joins a streaming room
    socket.on('join-room', async ({ roomId, userId }) => {
      try {
        const memoryDb = require('../config/memoryDb');
        let room;
        let user;

        if (!memoryDb.isOnline()) {
          room = memoryDb.rooms.find(r => r.roomId === roomId);
          if (!room) {
            socket.emit('error-msg', 'Room not found');
            return;
          }
          user = memoryDb.users.find(u => u._id === userId);
          if (!user) {
            socket.emit('error-msg', 'User not found');
            return;
          }

          // Add user to room participants in memory if not already present
          if (!room.participants.some(p => p._id.toString() === userId.toString())) {
            room.participants.push(user);
          }
        } else {
          room = await Room.findOne({ roomId });
          if (!room) {
            socket.emit('error-msg', 'Room not found');
            return;
          }
          user = await User.findById(userId);
          if (!user) {
            socket.emit('error-msg', 'User not found');
            return;
          }

          // Add user to room participants in DB if not already present
          if (!room.participants.includes(userId)) {
            room.participants.push(userId);
            await room.save();
          }
        }

        // Store mappings
        socketToUser[socket.id] = {
          _id: user._id,
          username: user.username,
          avatarColor: user.avatarColor,
        };
        socketToRoom[socket.id] = roomId;

        // Join Socket.IO channel
        socket.join(roomId);

        // Get list of other clients currently connected in this socket room
        const roomClients = io.sockets.adapter.rooms.get(roomId);
        const otherUsers = [];
        
        if (roomClients) {
          for (const clientSocketId of roomClients) {
            if (clientSocketId !== socket.id) {
              const peerUserData = socketToUser[clientSocketId];
              if (peerUserData && peerUserData._id.toString() === userId.toString()) {
                console.log(`Ghost user connection skipped: socket ${clientSocketId} for user ${userId}`);
                continue;
              }
              otherUsers.push({
                socketId: clientSocketId,
                user: peerUserData,
              });
            }
          }
        }

        // Send existing room participants (and their socket IDs) to the newcomer
        socket.emit('all-users', otherUsers);

        // Notify other room participants that a new user has joined
        socket.to(roomId).emit('user-joined', {
          socketId: socket.id,
          user: socketToUser[socket.id],
        });

        console.log(`User ${user.username} (${socket.id}) joined room ${roomId}`);
      } catch (error) {
        console.error('Error on join-room:', error);
        socket.emit('error-msg', 'Failed to join room');
      }
    });

    // Handle incoming chat messages
    socket.on('send-message', async ({ text }) => {
      try {
        const roomId = socketToRoom[socket.id];
        const user = socketToUser[socket.id];

        if (!roomId || !user) return;

        const memoryDb = require('../config/memoryDb');
        let messageData;

        if (!memoryDb.isOnline()) {
          const dbRoom = memoryDb.rooms.find(r => r.roomId === roomId);
          if (!dbRoom) return;

          const mongoose = require('mongoose');
          const newMessage = {
            _id: new mongoose.Types.ObjectId().toString(),
            room: dbRoom._id,
            sender: user,
            text,
            createdAt: new Date()
          };
          memoryDb.messages.push(newMessage);

          messageData = {
            _id: newMessage._id,
            text: newMessage.text,
            sender: {
              _id: user._id,
              username: user.username,
              avatarColor: user.avatarColor,
            },
            createdAt: newMessage.createdAt,
          };
        } else {
          const dbRoom = await Room.findOne({ roomId });
          if (!dbRoom) return;

          // Save message to MongoDB
          const newMessage = await Message.create({
            room: dbRoom._id,
            sender: user._id,
            text,
          });

          messageData = {
            _id: newMessage._id,
            text: newMessage.text,
            sender: {
              _id: user._id,
              username: user.username,
              avatarColor: user.avatarColor,
            },
            createdAt: newMessage.createdAt,
          };
        }

        // Broadcast to everyone in the room
        io.to(roomId).emit('message-received', messageData);
      } catch (error) {
        console.error('Error sending message:', error);
      }
    });

    // Handle WebRTC signaling exchange between peers
    socket.on('send-signal', ({ to, signal }) => {
      // Forward the offer/answer/candidate to the specific target peer
      io.to(to).emit('signal-received', {
        from: socket.id,
        signal,
      });
    });

    // Handle raise hand event
    socket.on('raise-hand', ({ raised }) => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        socket.to(roomId).emit('peer-raise-hand', {
          socketId: socket.id,
          raised,
        });
      }
    });

    // Handle typing indicator
    socket.on('typing', ({ isTyping }) => {
      const roomId = socketToRoom[socket.id];
      const user = socketToUser[socket.id];
      if (roomId && user) {
        socket.to(roomId).emit('peer-typing', {
          socketId: socket.id,
          username: user.username,
          isTyping,
        });
      }
    });

    // Handle emoji reaction to a message
    socket.on('send-reaction', ({ messageId, emoji }) => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        io.to(roomId).emit('reaction-received', {
          messageId,
          emoji,
          socketId: socket.id,
        });
      }
    });

    // Handle user leaving the room
    const handleLeave = async () => {
      const roomId = socketToRoom[socket.id];
      const user = socketToUser[socket.id];

      if (roomId && user) {
        console.log(`User ${user.username} (${socket.id}) is leaving room ${roomId}`);
        
        try {
          // Notify other peers
          socket.to(roomId).emit('user-left', {
            socketId: socket.id,
            userId: user._id,
          });

          const memoryDb = require('../config/memoryDb');
          if (!memoryDb.isOnline()) {
            const room = memoryDb.rooms.find(r => r.roomId === roomId);
            if (room) {
              room.participants = room.participants.filter(
                (p) => p._id.toString() !== user._id.toString()
              );
            }
          } else {
            // Remove user from DB room participants list
            const room = await Room.findOne({ roomId });
            if (room) {
              room.participants = room.participants.filter(
                (pId) => pId.toString() !== user._id.toString()
              );
              await room.save();
            }
          }
        } catch (error) {
          console.error('Error updating DB on user leave:', error);
        }

        // Clean up mappings
        delete socketToRoom[socket.id];
      }
      
      delete socketToUser[socket.id];
    };

    socket.on('leave-room', handleLeave);

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      handleLeave();
    });
  });
};

module.exports = socketHandler;
