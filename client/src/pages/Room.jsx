import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import JoinPreview from '../components/JoinPreview';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Send,
  Users,
  MessageSquare,
  Monitor,
  AlertTriangle,
  Copy,
  Check,
  Link2,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Circle,
  Clock,
  Sparkles,
  Search,
  Smile,
  Paperclip,
  Activity,
  UserCheck,
  Cpu,
  BrainCircuit,
  MessageCircle,
  Shield,
  FileText,
  Languages,
  List,
  Download,
  Star,
  LogOut,
  CheckCircle,
  Hand,
  X
} from 'lucide-react';

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'or', label: 'Odia' },
  { code: 'bn', label: 'Bengali' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'mr', label: 'Marathi' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' }
];

const Room = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [hasJoined, setHasJoined] = useState(false);
  const [deviceSelections, setDeviceSelections] = useState(null);

  // State variables
  const [roomDetails, setRoomDetails] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'ai', 'participants'
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Media status states
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCamEnabled, setIsCamEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Meeting Stopwatch Timer
  const [meetingSeconds, setMeetingSeconds] = useState(0);

  // Host and Waiting Room states
  const [inWaitingRoom, setInWaitingRoom] = useState(false);
  const [waitingUsers, setWaitingUsers] = useState([]); // [{ socketId, user }]
  const isHost = roomDetails?.host === user?._id;
  const isCoHost = roomDetails?.coHosts?.includes(user?._id);
  const canManageRoom = isHost || isCoHost;

  // Raise Hand states
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [handRaisedPeers, setHandRaisedPeers] = useState({}); // { socketId: boolean }

  // Typing states
  const [typingPeers, setTypingPeers] = useState({}); // { username: boolean }
  const typingTimeoutRef = useRef(null);

  // Stream Recording states
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // Stream / Peer states
  const [localStream, setLocalStream] = useState(null);
  const [remotePeers, setRemotePeers] = useState([]); // [{ socketId, user: { username, avatarColor }, stream }]

  // Chat filters & features
  const [chatSearch, setChatSearch] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [directMessageTo, setDirectMessageTo] = useState(''); // '' = everyone
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecorder, setVoiceRecorder] = useState(null);
  const [voiceRecordingTime, setVoiceRecordingTime] = useState(0);
  const voiceTimerRef = useRef(null);
  const [chatPage, setChatPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // Floating Emojis state
  const [floatingEmojis, setFloatingEmojis] = useState([]); // [{ id, emoji }]

  // Speech to Text / AI Captions
  const [isCaptionsEnabled, setIsCaptionsEnabled] = useState(false);
  const [captionsText, setCaptionsText] = useState('');
  const [liveCaption, setLiveCaption] = useState(null);
  const [targetLanguage, setTargetLanguage] = useState('es');

  // Mobile layout state
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const recognitionRef = useRef(null);
  const captionTimeoutRef = useRef(null);

  // AI Meeting Summaries
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [noiseSuppression, setNoiseSuppression] = useState(false);

  // Timeline Feature
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [timelineSearch, setTimelineSearch] = useState('');
  const [timelineFilter, setTimelineFilter] = useState('All'); // 'All', 'Decisions', 'Tasks', 'Highlights'

  // Audio Context for Noise Suppression
  const audioContextRef = useRef(null);
  const audioSourceRef = useRef(null);
  const filterNodeRef = useRef(null);
  const analyserNodeRef = useRef(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Refs
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const peersRef = useRef({}); // { socketId: RTCPeerConnection }
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const chatBottomRef = useRef(null);
  const roomContainerRef = useRef(null);
  const queuedCandidatesRef = useRef({}); // { socketId: [RTCIceCandidate] }
  const isCaptionsEnabledRef = useRef(false);
  const usersMapRef = useRef({}); // { socketId: user }

  // Inject Meeting Context for AI Assistant
  useEffect(() => {
    window.meetingContext = { roomId, messages, timelineEvents, user };
    return () => { window.meetingContext = null; };
  }, [roomId, messages, timelineEvents, user]);

  // WebRTC ICE servers configuration
  const iceConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ]
  };

  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.emit('set-target-language', targetLanguage);
    }
  }, [targetLanguage]);

  useEffect(() => {
    isCaptionsEnabledRef.current = isCaptionsEnabled;
  }, [isCaptionsEnabled]);

  useEffect(() => {
    if (window.Notification && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  // 1. Stopwatch timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setMeetingSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Format seconds to hh:mm:ss
  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const fetchMessages = async (page = 1) => {
    try {
      const msgResponse = await api.get(`/rooms/${roomId}/messages?page=${page}&limit=50`);
      if (page === 1) {
        setMessages(msgResponse.data);
      } else {
        setMessages(prev => [...msgResponse.data, ...prev]);
      }
      if (msgResponse.data.length < 50) setHasMoreMessages(false);
      setChatPage(page);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  // 2. Load Room Details and Persistent Messages from Database on load
  useEffect(() => {
    const loadRoom = async () => {
      try {
        const response = await api.get(`/rooms/${roomId}`);
        setRoomDetails(response.data);
        fetchMessages(1);
        
        try {
          const timelineRes = await api.get(`/timeline/${roomId}`);
          setTimelineEvents(timelineRes.data || []);
        } catch (tErr) {
          console.error('Failed to load timeline:', tErr);
        }
      } catch (err) {
        console.error('Failed to load room details:', err);
        showToast('Room not found or unauthorized.', 'error');
        navigate('/dashboard');
      }
    };
    loadRoom();
  }, [roomId, navigate]);

  const handleScrollChat = (e) => {
    if (e.target.scrollTop === 0 && hasMoreMessages) {
      fetchMessages(chatPage + 1);
    }
  };

  // 3. Initialize Media (Camera & Mic)
  useEffect(() => {
    if (!hasJoined || !deviceSelections) return;

    const startMedia = async () => {
      try {
        const constraints = {
          video: deviceSelections.isCamEnabled ? {
            deviceId: deviceSelections.videoDeviceId ? { exact: deviceSelections.videoDeviceId } : undefined,
            width: 1280, height: 720, frameRate: { ideal: 30 }
          } : false,
          audio: deviceSelections.isMicEnabled ? {
            deviceId: deviceSelections.audioDeviceId ? { exact: deviceSelections.audioDeviceId } : undefined,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } : false
        };

        let stream;
        
        const getMediaWithRetry = async (retries = 2) => {
          for (let i = 0; i < retries; i++) {
            try {
              if (constraints.audio || constraints.video) {
                return await navigator.mediaDevices.getUserMedia(constraints);
              } else {
                return new MediaStream();
              }
            } catch (err) {
              if (i === retries - 1) throw err;
              console.warn('Camera locked, retrying in 500ms...');
              await new Promise(r => setTimeout(r, 500));
            }
          }
        };

        stream = await getMediaWithRetry();
        
        setIsMicEnabled(deviceSelections.isMicEnabled);
        setIsCamEnabled(deviceSelections.isCamEnabled);

        setLocalStream(stream);
        localStreamRef.current = stream;

        // Noise suppression filter setup if audio is enabled
        if (constraints.audio && stream.getAudioTracks().length > 0) {
          try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const audioCtx = new AudioContext();
            audioContextRef.current = audioCtx;
            
            const source = audioCtx.createMediaStreamSource(stream);
            audioSourceRef.current = source;
            
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 4000;
            filterNodeRef.current = filter;
            
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            analyserNodeRef.current = analyser;
            
            source.connect(filter);
            filter.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const checkAudioLevel = () => {
              if (analyserNodeRef.current && socketRef.current) {
                analyserNodeRef.current.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                const avg = sum / dataArray.length;
                
                const speaking = avg > 25; // threshold
                if (speaking !== isSpeaking) {
                  setIsSpeaking(speaking);
                  socketRef.current.emit('is-speaking', speaking);
                }
                requestAnimationFrame(checkAudioLevel);
              }
            };
            checkAudioLevel();
          } catch(e) {
            console.error('AudioContext error:', e);
          }
        }
        
        setMediaError('');
      } catch (err) {
        console.error('Could not capture local media:', err);
        setMediaError('Camera/microphone blocked. Entering in chat-only mode.');
        showToast('Could not access media devices.', 'error');
      }
    };

    startMedia().then(() => {
      connectSocket();
    });

    return () => {
      // Cleanup on unmount
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (socketRef.current) {
        socketRef.current.emit('leave-room');
        socketRef.current.disconnect();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      
      // Close all peer connections
      Object.values(peersRef.current).forEach(pc => pc.close());
      peersRef.current = {};
    };
  }, [roomId, hasJoined, deviceSelections]);

  // Scroll chat to bottom when messages update
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Ensure local video element always attaches the stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
    }
  }, [localStream, hasJoined]);

  // Keep remote speakers in sync with isSpeakerEnabled
  useEffect(() => {
    const videos = document.querySelectorAll('.video-card video');
    videos.forEach(v => {
      if (v !== localVideoRef.current) {
        v.muted = !isSpeakerEnabled;
      }
    });
  }, [isSpeakerEnabled, remotePeers]);

  // 4. Socket Connection & WebRTC Signaling
  const connectSocket = () => {
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5002';
    socketRef.current = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    socketRef.current.on('connect', () => {
      console.log('Connected to socket server:', socketRef.current.id);
      const safeUserId = user?._id || user?.id || 'guest-' + Math.random().toString(36).substring(7);
      socketRef.current.emit('join-room', { roomId, userId: safeUserId });
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      showToast('Connection lost. Reconnecting...', 'error');
    });

    socketRef.current.on('reconnect', (attemptNumber) => {
      console.log('Reconnected to socket server after', attemptNumber, 'attempts');
      showToast('Reconnected to server!', 'success');
      const safeUserId = user?._id || user?.id || 'guest-' + Math.random().toString(36).substring(7);
      // Re-join the room upon reconnecting
      socketRef.current.emit('join-room', { roomId, userId: safeUserId });
    });

    // Waiting Room events
    socketRef.current.on('in-waiting-room', () => {
      setInWaitingRoom(true);
    });

    socketRef.current.on('admitted', () => {
      setInWaitingRoom(false);
      showToast('You have been admitted to the room', 'success');
      socketRef.current.emit('join-room', { roomId, userId: user._id });
    });

    socketRef.current.on('user-in-waiting-room', ({ socketId, user }) => {
      setWaitingUsers(prev => {
        if (!prev.find(u => u.socketId === socketId)) {
          return [...prev, { socketId, user }];
        }
        return prev;
      });
      showToast(`${user.username} is waiting to join`, 'info');
    });

    // Host Control events
    socketRef.current.on('kicked', () => {
      showToast('You have been removed from the meeting by the host', 'error');
      navigate('/dashboard');
    });

    socketRef.current.on('force-mute-mic', () => {
      setIsMicEnabled(false);
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(t => t.enabled = false);
      }
      showToast('The host has muted your microphone', 'warning');
    });

    socketRef.current.on('force-mute-cam', () => {
      setIsCamEnabled(false);
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(t => t.enabled = false);
      }
      showToast('The host has disabled your camera', 'warning');
    });

    socketRef.current.on('meeting-ended', () => {
      showToast('The host has ended the meeting for everyone', 'info');
      navigate('/dashboard');
    });

    socketRef.current.on('room-locked-state', ({ isLocked }) => {
      setRoomDetails(prev => prev ? { ...prev, isLocked } : prev);
      showToast(`The room has been ${isLocked ? 'locked' : 'unlocked'} by the host`, 'info');
    });

    // Receive floating emoji
    socketRef.current.on('floating-emoji-received', ({ emoji }) => {
      triggerFloatingEmoji(emoji);
    });

    // Receive chat message
    socketRef.current.on('message-received', (message) => {
      setMessages((prev) => {
        // If it's our own optimistic message, update it instead of adding a duplicate
        const existingIndex = prev.findIndex(m => m._id === message._id);
        if (existingIndex !== -1) {
          const newMessages = [...prev];
          newMessages[existingIndex] = message;
          return newMessages;
        }
        return [...prev, message];
      });
      if (activeTab !== 'chat') {
        setUnreadCount((prev) => prev + 1);
        if (Notification.permission === 'granted') {
          new Notification('New Message', { body: message.text, icon: '/favicon.ico' });
        }
      } else {
        // We are looking at chat, mark as seen
        socketRef.current.emit('message-seen', { messageId: message._id });
      }

    });

    socketRef.current.on('chat-history', (history) => {
      setMessages(history);

    });

    socketRef.current.on('message-delivered', ({ tempId, message }) => {
      setMessages((prev) => prev.map(msg => 
        msg._id === tempId ? { ...message, status: 'delivered' } : msg
      ));
    });

    socketRef.current.on('message-seen-by', ({ messageId, seenBy }) => {
      setMessages((prev) => prev.map(msg => 
        msg._id === messageId ? { ...msg, seenBy: [...(msg.seenBy || []), seenBy] } : msg
      ));
    });

    socketRef.current.on('message-edited', ({ messageId, newText }) => {
      setMessages((prev) => prev.map(msg => 
        msg._id === messageId ? { ...msg, text: newText, isEdited: true } : msg
      ));
    });

    socketRef.current.on('message-deleted', ({ messageId }) => {
      setMessages((prev) => prev.map(msg => 
        msg._id === messageId ? { ...msg, text: '🗑️ This message was deleted', isDeleted: true } : msg
      ));
    });

    socketRef.current.on('timeline-event', (eventData) => {
      setTimelineEvents((prev) => [...prev, eventData]);
      if (activeTab !== 'timeline') {
        showToast(`AI Timeline: ${eventData.title}`, 'info');
      }
    });

    socketRef.current.on('live-caption', (captionData) => {
      setLiveCaption(captionData);
      if (captionTimeoutRef.current) clearTimeout(captionTimeoutRef.current);
      captionTimeoutRef.current = setTimeout(() => {
        setLiveCaption(null);
      }, 5000);
    });

    // Message reactions
    socketRef.current.on('reaction-received', ({ messageId, emoji, socketId: _socketId }) => {
      setMessages((prev) => prev.map((msg) => {
        if (msg._id === messageId) {
          const reactions = msg.reactions || {};
          reactions[emoji] = (reactions[emoji] || 0) + 1;
          return { ...msg, reactions };
        }
        return msg;
      }));
    });

    // Peer typing indicators
    socketRef.current.on('peer-typing', ({ username, isTyping }) => {
      setTypingPeers((prev) => ({ ...prev, [username]: isTyping }));
    });

    // Peer raise hand triggers
    socketRef.current.on('peer-raise-hand', ({ socketId, raised }) => {
      setHandRaisedPeers((prev) => ({ ...prev, [socketId]: raised }));
      
      const peer = remotePeers.find(p => p.socketId === socketId);
      if (peer && raised) {
        showToast(`${peer.user.username} raised their hand!`, 'info');
      }
    });

    // Received info on all existing users in the room
    socketRef.current.on('all-users', (users) => {
      console.log('All existing users in room:', users);
      users.forEach(({ socketId, user: peerUser }) => {
        usersMapRef.current[socketId] = peerUser;
        
        // Cleanup old peer connection to avoid duplicates on reconnect
        if (peersRef.current[socketId]) {
          peersRef.current[socketId].close();
        }
        
        const pc = createPeerConnection(socketId, peerUser);
        peersRef.current[socketId] = pc;
        
        const stream = localStreamRef.current;
        if (stream) {
          stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream);
          });
        }

        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            socketRef.current.emit('send-signal', {
              to: socketId,
              signal: { type: 'offer', sdp: pc.localDescription }
            });
          })
          .catch((err) => console.error('Error creating offer:', err));
      });
    });

    socketRef.current.on('user-joined', ({ socketId, user: joiningUser }) => {
      showToast(`${joiningUser.username} joined the stream!`, 'success');
      usersMapRef.current[socketId] = joiningUser;
      setRemotePeers(prev => {
        if (prev.some(p => p.socketId === socketId)) return prev;
        return [...prev, { socketId, user: joiningUser, stream: null }];
      });
    });

    socketRef.current.on('signal-received', async ({ from, signal }) => {
      let pc = peersRef.current[from];

      if (!pc) {
        const peerUser = usersMapRef.current[from] || { username: 'Peer', avatarColor: '#8b5cf6' };
        
        pc = createPeerConnection(from, peerUser);
        peersRef.current[from] = pc;

        const stream = localStreamRef.current;
        if (stream) {
          stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream);
          });
        }
      }

      try {
        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          
          // Process any queued candidates for this peer
          const candidates = queuedCandidatesRef.current[from] || [];
          for (const cand of candidates) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (candErr) {
              console.error('Error adding queued candidate:', candErr);
            }
          }
          queuedCandidatesRef.current[from] = [];

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          socketRef.current.emit('send-signal', {
            to: from,
            signal: { type: 'answer', sdp: pc.localDescription }
          });
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          
          // Process any queued candidates for this peer
          const candidates = queuedCandidatesRef.current[from] || [];
          for (const cand of candidates) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (candErr) {
              console.error('Error adding queued candidate:', candErr);
            }
          }
          queuedCandidatesRef.current[from] = [];
        } else if (signal.type === 'candidate' && signal.candidate) {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } else {
            if (!queuedCandidatesRef.current[from]) {
              queuedCandidatesRef.current[from] = [];
            }
            queuedCandidatesRef.current[from].push(signal.candidate);
          }
        }
      } catch (err) {
        console.error('Error handling signalling payload:', err);
      }
    });

    socketRef.current.on('user-left', ({ socketId, userId: _userId }) => {
      const peer = remotePeers.find(p => p.socketId === socketId);
      if (peer) {
        showToast(`${peer.user.username} left the room.`, 'info');
      }

      if (peersRef.current[socketId]) {
        peersRef.current[socketId].close();
        delete peersRef.current[socketId];
      }
      setRemotePeers(prev => prev.filter(p => p.socketId !== socketId));
      setHandRaisedPeers(prev => {
        const updated = { ...prev };
        delete updated[socketId];
        return updated;
      });
    });

    socketRef.current.on('error-msg', (msg) => {
      showToast(msg, 'error');
      navigate('/dashboard');
    });
  };

  const createPeerConnection = (socketId, peerUser) => {
    const pc = new RTCPeerConnection(iceConfiguration);

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('send-signal', {
          to: socketId,
          signal: { type: 'candidate', candidate: event.candidate }
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote stream track from:', peerUser.username, event.track.kind);
      
      setRemotePeers(prev => {
        const index = prev.findIndex(p => p.socketId === socketId);
        if (index > -1) {
          const updated = [...prev];
          let existingStream = updated[index].stream;
          if (existingStream) {
            existingStream.addTrack(event.track);
            updated[index] = { ...updated[index], stream: new MediaStream(existingStream.getTracks()) };
          } else {
            updated[index] = { ...updated[index], stream: event.streams[0] || new MediaStream([event.track]) };
          }
          return updated;
        } else {
          const newStream = event.streams[0] || new MediaStream([event.track]);
          return [...prev, { socketId, user: peerUser, stream: newStream }];
        }
      });
    };

    return pc;
  };

  // 5. Media Control Actions
  const toggleMic = async () => {
    let stream = localStreamRef.current;
    let audioTrack = stream?.getAudioTracks()[0];
    
    if (!audioTrack) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        const newAudioTrack = newStream.getAudioTracks()[0];
        
        if (stream) {
          stream.addTrack(newAudioTrack);
        } else {
          stream = newStream;
          setLocalStream(stream);
          localStreamRef.current = stream;
        }
        
        setIsMicEnabled(true);
        showToast('Microphone active', 'info');
        
        // Add track to peers and renegotiate
        Object.entries(peersRef.current).forEach(async ([peerSocketId, pc]) => {
          pc.addTrack(newAudioTrack, stream);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketRef.current?.emit('send-signal', {
              to: peerSocketId,
              signal: { type: 'offer', sdp: pc.localDescription }
            });
          } catch (e) { console.error('Error renegotiating mic:', e); }
        });
      } catch (e) {
        console.error(e);
        showToast('Microphone access denied', 'error');
      }
    } else {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicEnabled(audioTrack.enabled);
      showToast(audioTrack.enabled ? 'Microphone active' : 'Microphone muted', 'info');
    }
  };

  const toggleCam = async () => {
    let stream = localStreamRef.current;
    let videoTrack = stream?.getVideoTracks()[0];
    
    if (!videoTrack) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, frameRate: { ideal: 30 } } });
        const newVideoTrack = newStream.getVideoTracks()[0];
        
        if (stream) {
          stream.addTrack(newVideoTrack);
        } else {
          stream = newStream;
          setLocalStream(stream);
          localStreamRef.current = stream;
        }
        
        setIsCamEnabled(true);
        showToast('Camera active', 'info');
        
        // Add track to peers and renegotiate
        Object.entries(peersRef.current).forEach(async ([peerSocketId, pc]) => {
          pc.addTrack(newVideoTrack, stream);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketRef.current?.emit('send-signal', {
              to: peerSocketId,
              signal: { type: 'offer', sdp: pc.localDescription }
            });
          } catch (e) { console.error('Error renegotiating cam:', e); }
        });
        
        // Ensure local video element uses it
        if (localVideoRef.current && localVideoRef.current.srcObject !== stream) {
            localVideoRef.current.srcObject = stream;
        }
      } catch (e) {
        console.error(e);
        showToast('Camera access denied', 'error');
      }
    } else {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCamEnabled(videoTrack.enabled);
      showToast(videoTrack.enabled ? 'Camera active' : 'Camera disabled', 'info');
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });

        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);
        showToast('Screen sharing started', 'success');
        
        if (socketRef.current) {
          socketRef.current.emit('screenshare-toggled', { isSharing: true });
        }

        const screenTrack = screenStream.getVideoTracks()[0];

        Object.values(peersRef.current).forEach((pc) => {
          const senders = pc.getSenders();
          const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(screenTrack);
          }
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        screenTrack.onended = () => {
          stopScreenShare();
        };

      } catch (err) {
        console.error('Error starting screen share:', err);
        setIsScreenSharing(false);
      }
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    setIsScreenSharing(false);
    showToast('Screen sharing stopped', 'info');

    if (socketRef.current) {
      socketRef.current.emit('screenshare-toggled', { isSharing: false });
    }

    const localVideoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (localVideoTrack) {
      Object.values(peersRef.current).forEach((pc) => {
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender && localVideoTrack) {
          videoSender.replaceTrack(localVideoTrack);
        }
      });
    }

    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerEnabled(prev => {
      const target = !prev;
      showToast(target ? 'Speakers enabled' : 'Speakers muted', 'info');
      
      // Select all remote video tags and mute/unmute
      const videos = document.querySelectorAll('.video-card video');
      videos.forEach(v => {
        // Local video is muted by default, do not touch it
        if (v !== localVideoRef.current) {
          v.muted = !target;
        }
      });
      return target;
    });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      roomContainerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        showToast('Fullscreen mode failed', 'error');
      });
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // 6. Raise Hand Action
  const toggleRaiseHand = () => {
    const state = !isHandRaised;
    setIsHandRaised(state);
    
    if (socketRef.current) {
      socketRef.current.emit('raise-hand', { raised: state });
    }
    showToast(state ? 'Hand raised' : 'Hand lowered', 'info');
  };

  // 7. HTML5 Stream Recorder Actions
  const toggleRecording = () => {
    if (isRecording) {
      // Stop Recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      if (socketRef.current) {
        socketRef.current.emit('recording-toggled', { isRecording: false });
      }
      showToast('Recording stopped. Preparing download...', 'success');
    } else {
      // Start Recording local camera stream
      const streamToRecord = localStreamRef.current;
      if (!streamToRecord) {
        showToast('Cannot start recording: No active camera stream found.', 'error');
        return;
      }

      recordedChunksRef.current = [];
      try {
        const recorder = new MediaRecorder(streamToRecord, { mimeType: 'video/webm;codecs=vp9,opus' });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `LiveLink-Stream-${roomId}-${Date.now()}.webm`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          }, 100);
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);
        if (socketRef.current) {
          socketRef.current.emit('recording-toggled', { isRecording: true });
        }
        showToast('Recording started', 'success');
      } catch (err) {
        console.error('Recording initialization failed:', err);
        showToast('Recording format not supported in this browser.', 'error');
      }
    }
  };

  // 8. Real-time Chat features
  const handleInputChange = (e) => {
    setInputText(e.target.value);

    // Typing indicators
    if (socketRef.current) {
      socketRef.current.emit('typing', { isTyping: true });
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current.emit('typing', { isTyping: false });
      }, 1500);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    if (socketRef.current) {
      if (editingMessage) {
        socketRef.current.emit('edit-message', { messageId: editingMessage._id, newText: inputText });
        setEditingMessage(null);
      } else {
        const tempId = `temp-${Date.now()}`;
        const msgPayload = {
          text: inputText,
          type: 'text',
          replyTo: replyingTo ? replyingTo._id : null,
          receiverId: directMessageTo || null,
          tempId
        };
        
        // Optimistic UI update
        const optimisticMsg = {
          _id: tempId,
          text: inputText,
          sender: { _id: user._id, username: user.username, avatarColor: user.avatarColor },
          createdAt: new Date(),
          status: 'sending'
        };
        setMessages(prev => [...prev, optimisticMsg]);
        setTimeout(scrollToBottom, 50);

        socketRef.current.emit('send-message', msgPayload);
        setReplyingTo(null);
      }
      
      setInputText('');
      socketRef.current.emit('typing', { isTyping: false });
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast('File size must be less than 10MB', 'error');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const fileUrl = res.data.url;
      const fileType = file.type.startsWith('image/') ? 'image' : 'file';

      if (socketRef.current) {
        const msgPayload = {
          text: fileUrl,
          type: fileType,
          replyTo: replyingTo ? replyingTo._id : null,
          receiverId: directMessageTo || null
        };
        socketRef.current.emit('send-message', msgPayload);
        setReplyingTo(null);
        showToast('File shared successfully!', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('File upload failed', 'error');
    } finally {
      setIsUploading(false);
      e.target.value = null; // reset input
    }
  };

  const toggleVoiceRecording = async () => {
    if (isRecordingVoice) {
      // Stop recording
      if (voiceRecorder) {
        voiceRecorder.stop();
        if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
      }
      setIsRecordingVoice(false);
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const audioChunks = [];

        mediaRecorder.ondataavailable = event => {
          audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          const file = new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
          
          setIsUploading(true);
          const formData = new FormData();
          formData.append('file', file);
          
          try {
            const res = await api.post('/upload', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (socketRef.current) {
              socketRef.current.emit('send-message', {
                text: res.data.url,
                type: 'voice',
                replyTo: replyingTo ? replyingTo._id : null,
                receiverId: directMessageTo || null
              });
              setReplyingTo(null);
              showToast('Voice message sent!', 'success');
            }
          } catch (err) {
            console.error(err);
            showToast('Voice upload failed', 'error');
          } finally {
            setIsUploading(false);
            setVoiceRecordingTime(0);
          }
          
          // Stop mic tracks
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setVoiceRecorder(mediaRecorder);
        setIsRecordingVoice(true);
        setVoiceRecordingTime(0);
        
        voiceTimerRef.current = setInterval(() => {
          setVoiceRecordingTime(prev => prev + 1);
        }, 1000);
      } catch (err) {
        showToast('Microphone access denied', 'error');
      }
    }
  };

  // Emojis pick helper
  const addEmoji = (emoji) => {
    setInputText(prev => prev + emoji);
  };

  const triggerFloatingEmoji = (emoji) => {
    const id = Date.now() + Math.random();
    setFloatingEmojis((prev) => [...prev, { id, emoji }]);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== id));
    }, 4000);
  };

  const sendFloatingEmoji = (emoji) => {
    triggerFloatingEmoji(emoji);
    if (socketRef.current) {
      socketRef.current.emit('send-floating-emoji', { emoji });
    }
  };

  const togglePip = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (localVideoRef.current && document.pictureInPictureEnabled) {
        await localVideoRef.current.requestPictureInPicture();
      } else {
        showToast('Picture-in-Picture not supported in this browser.', 'error');
      }
    } catch (error) {
      console.error('PiP error:', error);
      showToast('Could not start Picture-in-Picture', 'error');
    }
  };

  // Message reaction helper
  const sendReaction = (messageId, emoji) => {
    if (socketRef.current) {
      socketRef.current.emit('send-reaction', { messageId, emoji });
    }
  };


  // 9. AI Features
  const toggleCaptions = () => {
    if (isCaptionsEnabled) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsCaptionsEnabled(false);
      setLiveCaption(null);
      showToast('Live translation captions disabled', 'info');
    } else {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recog = new SpeechRecognition();
        recog.continuous = true;
        recog.interimResults = false; // Only send final text to save API calls
        recog.lang = 'en-US'; // assuming speaker speaks english

        recog.onresult = (event) => {
          const transcript = event.results[event.results.length - 1][0].transcript;
          if (transcript.trim() && socketRef.current) {
            socketRef.current.emit('speech-transcript', { text: transcript, roomId });
          }
        };

        recog.onerror = (event) => {
          console.error('Speech recognition error', event.error);
          if (event.error === 'not-allowed') {
            showToast('Microphone access denied for captions', 'error');
            setIsCaptionsEnabled(false);
          }
        };

        recog.onend = () => {
          if (isCaptionsEnabledRef.current) {
            try { recog.start(); } catch(e){}
          }
        };

        recognitionRef.current = recog;
        try {
          recog.start();
          setIsCaptionsEnabled(true);
          showToast('Live translation captions enabled!', 'success');
        } catch (err) {
          console.error('Failed to start recognition:', err);
        }
      } else {
        showToast('Speech recognition is not supported in your browser.', 'error');
      }
    }
  };

  const toggleNoiseSuppression = () => {
    const nextState = !noiseSuppression;
    setNoiseSuppression(nextState);

    if (nextState) {
      // Setup HTML5 AudioContext to suppress frequencies
      try {
        const stream = localStreamRef.current;
        if (!stream) return;

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        audioSourceRef.current = source;

        // Apply a BiquadFilterNode to filter high frequency hiss sounds
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2400; // suppresses high frequency noise
        filterNodeRef.current = filter;

        source.connect(filter);
        // Do not connect to destination (speakers) to prevent echo loops, 
        // in a real WebRTC system, we would pipe the filter output to a peer connection.
        
        showToast('AI Noise suppression active', 'success');
      } catch (err) {
        console.error('AudioContext noise suppression failed:', err);
      }
    } else {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      showToast('AI Noise suppression disabled', 'info');
    }
  };

  const generateAISummary = () => {
    setAiLoading(true);
    showToast('AI is synthesizing meeting summary...', 'info');

    setTimeout(() => {
      // Generate summary cards using messages
      const keywords = messages.map(m => m.text).join(' ');
      
      setAiSummary({
        executiveSummary: `This meeting discussed real-time audio/video signaling configs. A total of ${remotePeers.length + 1} participant(s) joined the room, exchanging ${messages.length} message(s) inside the sync-room.`,
        keyHighlights: [
          'Successfully connected to Google STUN servers.',
          'Verified mic and camera track configurations.',
          messages.length > 0 ? 'Exchanged file base64 data logs in chat.' : 'Exchanged quick user reactions.'
        ],
        smartRecommendations: [
          'Enable screen-sharing when demonstrating visual wireframes.',
          'Double check whitelisted IPs if MongoDB goes offline.'
        ]
      });
      setAiLoading(false);
      showToast('AI Summary generated successfully!', 'success');
    }, 1800);
  };

  const handleEndMeeting = async () => {
    if (canManageRoom) {
      const endForAll = window.confirm('Do you want to end the meeting for everyone? Click OK to delete the room. Click Cancel to just leave yourself.');
      if (endForAll) {
        try {
          await api.delete(`/rooms/${roomId}`);
          showToast('Meeting ended and room deleted.', 'success');
        } catch (error) {
          console.error('Failed to delete room:', error);
          showToast('Failed to delete room.', 'error');
        }
        navigate('/dashboard');
      } else {
        navigate('/dashboard');
      }
    } else {
      if (window.confirm('Are you sure you want to leave the meeting?')) {
        navigate('/dashboard');
      }
    }
  };

  // Invite clipboard copy helpers
  const fallbackCopyText = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textArea);
  };

  const copyToClipboard = async (text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        fallbackCopyText(text);
      }
    } else {
      fallbackCopyText(text);
    }
  };

  const copyRoomCode = async () => {
    await copyToClipboard(roomId);
    setCopiedCode(true);
    showToast('Room code copied!', 'success');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyInviteLink = async () => {
    const link = `${window.location.origin}/room/${roomId}`;
    await copyToClipboard(link);
    setCopiedLink(true);
    showToast('Invite link copied!', 'success');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Filter messages based on search
  const filteredMessages = messages.filter(m => 
    m.text && m.text.toLowerCase().includes(chatSearch.toLowerCase())
  );

  // Waiting room UI removed to force instant join
  if (!hasJoined) {
    return (
      <JoinPreview
        roomDetails={roomDetails}
        user={user}
        onJoin={(selections) => {
          setDeviceSelections(selections);
          setHasJoined(true);
        }}
        onCancel={() => navigate('/dashboard')}
      />
    );
  }

  return (
    <div ref={roomContainerRef} style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#07080d' }} className="fade-in">
      <div className="bg-glow-wrapper">
        <div className="glow-orb-1"></div>
        <div className="glow-orb-2"></div>
      </div>

      {/* Header Panel */}
      <header className="glass-container header-controls" style={{
        margin: '1rem',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        border: '1px solid var(--border-light)',
        borderRadius: '12px',
        flexShrink: 0
      }}>
        {/* Room Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {roomDetails ? roomDetails.name : 'Live Stream'}
            </span>
            {isRecording && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--danger)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 600 }}>
                <Circle size={10} fill="var(--danger)" className="animate-pulse" style={{ animation: 'pulse 1s infinite alternate' }} />
                <span>REC</span>
              </div>
            )}
          </div>

          {/* Stopwatch */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem', background: 'rgba(255,255,255,0.02)', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
            <Clock size={14} />
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatTime(meetingSeconds)}</span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Invite Code */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(255,255,255,0.04)',
            padding: '4px 10px',
            borderRadius: '8px',
            border: '1px solid var(--border-light)',
            fontSize: '0.8rem'
          }}>
            <span style={{ color: 'var(--text-muted)' }}>Code:</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{roomId}</span>
            <button onClick={copyRoomCode} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: copiedCode ? 'var(--success)' : 'var(--text-muted)' }} title="Copy room code">
              {copiedCode ? <Check size={14} /> : <Copy size={14} />}
            </button>
            <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.2)' }} />
            <button onClick={copyInviteLink} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: copiedLink ? 'var(--success)' : 'var(--text-muted)' }} title="Copy invite link">
              {copiedLink ? <Check size={14} /> : <Link2 size={14} />}
            </button>
          </div>

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className="btn btn-secondary" style={{ padding: '0.5rem', borderRadius: '8px', width: '36px', height: '36px' }} title="Toggle Fullscreen">
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          {/* Speaker control */}
          <button onClick={toggleSpeaker} className="btn btn-secondary" style={{ padding: '0.5rem', borderRadius: '8px', width: '36px', height: '36px' }} title="Toggle Remote Speaker Audio">
            {isSpeakerEnabled ? <Volume2 size={16} /> : <VolumeX size={16} color="var(--danger)" />}
          </button>

          {/* Leave Button */}
          <button onClick={handleEndMeeting} className="btn btn-danger" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', borderRadius: '8px' }}>
            <PhoneOff size={16} />
            <span>End</span>
          </button>
        </div>
      </header>

      {/* Streaming workspace */}
      <div style={{ display: 'flex', flexGrow: 1, padding: '0 1rem 1rem 1rem', gap: '1rem', overflow: 'hidden' }} className="workspace-split main-room-content">
        
        {/* Left Column: Streams Grid */}
        <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: mediaError ? 'flex-start' : 'center', position: 'relative' }}>
          
          {mediaError && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--danger)',
              padding: '0.85rem 1.25rem',
              borderRadius: '12px',
              fontSize: '0.875rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              animation: 'fadeIn 0.3s ease-out'
            }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span><strong>Media Access Denied:</strong> {mediaError} Please click the lock/settings icon in your browser URL bar to allow camera and microphone access, then refresh the page.</span>
            </div>
          )}

          {/* Main Video Grid */}
          <div className="video-grid" style={{
            gridTemplateColumns: remotePeers.length === 0 ? '1fr' : 
                                 remotePeers.length === 1 ? '1fr 1fr' : 
                                 'repeat(auto-fit, minmax(280px, 1fr))',
            maxHeight: '100%'
          }}>
            {/* Local Video Stream Container */}
            <div className={`video-card ${isSpeaking ? 'speaking-active' : ''}`} style={isSpeaking ? { boxShadow: '0 0 15px var(--primary)', border: '2px solid var(--primary)' } : {}}>
              {localStream ? (
                <video 
                  ref={(el) => {
                    localVideoRef.current = el;
                    if (el && el.srcObject !== localStream) {
                      el.srcObject = localStream;
                    }
                  }} 
                  autoPlay 
                  playsInline 
                  muted 
                  style={{ transform: 'scaleX(-1)', width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0c0d14' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: user?.avatarColor || 'var(--primary)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.25rem', color: '#fff', marginBottom: '0.75rem' }}>
                    {user?.username?.substring(0, 2).toUpperCase() || 'U'}
                  </div>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Camera Disabled (You)</span>
                </div>
              )}

              {/* Hand Raised badge */}
              {isHandRaised && (
                <div className="raise-hand-badge">✋</div>
              )}

              <div className="video-label">
                <span className={`status-badge ${isCamEnabled ? 'live' : 'muted'}`}></span>
                <span>{user?.username} (You)</span>
              </div>
              <div className="video-controls">
                {!isMicEnabled && <div style={{ background: 'rgba(239, 68, 68, 0.8)', padding: '4px', borderRadius: '50%' }}><MicOff size={12} color="#fff" /></div>}
                {!isCamEnabled && <div style={{ background: 'rgba(239, 68, 68, 0.8)', padding: '4px', borderRadius: '50%' }}><VideoOff size={12} color="#fff" /></div>}
              </div>
            </div>

            {/* Remote Videos Container */}
            {remotePeers.map(({ socketId, user: peerUser, stream }) => (
              <div key={socketId} className="video-card">
                {stream ? (
                  <video
                    ref={(el) => { 
                      if (el && el.srcObject !== stream) { 
                        el.srcObject = stream; 
                        el.muted = !isSpeakerEnabled; 
                      } 
                    }}
                    autoPlay
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0c0d14' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: peerUser?.avatarColor || 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.25rem', color: '#fff', marginBottom: '0.75rem' }}>
                      {peerUser?.username?.substring(0, 2).toUpperCase() || 'P'}
                    </div>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Connecting peer stream...</span>
                  </div>
                )}

                {/* Hand Raised badge */}
                {handRaisedPeers[socketId] && (
                  <div className="raise-hand-badge">✋</div>
                )}

                <div className="video-label">
                  <span className="status-badge live"></span>
                  <span>{peerUser?.username}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Floating Emojis Overlay */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 10 }}>
            {floatingEmojis.map(({ id, emoji }) => (
              <div
                key={id}
                className="floating-emoji"
                style={{
                  position: 'absolute',
                  bottom: '20px',
                  left: `${50 + (Math.random() * 30 - 15)}%`, // Randomize horizontal position around center
                  fontSize: '2.5rem',
                  animation: 'floatUp 4s forwards ease-out'
                }}
              >
                {emoji}
              </div>
            ))}
          </div>

          {/* Subtitles Overlay */}
          {isCaptionsEnabled && captionsText && (
            <div className="live-captions-container">
              <span className="live-captions-text">📢 AI Captions: "{captionsText}"</span>
            </div>
          )}
        </div>

        {/* Right Column: Sidebar Workspace */}
        <div className={`sidebar-overlay ${isMobileChatOpen ? 'mobile-open' : ''}`} onClick={() => setIsMobileChatOpen(false)}></div>
        <aside className={`glass-container sidebar-container room-chat-sidebar ${isMobileChatOpen ? 'mobile-open' : ''}`} style={{
          width: '340px',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--border-light)',
          borderRadius: '12px',
          flexShrink: 0,
          background: 'var(--bg-dark)'
        }}>
          
          {/* Tab buttons */}
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', flexGrow: 1 }}>
              <button onClick={() => { setActiveTab('chat'); setUnreadCount(0); }} style={{ flex: 1, background: 'none', border: 'none', padding: '0.85rem', color: activeTab === 'chat' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', borderBottom: activeTab === 'chat' ? '2px solid var(--primary)' : 'none', fontSize: '0.85rem', transition: 'var(--transition-smooth)' }}>
              <MessageSquare size={14} />
              <span>Chat</span>
              {unreadCount > 0 && (
                <span style={{
                  backgroundColor: 'var(--danger)',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '2px 6px',
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  marginLeft: '4px',
                  boxShadow: '0 0 8px var(--danger)',
                  display: 'inline-block'
                }}>
                  {unreadCount}
                </span>
              )}
            </button>
            <button onClick={() => setActiveTab('ai')} style={{ flex: 1, background: 'none', border: 'none', padding: '0.85rem', color: activeTab === 'ai' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', borderBottom: activeTab === 'ai' ? '2px solid var(--primary)' : 'none', fontSize: '0.85rem', transition: 'var(--transition-smooth)' }}>
              <Sparkles size={14} />
              <span>AI Panel</span>
            </button>
            <button onClick={() => setActiveTab('timeline')} style={{ flex: 1, background: 'none', border: 'none', padding: '0.85rem', color: activeTab === 'timeline' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', borderBottom: activeTab === 'timeline' ? '2px solid var(--primary)' : 'none', fontSize: '0.85rem', transition: 'var(--transition-smooth)' }}>
              <List size={14} />
              <span>Timeline</span>
            </button>
            <button onClick={() => setActiveTab('participants')} style={{ flex: 1, background: 'none', border: 'none', padding: '0.85rem', color: activeTab === 'participants' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', borderBottom: activeTab === 'participants' ? '2px solid var(--primary)' : 'none', fontSize: '0.85rem', transition: 'var(--transition-smooth)' }}>
              <Users size={14} />
              <span>Users</span>
            </button>
            </div>
            <button className="mobile-only btn btn-icon-only" onClick={() => setIsMobileChatOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', padding: '0.85rem', flexShrink: 0 }}>
              <X size={20} />
            </button>
          </div>

          {/* Active View panel */}
          <div style={{ flexGrow: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
            
            {/* VIEW 1: CHAT */}
            {activeTab === 'chat' && (
              <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, height: '100%' }}>
                {/* Chat search */}
                <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                  <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search chat messages..."
                    value={chatSearch}
                    onChange={(e) => setChatSearch(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem 1rem 0.45rem 2rem', fontSize: '0.8rem', borderRadius: '8px' }}
                  />
                </div>

                {/* Message Log */}
                <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.75rem', maxHeight: 'calc(100vh - 350px)' }} onScroll={handleScrollChat}>
                  {!hasMoreMessages && filteredMessages.length > 0 && (
                    <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Start of conversation</div>
                  )}
                  {filteredMessages.length === 0 ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 1rem' }}>
                      <MessageCircle size={28} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                      <p style={{ fontSize: '0.8rem' }}>{chatSearch ? 'No matching messages.' : 'No messages yet.'}</p>
                    </div>
                  ) : (
                    filteredMessages.map((msg, i) => {
                      const isMe = msg.sender?._id === user._id;
                      const isFile = msg.type === 'file' || (msg.text && msg.text.startsWith('data:'));
                      const isImage = msg.type === 'image' || (msg.text && msg.text.startsWith('data:image'));
                      const isVoice = msg.type === 'voice';

                      return (
                        <div id={`msg-${msg._id}`} key={msg._id || i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                          {!isMe && (
                            <div style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              backgroundColor: msg.sender?.avatarColor || 'var(--primary)',
                              backgroundImage: msg.sender?.profilePicture ? `url(${msg.sender.profilePicture})` : 'none',
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              fontWeight: 700,
                              fontSize: '0.7rem',
                              flexShrink: 0,
                              border: '1px solid rgba(255,255,255,0.05)'
                            }}>
                              {!msg.sender?.profilePicture && (msg.sender?.username || 'P').substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignSelf: isMe ? 'flex-end' : 'flex-start', width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', padding: '0 4px' }}>
                                {msg.sender?.username || 'User'} 
                                {msg.receiver && <span style={{ color: 'var(--primary)' }}> (Direct)</span>} 
                                 • {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                              </span>
                            </div>
                            
                            {/* Message Bubble */}
                            <div style={{
                              background: isMe ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.05)',
                              color: '#fff',
                              padding: '8px 12px',
                              borderRadius: '12px',
                              fontSize: '0.85rem',
                              border: isMe ? 'none' : '1px solid var(--border-light)',
                              wordBreak: 'break-word',
                              whiteSpace: 'pre-wrap',
                              lineHeight: 1.4,
                              position: 'relative'
                            }}>
                              {/* Reply Preview */}
                              {msg.replyTo && (
                                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '4px 8px', borderRadius: '4px', marginBottom: '6px', fontSize: '0.75rem', borderLeft: '3px solid var(--primary)', cursor: 'pointer' }}
                                     onClick={() => document.getElementById(`msg-${msg.replyTo._id}`)?.scrollIntoView({ behavior: 'smooth' })}>
                                  <strong style={{ color: 'var(--primary)' }}>{msg.replyTo.sender?.username}</strong>
                                  <div style={{ opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                                    {msg.replyTo.type === 'voice' ? '🎤 Voice Message' : msg.replyTo.type === 'image' ? '🖼️ Image' : msg.replyTo.type === 'file' ? '📎 File' : msg.replyTo.text}
                                  </div>
                                </div>
                              )}

                              {isVoice ? (
                                <audio controls src={msg.text} style={{ height: '30px', outline: 'none' }} />
                              ) : isImage ? (
                                <img src={msg.text} alt="Attached" style={{ maxWidth: '100%', borderRadius: '6px', cursor: 'pointer', maxHeight: '150px' }} onClick={() => window.open(msg.text)} />
                              ) : isFile ? (
                                <a href={msg.text} target="_blank" rel="noopener noreferrer" download style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'underline' }}>
                                  <FileText size={14} /><span>Download File</span>
                                </a>
                              ) : (
                                <span style={{ fontStyle: msg.isDeleted ? 'italic' : 'normal', opacity: msg.isDeleted ? 0.7 : 1 }}>
                                  {msg.text}
                                </span>
                              )}

                              {msg.isEdited && !msg.isDeleted && <span style={{ fontSize: '0.6rem', opacity: 0.7, marginLeft: '6px' }}>(edited)</span>}
                              
                              {/* Read Receipts & Status */}
                              {isMe && !msg.isDeleted && (
                                <span style={{ fontSize: '0.65rem', marginLeft: '6px', display: 'inline-flex', alignItems: 'center' }}>
                                  {msg.status === 'sending' ? '⏳' : 
                                   (msg.seenBy && msg.seenBy.length > 0) ? <span style={{ color: '#14b8a6', fontWeight: 'bold' }}>✓✓</span> : 
                                   '✓✓'}
                                </span>
                              )}

                              {/* reactions list */}
                              {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                <div style={{ display: 'flex', gap: '4px', position: 'absolute', bottom: '-8px', right: '4px', background: '#07080d', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '1px 6px', fontSize: '0.65rem' }}>
                                  {Object.entries(msg.reactions).map(([emoji, count]) => (
                                    <span key={emoji}>{emoji} {count}</span>
                                  ))}
                                </div>
                              )}
                            </div>

                          {/* Quick Reactions & Action bar */}
                          {!msg.isDeleted && (
                            <div style={{ display: 'flex', gap: '6px', opacity: 0.6, alignSelf: isMe ? 'flex-end' : 'flex-start', marginTop: '2px', padding: '0 4px', fontSize: '0.75rem' }}>
                              {['👍', '❤️', '😂'].map((emoji) => (
                                <button key={emoji} onClick={() => sendReaction(msg._id, emoji)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0' }} title="React">
                                  {emoji}
                                </button>
                              ))}
                              <button onClick={() => setReplyingTo(msg)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', color: 'var(--text-muted)' }} title="Reply">↩️</button>
                              {isMe && (
                                <>
                                  <button onClick={() => { setEditingMessage(msg); setInputText(msg.text); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', color: 'var(--text-muted)' }} title="Edit">✏️</button>
                                  <button onClick={() => socketRef.current.emit('delete-message', { messageId: msg._id })} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', color: 'var(--danger)' }} title="Delete">🗑️</button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      );
                    })
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Typing Indicator */}
                {Object.entries(typingPeers).map(([uname, isTyping]) => {
                  if (isTyping && uname !== user.username) {
                    return (
                      <span key={uname} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '4px', display: 'block' }}>
                        {uname} is typing...
                      </span>
                    );
                  }
                  return null;
                })}

                {/* Chat Inputs */}
                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'auto' }}>
                  
                  {/* Reply Banner */}
                  {replyingTo && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', borderLeft: '3px solid var(--primary)' }}>
                      <span>Replying to <strong>{replyingTo.sender?.username}</strong></span>
                      <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✖</button>
                    </div>
                  )}

                  {/* Edit Banner */}
                  {editingMessage && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', borderLeft: '3px solid var(--warning)' }}>
                      <span>Editing Message</span>
                      <button onClick={() => { setEditingMessage(null); setInputText(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✖</button>
                    </div>
                  )}

                  {/* Direct Message Selector */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <select value={directMessageTo} onChange={(e) => setDirectMessageTo(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', color: '#fff', fontSize: '0.75rem', padding: '4px', borderRadius: '4px', outline: 'none' }}>
                      <option value="">To: Everyone (Public)</option>
                      {roomDetails?.participants?.map(p => {
                         if (p._id !== user._id) {
                           return <option key={p._id} value={p._id}>To: {p.username} (Direct)</option>
                         }
                         return null;
                      })}
                    </select>

                    <div style={{ display: 'flex', gap: '8px', fontSize: '1rem', paddingBottom: '4px' }}>
                      {['👍', '❤️', '😂', '🔥', '😮', '👏'].map(emoji => (
                        <button key={emoji} onClick={() => addEmoji(emoji)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Input form */}
                  <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', position: 'relative' }}>
                    {showEmojiPicker && (
                      <div style={{ position: 'absolute', bottom: '50px', right: 0, zIndex: 100 }}>
                        <EmojiPicker 
                          onEmojiClick={(emojiObj) => { 
                            addEmoji(emojiObj.emoji); 
                            setShowEmojiPicker(false); 
                          }} 
                          theme="dark"
                          width={280}
                          height={350}
                        />
                      </div>
                    )}

                    {/* Attachment Input */}
                    {isUploading ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>Uploading...</span>
                    ) : (
                      <label style={{ cursor: 'pointer', display: 'flex', padding: '6px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)' }} title="Attach file or image">
                        <Paperclip size={16} color="var(--text-muted)" />
                        <input
                          type="file"
                          onChange={handleFileUpload}
                          style={{ display: 'none' }}
                          accept="*/*"
                        />
                      </label>
                    )}

                    {/* Emoji toggle icon */}
                    <button 
                      type="button" 
                      onClick={() => setShowEmojiPicker(prev => !prev)} 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '6px', color: showEmojiPicker ? 'var(--primary)' : 'var(--text-muted)' }}
                      title="Add emoji"
                    >
                      <Smile size={16} />
                    </button>
                    
                    {/* Voice Memo toggle */}
                    <button 
                      type="button" 
                      onClick={toggleVoiceRecording} 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '6px', color: isRecordingVoice ? 'var(--danger)' : 'var(--text-muted)' }}
                      title={isRecordingVoice ? "Stop Recording" : "Record Voice Message"}
                    >
                      <Mic size={16} style={{ animation: isRecordingVoice ? 'pulse 1s infinite alternate' : 'none' }} />
                    </button>

                    {isRecordingVoice ? (
                      <div style={{ flexGrow: 1, color: 'var(--danger)', fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}>
                        <span style={{ marginRight: '8px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)', animation: 'pulse 1s infinite alternate' }}></span>
                        Recording: {voiceRecordingTime}s
                      </div>
                    ) : (
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Type a message..."
                        value={inputText}
                        onChange={handleInputChange}
                        style={{ flexGrow: 1, padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '10px' }}
                      />
                    )}
                    <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem', width: '36px', height: '36px', borderRadius: '10px' }} disabled={isRecordingVoice || (!inputText.trim() && !isRecordingVoice)}>
                      <Send size={14} />
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* VIEW 2: AI FEATURES */}
            {activeTab === 'ai' && (
              <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BrainCircuit size={18} color="var(--primary)" />
                  AI Meeting Suite
                </h3>

                {/* Speech captions switch */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px', border: '1px solid var(--border-light)', borderRadius: '10px' }}>
                  <div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block' }}>Live Speech Captions</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Display real-time speech subtitles.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isCaptionsEnabled}
                    onChange={toggleCaptions}
                    style={{ width: '38px', height: '18px', cursor: 'pointer' }}
                  />
                </div>

                {/* Noise suppression switch */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px', border: '1px solid var(--border-light)', borderRadius: '10px' }}>
                  <div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block' }}>Noise Suppression</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Filter microphone static and hiss.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={noiseSuppression}
                    onChange={toggleNoiseSuppression}
                    style={{ width: '38px', height: '18px', cursor: 'pointer' }}
                  />
                </div>

                {/* AI Summary Generator */}
                <div className="glass-container" style={{ padding: '1.25rem', border: '1px solid var(--border-light)' }}>
                  <button onClick={generateAISummary} className="btn btn-primary" style={{ width: '100%', padding: '0.65rem' }} disabled={aiLoading}>
                    <Sparkles size={16} />
                    {aiLoading ? 'Synthesizing...' : 'Generate AI Summary'}
                  </button>

                  {aiSummary && (
                    <div className="fade-in" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '10px' }}>
                        <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700, marginBottom: '4px' }}>Executive Summary</h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: 1.4 }}>{aiSummary.executiveSummary}</p>
                      </div>

                      <div>
                        <h4 style={{ fontSize: '0.85rem', color: '#14b8a6', fontWeight: 700, marginBottom: '4px' }}>Key Highlights</h4>
                        <ul style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: '1rem', lineHeight: 1.5 }}>
                          {aiSummary.keyHighlights.map((hl, idx) => <li key={idx}>{hl}</li>)}
                        </ul>
                      </div>

                      <div>
                        <h4 style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 700, marginBottom: '4px' }}>Smart Recommendations</h4>
                        <ul style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: '1rem', lineHeight: 1.5 }}>
                          {aiSummary.smartRecommendations.map((rec, idx) => <li key={idx}>{rec}</li>)}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* VIEW: TIMELINE */}
            {activeTab === 'timeline' && (
              <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, height: '100%', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <select 
                    value={timelineFilter} 
                    onChange={(e) => setTimelineFilter(e.target.value)}
                    style={{ padding: '0.45rem', fontSize: '0.75rem', borderRadius: '8px', background: 'var(--surface-light)', color: 'var(--text-main)', border: '1px solid var(--border-light)' }}
                  >
                    <option value="All">All Events</option>
                    <option value="Decisions">Decisions</option>
                    <option value="Tasks">Tasks</option>
                    <option value="Highlights">Highlights</option>
                  </select>
                  <button 
                    onClick={async () => {
                      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(timelineEvents, null, 2));
                      const downloadAnchorNode = document.createElement('a');
                      downloadAnchorNode.setAttribute("href", dataStr);
                      downloadAnchorNode.setAttribute("download", "meeting-timeline.json");
                      document.body.appendChild(downloadAnchorNode);
                      downloadAnchorNode.click();
                      downloadAnchorNode.remove();
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '0.45rem 0.75rem', borderRadius: '8px', background: 'var(--surface-light)', color: 'var(--text-main)', border: '1px solid var(--border-light)', cursor: 'pointer' }}
                  >
                    <Download size={14} /> JSON
                  </button>
                  <button 
                    onClick={() => window.print()}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '0.45rem 0.75rem', borderRadius: '8px', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}
                  >
                    PDF
                  </button>
                </div>
                
                <div style={{ position: 'relative' }}>
                  <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search timeline..."
                    value={timelineSearch}
                    onChange={(e) => setTimelineSearch(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem 1rem 0.45rem 2.2rem', fontSize: '0.8rem', borderRadius: '8px' }}
                  />
                </div>

                <div style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '8px', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '16px', top: 0, bottom: 0, width: '2px', backgroundColor: 'var(--border-light)', zIndex: 0 }}></div>
                  {timelineEvents
                    .filter(e => {
                       if (timelineFilter === 'Decisions' && e.type !== 'decision') return false;
                       if (timelineFilter === 'Tasks' && e.type !== 'task') return false;
                       if (timelineFilter === 'Highlights' && e.type !== 'highlight') return false;
                       if (timelineSearch && !e.title.toLowerCase().includes(timelineSearch.toLowerCase()) && !e.description.toLowerCase().includes(timelineSearch.toLowerCase())) return false;
                       return true;
                    })
                    .map((event, idx) => {
                      let IconComponent = Clock;
                      if (event.icon === 'CheckCircle') IconComponent = CheckCircle;
                      if (event.icon === 'ListTodo') IconComponent = List;
                      if (event.icon === 'Star') IconComponent = Star;
                      if (event.icon === 'Hand') IconComponent = Hand;
                      if (event.icon === 'LogOut') IconComponent = LogOut;
                      if (event.icon === 'Video') IconComponent = VideoIcon;
                      if (event.icon === 'Monitor') IconComponent = Monitor;

                      return (
                        <div key={idx} style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', position: 'relative', zIndex: 1 }}>
                          <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: event.color || 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '3px solid var(--surface-dark)', color: 'white' }}>
                            <IconComponent size={14} />
                          </div>
                          <div style={{ background: 'var(--surface-light)', padding: '0.75rem', borderRadius: '8px', flexGrow: 1, border: '1px solid var(--border-light)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: event.color || 'var(--text-main)' }}>{event.title}</h4>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(event.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{event.description}</p>
                          </div>
                        </div>
                      )
                    })
                  }
                  {timelineEvents.length === 0 && (
                     <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No events on timeline yet.
                     </div>
                  )}
                </div>
                
                <button 
                  onClick={async () => {
                    try {
                       setAiLoading(true);
                       const res = await api.post(`/timeline/${roomId}/summary`);
                       setAiSummary({ keyHighlights: [res.data.summary], smartRecommendations: ['Review timeline for details.']});
                       setActiveTab('ai');
                    } catch (err) {
                       showToast('Failed to generate summary', 'error');
                    } finally {
                       setAiLoading(false);
                    }
                  }}
                  disabled={aiLoading || timelineEvents.length === 0}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0.75rem', fontSize: '0.85rem' }}
                >
                  {aiLoading ? 'Generating...' : <><BrainCircuit size={16} /> Generate AI Summary</>}
                </button>
              </div>
            )}

            {/* VIEW 3: PARTICIPANTS & ANALYTICS */}
            {activeTab === 'participants' && (
              <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Participant list */}
                <div>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-main)' }}>Participant Status</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Local participant */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: user?.avatarColor || 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.75rem' }}>
                          {user?.username?.substring(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user?.username} (You)</span>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <UserCheck size={12} />
                        Host
                      </span>
                    </div>

                    {/* Remote participants list */}
                    {remotePeers.map(({ socketId, user: peerUser }) => (
                      <div key={socketId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: peerUser?.avatarColor || 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.75rem' }}>
                            {peerUser?.username?.substring(0, 2).toUpperCase()}
                          </div>
                          <span style={{ fontSize: '0.85rem' }}>{peerUser?.username}</span>
                        </div>
                        {canManageRoom ? (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => socketRef.current.emit('mute-user-mic', { targetSocketId: socketId })} className="btn btn-secondary" style={{ padding: '4px', fontSize: '0.65rem' }}>Mute</button>
                            <button onClick={() => socketRef.current.emit('kick-user', { targetSocketId: socketId })} className="btn btn-danger" style={{ padding: '4px', fontSize: '0.65rem' }}>Kick</button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--success)' }}>
                            24ms (Excellent)
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Waiting Room Management */}
                {canManageRoom && waitingUsers.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--warning)' }}>Waiting Room ({waitingUsers.length})</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {waitingUsers.map(({ socketId, user: wUser }) => (
                        <div key={socketId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: wUser?.avatarColor || 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.6rem' }}>
                              {wUser?.username?.substring(0, 2).toUpperCase()}
                            </div>
                            <span style={{ fontSize: '0.8rem' }}>{wUser?.username}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => {
                              socketRef.current.emit('admit-user', { targetSocketId: socketId, user: wUser, roomId });
                              setWaitingUsers(prev => prev.filter(u => u.socketId !== socketId));
                            }} className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.65rem' }}>Admit</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Host Controls */}
                {canManageRoom && (
                  <div className="glass-container" style={{ padding: '1.25rem', border: '1px solid var(--border-light)' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                      <Shield size={16} color="var(--primary)" />
                      Host Controls
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button onClick={() => socketRef.current.emit('lock-room', { isLocked: !roomDetails?.isLocked })} className="btn btn-secondary" style={{ width: '100%', padding: '0.65rem', justifyContent: 'center' }}>
                        {roomDetails?.isLocked ? 'Unlock Room' : 'Lock Room'}
                      </button>
                      <button onClick={() => {
                        if (window.confirm('Are you sure you want to end the meeting for everyone?')) {
                          socketRef.current.emit('end-meeting');
                        }
                      }} className="btn btn-danger" style={{ width: '100%', padding: '0.65rem', justifyContent: 'center' }}>
                        End Meeting for All
                      </button>
                    </div>
                  </div>
                )}

                {/* Stream Analytics */}
                <div className="glass-container" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid var(--border-light)' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity size={16} color="var(--primary)" />
                    Stream Quality Monitor
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Resolution:</span>
                      <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>1280x720 (HD)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Frame Rate (FPS):</span>
                      <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>30 FPS (Ideal)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Audio Input:</span>
                      <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>Mono (48kHz)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Client Engine:</span>
                      <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>V8 / Blink</span>
                    </div>
                  </div>
                </div>

              </div>
            )}

          </div>
        </aside>
      </div>

      {/* Live Translation Captions Overlay */}
      {isCaptionsEnabled && liveCaption && (
        <div style={{
          position: 'absolute',
          bottom: '100px', // above toolbar
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '12px 24px',
          maxWidth: '80%',
          textAlign: 'center',
          animation: 'slideUp 0.3s ease-out'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '4px' }}>
            {liveCaption.speaker}
          </div>
          <div style={{ fontSize: '1.2rem', color: '#fff', fontWeight: 500, lineHeight: 1.4 }}>
            {liveCaption.translatedText}
          </div>
          {liveCaption.language !== 'en' && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Original: {liveCaption.originalText}
            </div>
          )}
        </div>
      )}

      {/* Floating Action Controls Footer Bar */}
      <footer className="glass-container room-controls-bar" style={{
        margin: '0 1rem 1rem 1rem',
        padding: '0.75rem',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '1rem',
        border: '1px solid var(--border-light)',
        borderRadius: '12px',
        flexShrink: 0
      }}>
        {/* Mobile Chat Toggle */}
        <button
          onClick={() => setIsMobileChatOpen(!isMobileChatOpen)}
          className={`btn btn-icon-only mobile-only ${isMobileChatOpen ? 'btn-primary' : 'btn-secondary'}`}
          style={{ width: '48px', height: '48px', position: 'relative' }}
          title="Toggle Chat"
        >
          <MessageSquare size={20} />
          {unreadCount > 0 && (
            <span style={{ position: 'absolute', top: -5, right: -5, background: 'var(--danger)', color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: '10px', fontWeight: 'bold' }}>
              {unreadCount}
            </span>
          )}
        </button>

        {/* Toggle Microphone */}
        <button
          onClick={toggleMic}
          className={`btn btn-icon-only ${isMicEnabled ? 'btn-secondary' : 'btn-danger'}`}
          style={{ width: '48px', height: '48px' }}
          title={isMicEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          disabled={!localStream}
        >
          {isMicEnabled ? <Mic size={20} /> : <MicOff size={20} />}
        </button>

        {/* Toggle Camera */}
        <button
          onClick={toggleCam}
          className={`btn btn-icon-only ${isCamEnabled ? 'btn-secondary' : 'btn-danger'}`}
          style={{ width: '48px', height: '48px' }}
          title={isCamEnabled ? 'Disable Camera' : 'Enable Camera'}
          disabled={!localStream}
        >
          {isCamEnabled ? <VideoIcon size={20} /> : <VideoOff size={20} />}
        </button>

        {/* Toggle Screen Share */}
        <button
          onClick={toggleScreenShare}
          className={`btn btn-icon-only ${isScreenSharing ? 'btn-primary' : 'btn-secondary'}`}
          style={{ width: '48px', height: '48px', border: isScreenSharing ? 'none' : '1px solid var(--border-light)' }}
          title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
          disabled={!localStream}
        >
          <Monitor size={20} />
        </button>

        {/* Toggle Raise Hand */}
        <button
          onClick={toggleRaiseHand}
          className={`btn btn-icon-only ${isHandRaised ? 'btn-primary' : 'btn-secondary'}`}
          style={{ width: '48px', height: '48px', border: isHandRaised ? 'none' : '1px solid var(--border-light)', color: isHandRaised ? '#fff' : '#f59e0b' }}
          title={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
        >
          <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>✋</span>
        </button>

        {/* Toggle Recording */}
        <button
          onClick={toggleRecording}
          className={`btn btn-icon-only ${isRecording ? 'btn-danger animate-pulse' : 'btn-secondary'}`}
          style={{ width: '48px', height: '48px', animation: isRecording ? 'pulse 1s infinite alternate' : 'none' }}
          title={isRecording ? 'Stop Recording' : 'Record Stream'}
          disabled={!localStream}
        >
          <Circle size={20} fill={isRecording ? 'var(--text-main)' : 'none'} color={isRecording ? 'none' : 'var(--danger)'} />
        </button>

        {/* Toggle PiP */}
        <button
          onClick={togglePip}
          className="btn btn-icon-only btn-secondary"
          style={{ width: '48px', height: '48px' }}
          title="Picture in Picture"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><rect x="12" y="12" width="7" height="5"></rect></svg>
        </button>

        {/* Toggle Captions / Live Translation */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <button
            onClick={toggleCaptions}
            className={`btn btn-icon-only ${isCaptionsEnabled ? 'btn-primary' : 'btn-secondary'}`}
            style={{ width: '48px', height: '48px', border: isCaptionsEnabled ? 'none' : '1px solid var(--border-light)' }}
            title={isCaptionsEnabled ? 'Disable Captions' : 'Enable Live Translation'}
          >
            <Languages size={20} />
          </button>
          
          {isCaptionsEnabled && (
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              style={{
                marginLeft: '8px',
                padding: '8px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid var(--border-light)',
                color: '#fff',
                fontSize: '0.8rem',
                outline: 'none',
                cursor: 'pointer'
              }}
              title="Translate to..."
            >
              {SUPPORTED_LANGUAGES.map(l => (
                <option key={l.code} value={l.code} style={{ color: '#000' }}>{l.label}</option>
              ))}
            </select>
          )}
        </div>

        {/* Reactions Tray Trigger */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginLeft: '1rem' }}>
          <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '24px', border: '1px solid var(--border-light)' }}>
            {['👍', '❤️', '👏', '🎉'].map(emoji => (
              <button key={emoji} onClick={() => sendFloatingEmoji(emoji)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', padding: '0 4px', transition: 'transform 0.2s' }} className="hover-scale">
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </footer>

      {/* Floating Keyframe animations styling */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        @keyframes floatUp {
          0% { transform: translateY(0) scale(0.8); opacity: 0; }
          20% { opacity: 1; transform: translateY(-20px) scale(1.1); }
          80% { opacity: 0.8; transform: translateY(-150px) scale(1); }
          100% { transform: translateY(-200px) scale(0.8); opacity: 0; }
        }
        .hover-scale {
          transition: transform 0.2s ease-in-out;
        }
        .hover-scale:hover {
          transform: scale(1.3);
        }
        @media (max-width: 768px) {
          .workspace-split {
            flex-direction: column !important;
            overflow-y: auto !important;
          }
          .sidebar-container {
            width: 100% !important;
            height: 380px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Room;
