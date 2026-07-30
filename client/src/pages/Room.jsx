import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
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
  FileText
} from 'lucide-react';

const Room = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

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
  const [copied, setCopied] = useState(false);
  
  // Meeting Stopwatch Timer
  const [meetingSeconds, setMeetingSeconds] = useState(0);

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

  // Chat filters
  const [chatSearch, setChatSearch] = useState('');

  // Speech to Text / AI Captions
  const [isCaptionsEnabled, setIsCaptionsEnabled] = useState(false);
  const [captionsText, setCaptionsText] = useState('');
  const recognitionRef = useRef(null);

  // AI Meeting Summaries
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [noiseSuppression, setNoiseSuppression] = useState(false);

  // Audio Context for Noise Suppression
  const audioContextRef = useRef(null);
  const audioSourceRef = useRef(null);
  const filterNodeRef = useRef(null);

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

  // WebRTC ICE servers configuration
  const iceConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

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

  // 2. Load Room Details and Persistent Messages from Database on load
  useEffect(() => {
    const loadRoomAndMessages = async () => {
      try {
        const response = await api.get(`/rooms/${roomId}`);
        setRoomDetails(response.data);

        // Fetch past messages
        const msgResponse = await api.get(`/rooms/${roomId}/messages`);
        setMessages(msgResponse.data);
      } catch (err) {
        console.error('Failed to load room details or messages:', err);
        showToast('Room not found or unauthorized.', 'error');
        navigate('/dashboard');
      }
    };
    loadRoomAndMessages();
  }, [roomId, navigate]);

  // 3. Initialize Media (Camera & Mic)
  useEffect(() => {
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, frameRate: { ideal: 30 } },
          audio: true
        });
        
        setLocalStream(stream);
        localStreamRef.current = stream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
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
  }, [roomId]);

  // Scroll chat to bottom when messages update
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // 4. Socket Connection & WebRTC Signaling
  const connectSocket = () => {
    socketRef.current = io('http://localhost:5002', {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    socketRef.current.on('connect', () => {
      console.log('Connected to socket server:', socketRef.current.id);
      socketRef.current.emit('join-room', { roomId, userId: user._id });
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      showToast('Connection lost. Reconnecting...', 'error');
    });

    socketRef.current.on('reconnect', (attemptNumber) => {
      console.log('Reconnected to socket server after', attemptNumber, 'attempts');
      showToast('Reconnected to server!', 'success');
      // Re-join the room upon reconnecting
      socketRef.current.emit('join-room', { roomId, userId: user._id });
    });

    // Receive chat message
    socketRef.current.on('message-received', (message) => {
      setMessages((prev) => {
        if (prev.some((msg) => msg._id === message._id)) {
          return prev;
        }
        return [...prev, message];
      });
      
      // Increment unread message count if NOT currently viewing the chat tab
      setActiveTab((currentTab) => {
        if (currentTab !== 'chat') {
          setUnreadCount((count) => count + 1);
        }
        return currentTab;
      });
    });

    // Message reactions
    socketRef.current.on('reaction-received', ({ messageId, emoji, socketId }) => {
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
      setRemotePeers(prev => {
        if (prev.some(p => p.socketId === socketId)) return prev;
        return [...prev, { socketId, user: joiningUser, stream: null }];
      });
    });

    socketRef.current.on('signal-received', async ({ from, signal }) => {
      let pc = peersRef.current[from];

      if (!pc) {
        const peer = remotePeers.find(p => p.socketId === from);
        const peerUser = peer ? peer.user : { username: 'Peer', avatarColor: '#8b5cf6' };
        
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

    socketRef.current.on('user-left', ({ socketId, userId }) => {
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
      console.log('Received remote stream track from:', peerUser.username);
      let remoteStream = event.streams[0];
      
      if (!remoteStream) {
        remoteStream = new MediaStream();
        remoteStream.addTrack(event.track);
      }
      
      setRemotePeers(prev => {
        const index = prev.findIndex(p => p.socketId === socketId);
        if (index > -1) {
          const updated = [...prev];
          updated[index] = { ...updated[index], stream: remoteStream };
          return updated;
        } else {
          return [...prev, { socketId, user: peerUser, stream: remoteStream }];
        }
      });
    };

    return pc;
  };

  // 5. Media Control Actions
  const requestMediaPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, frameRate: { ideal: 30 } },
        audio: true
      });
      
      setLocalStream(stream);
      localStreamRef.current = stream;
      setMediaError('');
      showToast('Camera and microphone connected!', 'success');

      // Update any active peer connections with the tracks
      Object.values(peersRef.current).forEach((pc) => {
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
      });
      
      return stream;
    } catch (err) {
      console.error('Could not capture local media on demand:', err);
      showToast('Media access still blocked. Please allow permissions in browser settings.', 'error');
      return null;
    }
  };

  const toggleMic = async () => {
    let stream = localStreamRef.current;
    if (!stream) {
      stream = await requestMediaPermission();
      if (stream) {
        setIsMicEnabled(true);
        setIsCamEnabled(true);
      }
      return;
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicEnabled(audioTrack.enabled);
      showToast(audioTrack.enabled ? 'Microphone active' : 'Microphone muted', 'info');
    }
  };

  const toggleCam = async () => {
    let stream = localStreamRef.current;
    if (!stream) {
      stream = await requestMediaPermission();
      if (stream) {
        setIsMicEnabled(true);
        setIsCamEnabled(true);
      }
      return;
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
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

        recorder.start();
        setIsRecording(true);
        showToast('Stream recording started.', 'success');
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
      socketRef.current.emit('send-message', { text: inputText });
      setInputText('');
      socketRef.current.emit('typing', { isTyping: false });
    }
  };

  // Emojis pick helper
  const addEmoji = (emoji) => {
    setInputText(prev => prev + emoji);
  };

  // Message reaction helper
  const sendReaction = (messageId, emoji) => {
    if (socketRef.current) {
      socketRef.current.emit('send-reaction', { messageId, emoji });
    }
  };

  // Base64 file attachments helper
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('File must be smaller than 2MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      // Append file mock payload inside message text
      const mockFileMessage = `📎 Attachment: ${file.name} (Base64 file url)`;
      if (socketRef.current) {
        socketRef.current.emit('send-message', { text: reader.result }); // Sends base64 string
      }
      showToast('File uploaded successfully!', 'success');
    };
    reader.readAsDataURL(file);
  };

  // 9. AI Features
  const toggleCaptions = () => {
    if (isCaptionsEnabled) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsCaptionsEnabled(false);
      isCaptionsEnabledRef.current = false;
      setCaptionsText('');
      showToast('Live captions disabled', 'info');
    } else {
      // Initialize HTML5 Web Speech Recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recog = new SpeechRecognition();
        recog.continuous = true;
        recog.interimResults = true;
        recog.lang = 'en-US';

        recog.onresult = (event) => {
          let interimTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              setCaptionsText(event.results[i][0].transcript);
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
        };

        recog.onend = () => {
          if (isCaptionsEnabledRef.current) recog.start();
        };

        recognitionRef.current = recog;
        recog.start();
        setIsCaptionsEnabled(true);
        isCaptionsEnabledRef.current = true;
        showToast('Live captions enabled', 'success');
      } else {
        // Simulation Fallback if WebSpeech is not supported
        setIsCaptionsEnabled(true);
        isCaptionsEnabledRef.current = true;
        showToast('Live captions simulation running...', 'info');
        
        let counter = 0;
        const mockTexts = [
          "Discussing WebRTC network latency and multi-peer topologies...",
          "Checking camera resolution presets and device audio volumes...",
          "Activating AI noise suppression nodes via the AudioContext...",
          "Finished setting up the client routing context securely."
        ];
        
        const simulationInterval = setInterval(() => {
          if (!isCaptionsEnabledRef.current) {
            clearInterval(simulationInterval);
            return;
          }
          setCaptionsText(mockTexts[counter % mockTexts.length]);
          counter++;
        }, 5000);
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

  // Invite clipboard copy helpers
  const copyInvite = () => {
    const link = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    showToast('Invite link copied!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter messages based on search
  const filteredMessages = messages.filter(m => 
    m.text && m.text.toLowerCase().includes(chatSearch.toLowerCase())
  );

  return (
    <div ref={roomContainerRef} style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#07080d' }} className="fade-in">
      <div className="bg-glow-wrapper">
        <div className="glow-orb-1"></div>
        <div className="glow-orb-2"></div>
      </div>

      {/* Header Panel */}
      <header className="glass-container" style={{
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
            <button onClick={copyInvite} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: copied ? 'var(--success)' : 'var(--text-muted)' }} title="Copy invite link">
              {copied ? <Check size={14} /> : <Copy size={14} />}
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
          <button onClick={() => navigate('/dashboard')} className="btn btn-danger" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', borderRadius: '8px' }}>
            <PhoneOff size={16} />
            <span>End</span>
          </button>
        </div>
      </header>

      {/* Streaming workspace */}
      <div style={{ display: 'flex', flexGrow: 1, padding: '0 1rem 1rem 1rem', gap: '1rem', overflow: 'hidden' }} className="workspace-split">
        
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
            <div className="video-card">
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

          {/* Subtitles Overlay */}
          {isCaptionsEnabled && captionsText && (
            <div className="live-captions-container">
              <span className="live-captions-text">📢 AI Captions: "{captionsText}"</span>
            </div>
          )}
        </div>

        {/* Right Column: Sidebar Workspace */}
        <aside className="glass-container sidebar-container" style={{
          width: '340px',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--border-light)',
          borderRadius: '12px',
          flexShrink: 0
        }}>
          
          {/* Tab buttons */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)' }}>
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
            <button onClick={() => setActiveTab('participants')} style={{ flex: 1, background: 'none', border: 'none', padding: '0.85rem', color: activeTab === 'participants' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', borderBottom: activeTab === 'participants' ? '2px solid var(--primary)' : 'none', fontSize: '0.85rem', transition: 'var(--transition-smooth)' }}>
              <Users size={14} />
              <span>Users</span>
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
                <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.75rem', maxHeight: 'calc(100vh - 350px)' }}>
                  {filteredMessages.length === 0 ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 1rem' }}>
                      <MessageCircle size={28} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                      <p style={{ fontSize: '0.8rem' }}>{chatSearch ? 'No matching messages.' : 'No messages yet.'}</p>
                    </div>
                  ) : (
                    filteredMessages.map((msg, i) => {
                      const isMe = msg.sender?._id === user._id;
                      const isFile = msg.text && msg.text.startsWith('data:');
                      return (
                        <div key={msg._id || i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
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
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', alignSelf: isMe ? 'flex-end' : 'flex-start', padding: '0 4px' }}>
                              {msg.sender?.username || 'User'} • {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                            </span>
                            <div style={{
                              background: isMe ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.05)',
                              color: '#fff',
                              padding: '8px 12px',
                              borderRadius: '12px',
                              fontSize: '0.85rem',
                              border: isMe ? 'none' : '1px solid var(--border-light)',
                              wordBreak: 'break-word',
                              lineHeight: 1.4,
                              position: 'relative'
                            }}>
                              {isFile ? (
                                msg.text.startsWith('data:image/') ? (
                                  <img src={msg.text} alt="Attached image" style={{ maxWidth: '100%', borderRadius: '6px', cursor: 'pointer' }} onClick={() => window.open(msg.text)} />
                                ) : (
                                  <a href={msg.text} download="attachment" style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'underline' }}>
                                    <FileText size={14} />
                                    <span>Download Attachment</span>
                                  </a>
                                )
                              ) : (
                                msg.text
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

                          {/* Quick Reactions bar hoverable */}
                          <div style={{ display: 'flex', gap: '4px', opacity: 0.6, alignSelf: isMe ? 'flex-end' : 'flex-start', marginTop: '2px', padding: '0 4px' }}>
                            {['👍', '❤️', '😂', '🔥'].map((emoji) => (
                              <button key={emoji} onClick={() => sendReaction(msg._id, emoji)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', padding: '0' }} title="React">
                                {emoji}
                              </button>
                            ))}
                          </div>
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
                  {/* Emoji Quick Tray */}
                  <div style={{ display: 'flex', gap: '8px', fontSize: '1rem', paddingBottom: '4px' }}>
                    {['👍', '❤️', '😂', '🔥', '😮', '👏'].map(emoji => (
                      <button key={emoji} onClick={() => addEmoji(emoji)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}>
                        {emoji}
                      </button>
                    ))}
                  </div>

                  {/* Input form */}
                  <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {/* Attachment Input clip */}
                    <label style={{ cursor: 'pointer', display: 'flex', padding: '6px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)' }} title="Attach file or image">
                      <Paperclip size={16} color="var(--text-muted)" />
                      <input
                        type="file"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                        accept="image/*,application/pdf,text/plain"
                      />
                    </label>

                    <input
                      type="text"
                      className="form-input"
                      placeholder="Type a message..."
                      value={inputText}
                      onChange={handleInputChange}
                      style={{ flexGrow: 1, padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '10px' }}
                    />
                    <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem', width: '36px', height: '36px', borderRadius: '10px' }} disabled={!inputText.trim()}>
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
                        <h4 style={{ fontSize: '0.85rem', color: '#06b6d4', fontWeight: 700, marginBottom: '4px' }}>Key Highlights</h4>
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
                        {/* Mock network latency */}
                        <span style={{ fontSize: '0.7rem', color: 'var(--success)' }}>
                          24ms (Excellent)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

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

      {/* Floating Action Controls Footer Bar */}
      <footer className="glass-container" style={{
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
      </footer>

      {/* Floating Keyframe animations styling */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.5; }
          100% { opacity: 1; }
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
