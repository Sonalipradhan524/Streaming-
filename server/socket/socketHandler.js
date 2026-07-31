const Room = require('../models/Room');
const Message = require('../models/Message');
const User = require('../models/User');
const TimelineEvent = require('../models/TimelineEvent');

// Keep track of socket-to-user mappings in memory for fast lookup during disconnect
const socketToUser = {};
const socketToRoom = {};

const createAndEmitTimelineEvent = async (io, roomId, roomDbId, type, title, description, icon, color, referenceId = null) => {
  try {
    const memoryDb = require('../config/memoryDb');
    let eventData = {
      type, title, description, icon, color, referenceId, timestamp: new Date()
    };
    
    if (memoryDb.isOnline() && roomDbId) {
      const newEvent = await TimelineEvent.create({
        room: roomDbId,
        ...eventData
      });
      eventData._id = newEvent._id;
    }
    io.to(roomId).emit('timeline-event', eventData);
  } catch (error) {
    console.error('Error creating timeline event:', error);
  }
};

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

        // Check if room is locked
        if (room.isLocked) {
          socket.emit('error-msg', 'Room is locked');
          return;
        }

        // Check if user is banned
        if (room.bannedUsers && room.bannedUsers.includes(userId)) {
          socket.emit('error-msg', 'You are banned from this room');
          return;
        }

        // Waiting room logic (Temporarily bypassed for instant joining)
        const isHost = room.host.toString() === userId.toString();
        const isCoHost = room.coHosts && room.coHosts.some(id => id.toString() === userId.toString());
        
        // if (room.waitingRoomEnabled && !isHost && !isCoHost) {
        //   socket.join(`waiting-${roomId}`);
        //   socket.emit('in-waiting-room');
        //   // Notify hosts
        //   io.to(roomId).emit('user-in-waiting-room', {
        //     socketId: socket.id,
        //     user: {
        //       _id: user._id,
        //       username: user.username,
        //       avatarColor: user.avatarColor,
        //     }
        //   });
        //   return; // Stop here until admitted
        // }

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
              if (peerUserData && peerUserData._id && userId && peerUserData._id.toString() === userId.toString()) {
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

        // Load chat history
        if (memoryDb.isOnline() && room) {
          const Message = require('../models/Message');
          try {
            const history = await Message.find({ room: room._id })
              .sort({ createdAt: 1 })
              .limit(50)
              .populate('sender', 'username email avatarColor profilePicture')
              .populate('receiver', 'username email avatarColor profilePicture')
              .populate({
                path: 'replyTo',
                populate: { path: 'sender', select: 'username avatarColor' }
              });
            socket.emit('chat-history', history);
          } catch (err) {
            console.error('Error fetching chat history:', err);
          }
        }

        // Send existing room participants (and their socket IDs) to the newcomer
        socket.emit('all-users', otherUsers);

        // Notify other room participants that a new user has joined
        socket.to(roomId).emit('user-joined', {
          socketId: socket.id,
          user: socketToUser[socket.id],
        });

        // Emit Timeline Event
        createAndEmitTimelineEvent(io, roomId, room ? room._id : null, 'join', `${user.username} joined`, `Participant ${user.username} has joined the room.`, 'LogOut', '#10b981', user._id);

        console.log(`User ${user.username} (${socket.id}) joined room ${roomId}`);
      } catch (error) {
        console.error('Error on join-room:', error);
        socket.emit('error-msg', 'Failed to join room');
      }
    });

    // Handle incoming chat messages
    socket.on('send-message', async ({ text, type = 'text', replyTo = null, receiverId = null, tempId = null }) => {
      try {
        const roomId = socketToRoom[socket.id];
        const user = socketToUser[socket.id];

        if (!roomId || !user) return;

        // Basic spam prevention (sanitize text if it's text type)
        if (type === 'text' && text) {
          text = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }

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
            type,
            replyTo,
            receiver: receiverId ? { _id: receiverId } : null,
            createdAt: new Date()
          };
          memoryDb.messages.push(newMessage);

          messageData = {
            ...newMessage,
            sender: {
              _id: user._id,
              username: user.username,
              avatarColor: user.avatarColor,
            }
          };
        } else {
          const dbRoom = await Room.findOne({ roomId });
          if (!dbRoom) return;

          // Save message to MongoDB
          const Message = require('../models/Message');
          const User = require('../models/User');

          const newMessage = await Message.create({
            room: dbRoom._id,
            sender: user._id,
            text,
            type,
            replyTo: replyTo || undefined,
            receiver: receiverId || undefined
          });

          // Populate sender, receiver, replyTo for real-time broadcast
          const populatedMessage = await Message.findById(newMessage._id)
            .populate('sender', 'username email avatarColor profilePicture')
            .populate('receiver', 'username email avatarColor profilePicture')
            .populate({
              path: 'replyTo',
              populate: { path: 'sender', select: 'username avatarColor' }
            });

          messageData = populatedMessage.toObject();
        }

        // Add tempId so sender can confirm delivery
        if (tempId) {
          socket.emit('message-delivered', { tempId, message: messageData });
        }

        // Direct message routing vs Room broadcast
        if (receiverId) {
          // Send to sender
          socket.emit('message-received', messageData);

          // Find receiver's sockets in this room and emit to them
          const roomClients = io.sockets.adapter.rooms.get(roomId);
          if (roomClients) {
            for (const clientSocketId of roomClients) {
              const clientUser = socketToUser[clientSocketId];
              if (clientUser && clientUser._id.toString() === receiverId) {
                io.to(clientSocketId).emit('message-received', messageData);
              }
            }
          }
        } else {
          // Broadcast to everyone in the room EXCEPT the sender
          socket.to(roomId).emit('message-received', messageData);
        }
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
    socket.on('raise-hand', async ({ raised }) => {
      const roomId = socketToRoom[socket.id];
      const user = socketToUser[socket.id];
      if (roomId) {
        socket.to(roomId).emit('peer-raise-hand', {
          socketId: socket.id,
          raised,
        });
        
        if (raised && user) {
          const memoryDb = require('../config/memoryDb');
          let roomDbId = null;
          if (memoryDb.isOnline()) {
             const Room = require('../models/Room');
             const dbRoom = await Room.findOne({ roomId });
             if (dbRoom) roomDbId = dbRoom._id;
          }
          createAndEmitTimelineEvent(io, roomId, roomDbId, 'hand_raise', `${user.username} raised hand`, `${user.username} has a question or comment.`, 'Hand', '#f59e0b', user._id);
        }
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

    // --- Host Controls ---
    socket.on('admit-user', ({ targetSocketId, user, roomId }) => {
      // Allow target user to join
      io.to(targetSocketId).emit('admitted');
      // The client will then re-emit join-room with a flag or we can force join them here
    });

    socket.on('kick-user', ({ targetSocketId }) => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        io.to(targetSocketId).emit('kicked');
        io.sockets.sockets.get(targetSocketId)?.leave(roomId);
        // Clean up mappings
        delete socketToRoom[targetSocketId];
        socket.to(roomId).emit('user-left', {
          socketId: targetSocketId,
        });
      }
    });

    socket.on('mute-user-mic', ({ targetSocketId }) => {
      io.to(targetSocketId).emit('force-mute-mic');
    });

    socket.on('mute-user-cam', ({ targetSocketId }) => {
      io.to(targetSocketId).emit('force-mute-cam');
    });

    socket.on('lock-room', ({ isLocked }) => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        io.to(roomId).emit('room-locked-state', { isLocked });
      }
    });

    socket.on('end-meeting', async () => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        try {
          const memoryDb = require('../config/memoryDb');
          if (memoryDb.isOnline()) {
            const dbRoom = await Room.findOne({ roomId });
            if (dbRoom) {
              const MeetingHistory = require('../models/MeetingHistory');
              await MeetingHistory.create({
                room: dbRoom._id,
                host: dbRoom.host,
                participants: dbRoom.participants,
                startedAt: dbRoom.createdAt || new Date(),
                endedAt: new Date(),
                duration: Math.floor((Date.now() - new Date(dbRoom.createdAt || Date.now()).getTime()) / 1000)
              });
            }
          }
        } catch (error) {
          console.error('Error saving meeting history on end-meeting:', error);
        }
        io.to(roomId).emit('meeting-ended');
      }
    });
    // -----------------------
    
    // Handle floating emoji reactions (sent to all in room)
    socket.on('send-floating-emoji', ({ emoji }) => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        socket.to(roomId).emit('floating-emoji-received', { emoji });
      }
    });

    // Handle message edit
    socket.on('edit-message', ({ messageId, newText }) => {
      const roomId = socketToRoom[socket.id];
      const user = socketToUser[socket.id];
      if (roomId && user) {
        // Update in DB async
        const Message = require('../models/Message');
        Message.findByIdAndUpdate(messageId, { text: newText, isEdited: true }).catch(() => {});
        io.to(roomId).emit('message-edited', { messageId, newText });
      }
    });

    // Handle message delete
    socket.on('delete-message', ({ messageId }) => {
      const roomId = socketToRoom[socket.id];
      const user = socketToUser[socket.id];
      if (roomId && user) {
        const Message = require('../models/Message');
        Message.findByIdAndUpdate(messageId, { text: '🗑️ This message was deleted', isDeleted: true }).catch(() => {});
        io.to(roomId).emit('message-deleted', { messageId });
      }
    });

    // Handle message read receipts
    socket.on('message-seen', ({ messageId }) => {
      const roomId = socketToRoom[socket.id];
      const user = socketToUser[socket.id];
      if (roomId && user) {
        socket.to(roomId).emit('message-seen-by', { messageId, seenBy: user.username });
      }
    });

    // Handle assign/remove co-host
    socket.on('assign-cohost', ({ targetSocketId }) => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        io.to(targetSocketId).emit('you-are-cohost');
        io.to(roomId).emit('cohost-assigned', { socketId: targetSocketId });
      }
    });

    // Handle disable/enable chat for room
    socket.on('toggle-chat', ({ disabled }) => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        socket.to(roomId).emit('chat-state-changed', { disabled });
      }
    });

    // Handle disable/enable screenshare for room
    socket.on('toggle-screenshare-perm', ({ disabled }) => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        socket.to(roomId).emit('screenshare-state-changed', { disabled });
      }
    });

    socket.on('screenshare-toggled', async ({ isSharing }) => {
      const roomId = socketToRoom[socket.id];
      const user = socketToUser[socket.id];
      if (roomId && user) {
          const memoryDb = require('../config/memoryDb');
          let roomDbId = null;
          if (memoryDb.isOnline()) {
             const Room = require('../models/Room');
             const dbRoom = await Room.findOne({ roomId });
             if (dbRoom) roomDbId = dbRoom._id;
          }
          const text = isSharing ? 'started screen sharing' : 'stopped screen sharing';
          createAndEmitTimelineEvent(io, roomId, roomDbId, 'screen_share', `${user.username} ${text}`, `${user.username} ${text}.`, 'Monitor', '#8b5cf6', user._id);
      }
    });

    socket.on('recording-toggled', async ({ isRecording }) => {
      const roomId = socketToRoom[socket.id];
      const user = socketToUser[socket.id];
      if (roomId && user) {
          const memoryDb = require('../config/memoryDb');
          let roomDbId = null;
          if (memoryDb.isOnline()) {
             const Room = require('../models/Room');
             const dbRoom = await Room.findOne({ roomId });
             if (dbRoom) roomDbId = dbRoom._id;
          }
          const text = isRecording ? 'started recording' : 'stopped recording';
          createAndEmitTimelineEvent(io, roomId, roomDbId, 'recording', `Recording ${isRecording ? 'Started' : 'Stopped'}`, `${user.username} ${text} the meeting.`, 'Video', '#ef4444', user._id);
      }
    });

    // Handle attendance report request — collect all currently connected users
    socket.on('get-attendance', () => {
      const roomId = socketToRoom[socket.id];
      if (!roomId) return;
      const roomClients = io.sockets.adapter.rooms.get(roomId);
      const attendees = [];
      if (roomClients) {
        for (const clientSocketId of roomClients) {
          const userData = socketToUser[clientSocketId];
          if (userData) {
            attendees.push({ socketId: clientSocketId, username: userData.username });
          }
        }
      }
      socket.emit('attendance-report', { attendees });
    });

    // Handle voice message
    socket.on('send-voice-message', ({ audioBase64 }) => {
      const roomId = socketToRoom[socket.id];
      const user = socketToUser[socket.id];
      if (roomId && user) {
        const msgData = {
          _id: `voice-${Date.now()}`,
          type: 'voice',
          audioBase64,
          sender: { _id: user._id, username: user.username, avatarColor: user.avatarColor },
          createdAt: new Date(),
        };
        io.to(roomId).emit('message-received', msgData);
      }
    });
    // -----------------------
    // TRANSLATION EVENTS
    // -----------------------
    socket.on('set-target-language', (lang) => {
      if (socketToUser[socket.id]) {
        socketToUser[socket.id].targetLanguage = lang || 'en';
      }
    });

    socket.on('speech-transcript', async ({ text, roomId }) => {
      const user = socketToUser[socket.id];
      if (!user || !text.trim()) return;

      const roomClients = io.sockets.adapter.rooms.get(roomId);
      if (!roomClients) return;

      const Transcript = require('../models/Transcript');
      const { translateText } = require('../services/translationService');
      const memoryDb = require('../config/memoryDb');

      // Find room _id
      let roomObjId = null;
      if (!memoryDb.isOnline()) {
         const memoryRoom = memoryDb.rooms.find(r => r.roomId === roomId);
         if (memoryRoom) roomObjId = memoryRoom._id;
      } else {
         const dbRoom = await Room.findOne({ roomId }).select('_id');
         if (dbRoom) roomObjId = dbRoom._id;
      }

      // Group clients by target language
      const clientsByLang = {};
      for (const clientId of roomClients) {
        const targetLang = socketToUser[clientId]?.targetLanguage || 'en';
        if (!clientsByLang[targetLang]) clientsByLang[targetLang] = [];
        clientsByLang[targetLang].push(clientId);
      }

      // Translate and broadcast for each language group
      for (const [lang, clients] of Object.entries(clientsByLang)) {
        let translated = text;
        if (lang !== 'en') {
          translated = await translateText(text, lang);
        }

        const captionPayload = {
          speaker: user.username,
          originalText: text,
          translatedText: translated,
          language: lang,
          timestamp: new Date()
        };

        // Broadcast to clients listening in this language
        for (const clientId of clients) {
          io.to(clientId).emit('live-caption', captionPayload);
        }

        // Save translation to DB async
        if (roomObjId && memoryDb.isOnline()) {
          const t = new Transcript({
            room: roomObjId,
            speaker: user._id,
            originalText: text,
            translatedText: translated,
            targetLanguage: lang
          });
          t.save().catch(err => console.error('Failed to save transcript:', err));
        }
      }
      
      // Simple NLP Intent Detection for AI Timeline
      const lowerText = text.toLowerCase();
      if (lowerText.includes('we decided') || lowerText.includes('decision is') || lowerText.includes('agreed to')) {
        createAndEmitTimelineEvent(io, roomId, roomObjId, 'decision', 'Decision Made', `"${text}"`, 'CheckCircle', '#10b981', null);
      } else if (lowerText.includes('your task is') || lowerText.includes('please do') || lowerText.includes('will do') || lowerText.includes('assign')) {
        createAndEmitTimelineEvent(io, roomId, roomObjId, 'task', 'Action Item / Task', `"${text}"`, 'ListTodo', '#3b82f6', null);
      } else if (lowerText.includes('important') || lowerText.includes('highlight') || lowerText.includes('key point')) {
        createAndEmitTimelineEvent(io, roomId, roomObjId, 'highlight', 'Important Point', `"${text}"`, 'Star', '#f59e0b', null);
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
          let roomDbId = null;

          if (!memoryDb.isOnline()) {
            const room = memoryDb.rooms.find(r => r.roomId === roomId);
            if (room) {
              roomDbId = room._id;
              room.participants = room.participants.filter(
                (p) => p._id.toString() !== user._id.toString()
              );
            }
          } else {
            // Remove user from DB room participants list
            const Room = require('../models/Room');
            const room = await Room.findOne({ roomId });
            if (room) {
              roomDbId = room._id;
              room.participants = room.participants.filter(
                (pId) => pId.toString() !== user._id.toString()
              );
              await room.save();
            }
          }

          createAndEmitTimelineEvent(io, roomId, roomDbId, 'leave', `${user.username} left`, `Participant ${user.username} has left the room.`, 'LogOut', '#ef4444', user._id);
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
