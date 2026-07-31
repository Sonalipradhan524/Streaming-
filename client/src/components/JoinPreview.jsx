import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video as VideoIcon, VideoOff, Settings, AlertTriangle, User, Signal } from 'lucide-react';

const JoinPreview = ({ roomDetails, user, onJoin, onCancel }) => {
  const [localStream, setLocalStream] = useState(null);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCamEnabled, setIsCamEnabled] = useState(true);
  
  const [audioInputDevices, setAudioInputDevices] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState([]);
  
  const [selectedAudioInput, setSelectedAudioInput] = useState('');
  const [selectedVideoInput, setSelectedVideoInput] = useState('');
  const [selectedAudioOutput, setSelectedAudioOutput] = useState('');

  const [micVolume, setMicVolume] = useState(0);
  const [mediaError, setMediaError] = useState('');

  const videoRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const localStreamRef = useRef(null);

  // Initialize devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
        
        setAudioInputDevices(audioInputs);
        setVideoDevices(videoInputs);
        setAudioOutputDevices(audioOutputs);
        
        if (audioInputs.length > 0) setSelectedAudioInput(audioInputs[0].deviceId);
        if (videoInputs.length > 0) setSelectedVideoInput(videoInputs[0].deviceId);
        if (audioOutputs.length > 0) setSelectedAudioOutput(audioOutputs[0].deviceId);
      } catch (err) {
        console.error("Error accessing media devices.", err);
        setMediaError("Unable to access camera or microphone. Please check permissions.");
      }
    };
    getDevices();
    
    return () => stopMedia();
  }, []);

  // Update stream when device selection or toggles change
  useEffect(() => {
    let activeStream = null;
    const updateStream = async () => {
      stopMedia();
      if (!isCamEnabled && !isMicEnabled) {
         setLocalStream(null);
         return;
      }
      try {
        const constraints = {
          audio: isMicEnabled ? { deviceId: selectedAudioInput ? { exact: selectedAudioInput } : undefined } : false,
          video: isCamEnabled ? { 
            deviceId: selectedVideoInput ? { exact: selectedVideoInput } : undefined,
            width: 1280, 
            height: 720 
          } : false
        };
        
        // If both are false, don't request
        if (!constraints.audio && !constraints.video) return;

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        activeStream = stream;
        setLocalStream(stream);
        localStreamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        if (isMicEnabled) {
          setupAudioVisualizer(stream);
        }
        setMediaError('');
      } catch (err) {
        console.error("Stream update error:", err);
      }
    };

    updateStream();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [selectedAudioInput, selectedVideoInput, isMicEnabled, isCamEnabled]);

  const stopMedia = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const setupAudioVisualizer = (stream) => {
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setMicVolume(Math.min(100, (avg / 255) * 200)); // Scale to 0-100
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (e) {
      console.error("Audio visualizer setup failed:", e);
    }
  };

  const handleJoin = () => {
    stopMedia();
    onJoin({
      videoDeviceId: selectedVideoInput,
      audioDeviceId: selectedAudioInput,
      isMicEnabled,
      isCamEnabled
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      backgroundColor: 'var(--bg-dark)'
    }}>
      <div className="glass-container" style={{
        maxWidth: '1000px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        padding: '2rem',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        border: '1px solid var(--border-light)'
      }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
            Ready to join?
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
            {roomDetails?.title || 'Meeting Room'}
          </p>
        </div>

        <div className="join-preview-layout" style={{
          display: 'flex',
          gap: '2rem',
          alignItems: 'stretch'
        }}>
          {/* Left Column - Video Preview */}
          <div className="join-preview-video-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
            <div style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16/9',
              backgroundColor: '#000',
              borderRadius: '12px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
            }}>
              {isCamEnabled && !mediaError ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--text-muted)' }}>
                  <VideoOff size={48} style={{ marginBottom: '1rem' }} />
                  <span>Camera is off</span>
                </div>
              )}

              {/* Status overlays */}
              <div style={{
                position: 'absolute',
                bottom: '1rem',
                left: '1rem',
                backgroundColor: 'rgba(0,0,0,0.6)',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#fff',
                backdropFilter: 'blur(4px)'
              }}>
                <User size={16} />
                <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>{user?.username || 'Guest'}</span>
              </div>
              
              <div style={{
                position: 'absolute',
                bottom: '1rem',
                right: '1rem',
                backgroundColor: 'rgba(0,0,0,0.6)',
                padding: '0.5rem',
                borderRadius: '8px',
                color: '#10b981',
                backdropFilter: 'blur(4px)'
              }} title="Network Quality: Good">
                <Signal size={16} />
              </div>
            </div>

            {/* Quick Controls */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <button
                onClick={() => setIsMicEnabled(!isMicEnabled)}
                className={`btn btn-icon-only ${isMicEnabled ? 'btn-secondary' : 'btn-danger'}`}
                style={{ width: '56px', height: '56px', borderRadius: '50%' }}
              >
                {isMicEnabled ? <Mic size={24} /> : <MicOff size={24} />}
              </button>
              <button
                onClick={() => setIsCamEnabled(!isCamEnabled)}
                className={`btn btn-icon-only ${isCamEnabled ? 'btn-secondary' : 'btn-danger'}`}
                style={{ width: '56px', height: '56px', borderRadius: '50%' }}
              >
                {isCamEnabled ? <VideoIcon size={24} /> : <VideoOff size={24} />}
              </button>
            </div>
            
            {mediaError && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#f87171',
                backgroundColor: 'rgba(248, 113, 113, 0.1)',
                padding: '0.75rem',
                borderRadius: '8px',
                fontSize: '0.9rem'
              }}>
                <AlertTriangle size={18} />
                <span>{mediaError}</span>
              </div>
            )}
          </div>

          {/* Right Column - Device Settings */}
          <div className="join-preview-settings" style={{
            backgroundColor: 'rgba(255,255,255,0.03)',
            padding: '2rem',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            border: '1px solid var(--border-light)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h3 style={{ color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Settings size={20} /> Device Settings
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Microphone</label>
                <select 
                  value={selectedAudioInput} 
                  onChange={(e) => setSelectedAudioInput(e.target.value)}
                  className="input-field"
                  style={{ backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-light)', color: '#fff' }}
                >
                  {audioInputDevices.map(device => (
                    <option key={device.deviceId} value={device.deviceId} style={{ color: '#000' }}>
                      {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                    </option>
                  ))}
                </select>
                {isMicEnabled && (
                  <div style={{ height: '6px', width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '0.25rem', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${micVolume}%`,
                      backgroundColor: micVolume > 80 ? '#f59e0b' : '#10b981',
                      transition: 'width 0.1s ease, background-color 0.2s ease'
                    }} />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Camera</label>
                <select 
                  value={selectedVideoInput} 
                  onChange={(e) => setSelectedVideoInput(e.target.value)}
                  className="input-field"
                  style={{ backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-light)', color: '#fff' }}
                >
                  {videoDevices.map(device => (
                    <option key={device.deviceId} value={device.deviceId} style={{ color: '#000' }}>
                      {device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Speaker</label>
                <select 
                  value={selectedAudioOutput} 
                  onChange={(e) => setSelectedAudioOutput(e.target.value)}
                  className="input-field"
                  style={{ backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-light)', color: '#fff' }}
                >
                  {audioOutputDevices.map(device => (
                    <option key={device.deviceId} value={device.deviceId} style={{ color: '#000' }}>
                      {device.label || `Speaker ${device.deviceId.slice(0, 5)}...`}
                    </option>
                  ))}
                  {audioOutputDevices.length === 0 && (
                    <option style={{ color: '#000' }}>System Default Speaker</option>
                  )}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '3rem' }}>
              <button 
                onClick={onCancel}
                className="btn btn-secondary" 
                style={{ flex: 1, padding: '0.8rem' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleJoin}
                className="btn btn-primary" 
                style={{ flex: 2, padding: '0.8rem', fontWeight: 'bold' }}
              >
                Join Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinPreview;
