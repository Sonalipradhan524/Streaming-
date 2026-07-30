import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import {
  LogOut,
  Plus,
  LogIn,
  Video,
  RefreshCw,
  Trash2,
  Calendar,
  Users,
  Activity,
  Clock,
  User as UserIcon,
  Settings,
  BarChart2,
  Bell,
  Search,
  Save,
  Camera,
  Globe,
  Tv,
  Check,
  ChevronRight,
  TrendingUp,
  Cpu
} from 'lucide-react';

const Dashboard = () => {
  const { user, logout, login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Navigation state
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'analytics', 'profile', 'settings'

  // Room listings states
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  // Profile forms states
  const [fullName, setFullName] = useState(user?.fullName || user?.username || '');
  const [profilePicture, setProfilePicture] = useState(user?.profilePicture || '');
  const [profileLoading, setProfileLoading] = useState(false);

  // Settings states
  const [streamQuality, setStreamQuality] = useState('720p');
  const [audioAlerts, setAudioAlerts] = useState(true);
  const [screenAlerts, setScreenAlerts] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(false);

  // Real dashboard statistics
  const [stats, setStats] = useState({
    activeStreams: 0,
    usersOnline: 1,
    meetingsToday: 0,
    totalUsers: 1,
  });

  // Scheduled Meetings state
  const [scheduledMeetings, setScheduledMeetings] = useState([]);

  // Recent Activities state
  const [activities, setActivities] = useState([]);

  // New room schedule states
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');

  const fetchRooms = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/rooms');
      setRooms(response.data);
      setError('');
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
      setError('Could not fetch active rooms.');
      showToast('Connection to server failed. Retrying...', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const statsRes = await api.get('/rooms/stats');
      setStats(statsRes.data);

      const schedRes = await api.get('/rooms/scheduled');
      setScheduledMeetings(schedRes.data);

      const actRes = await api.get('/activities');
      setActivities(actRes.data);
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    }
  };

  useEffect(() => {
    fetchRooms();
    fetchDashboardData();
  }, []);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    if (isScheduled && !scheduledTime) {
      showToast('Please select a scheduled date and time', 'error');
      return;
    }

    setActionLoading(true);
    setError('');
    try {
      const response = await api.post('/rooms', { 
        name: newRoomName, 
        isScheduled, 
        scheduledAt: isScheduled ? scheduledTime : undefined 
      });
      const createdRoom = response.data;
      
      if (isScheduled) {
        showToast(`Meeting "${createdRoom.name}" scheduled successfully!`, 'success');
        setNewRoomName('');
        setIsScheduled(false);
        setScheduledTime('');
        fetchDashboardData();
        fetchRooms();
      } else {
        showToast(`Stream "${createdRoom.name}" created successfully!`, 'success');
        navigate(`/room/${createdRoom.roomId}`);
      }
    } catch (err) {
      console.error('Failed to create room:', err);
      setError(err.response?.data?.message || 'Failed to create room.');
      showToast('Error creating streaming room', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!joinRoomCode.trim()) return;
    
    showToast(`Joining room: ${joinRoomCode}`, 'info');
    navigate(`/room/${joinRoomCode.trim()}`);
  };

  const handleDeleteRoom = async (roomId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this room?')) return;

    try {
      await api.delete(`/rooms/${roomId}`);
      setRooms(rooms.filter(room => room.roomId !== roomId));
      showToast('Streaming room deleted successfully.', 'success');
      fetchDashboardData();
    } catch (err) {
      console.error('Failed to delete room:', err);
      showToast(err.response?.data?.message || 'Failed to delete room.', 'error');
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      const response = await api.put('/auth/profile', {
        fullName,
        profilePicture
      });
      // Store updated user details
      localStorage.setItem('livelink_user', JSON.stringify(response.data));
      showToast('Profile updated successfully!', 'success');
      
      // Forces profile components state updates by updating local token triggers if needed
      // (in our basic AuthProvider, we pull user from state. We can reload page or trigger update helper).
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      console.error('Profile update failed:', err);
      showToast(err.response?.data?.message || 'Profile update failed.', 'error');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleCopyLink = (code, e) => {
    e.stopPropagation();
    const link = `${window.location.origin}/room/${code}`;
    navigator.clipboard.writeText(link);
    showToast('Meeting link copied to clipboard!', 'success');
  };

  return (
    <div style={{ height: '100vh', display: 'flex', backgroundColor: 'var(--bg-dark)', overflow: 'hidden' }} className="fade-in">
      <div className="bg-glow-wrapper">
        <div className="glow-orb-1"></div>
        <div className="glow-orb-2"></div>
      </div>

      <aside className="glass-container sidebar-nav-container" style={{
        width: '260px',
        borderRight: '1px solid var(--border-light)',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.75rem',
        borderRadius: '0',
        zIndex: 10,
        flexShrink: 0
      }}>
        
        {/* Logo Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem' }}>
          <div style={{
            background: 'var(--primary-gradient)',
            borderRadius: '10px',
            padding: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow)'
          }}>
            <Video size={22} color="#fff" />
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', background: 'var(--primary-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            LiveLink
          </span>
        </div>

        {/* Navigation Tabs Links */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}>
          <button
            onClick={() => setActiveTab('overview')}
            className={`tab-nav-btn ${activeTab === 'overview' ? 'active' : ''}`}
          >
            <Tv size={18} />
            <span>Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`tab-nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          >
            <BarChart2 size={18} />
            <span>Analytics</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`tab-nav-btn ${activeTab === 'profile' ? 'active' : ''}`}
          >
            <UserIcon size={18} />
            <span>Profile</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`tab-nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
        </nav>

        {/* Logout at bottom */}
        <button onClick={logout} className="btn btn-secondary" style={{ width: '100%', padding: '0.65rem 1rem', fontSize: '0.9rem' }}>
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </aside>

      {/* 2. Main Viewport Panel */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', height: '100%' }}>
        
        {/* Top Header Controls bar */}
        <header className="glass-container" style={{
          padding: '1rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderWidth: '0 0 1px 0',
          borderRadius: '0',
          zIndex: 5
        }}>
          {/* Header search bar */}
          <div style={{ position: 'relative', width: '280px' }} className="header-search-bar">
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search streams or tags..."
              style={{ width: '100%', padding: '0.5rem 1rem 0.5rem 2.25rem', fontSize: '0.85rem', borderRadius: '10px' }}
            />
          </div>

          {/* User actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <button className="btn btn-secondary" style={{ padding: '0.5rem', borderRadius: '50%', width: '38px', height: '38px' }} title="Notifications">
              <Bell size={18} color="var(--text-muted)" />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ textDirection: 'ltr', textAlign: 'right' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, display: 'block' }}>{user?.fullName || user?.username}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{user?.email}</span>
              </div>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: user?.avatarColor || 'var(--primary)',
                backgroundImage: user?.profilePicture ? `url(${user.profilePicture})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.95rem',
                color: '#fff',
                border: '2px solid rgba(255,255,255,0.1)'
              }}>
                {!user?.profilePicture && (user?.fullName || user?.username || 'U').substring(0, 2).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Tabs Render Viewport */}
        <main style={{ padding: '2rem', maxWidth: '1200px', width: '100%', margin: '0 auto', flexGrow: 1 }}>
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Hero Banner Section */}
              <section className="glass-container" style={{
                padding: '2.5rem',
                border: '1px solid var(--border-light)',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(6, 182, 212, 0.05) 100%)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ maxWidth: '600px', zIndex: 2, position: 'relative' }}>
                  <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>
                    Welcome back, <span className="title-gradient">{user?.fullName || user?.username}</span>!
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                    Launch high-definition streaming rooms, exchange real-time feedback with peers via screen sharing, and utilize state-of-the-art AI highlights to summarize your meetings instantly.
                  </p>
                  <button onClick={() => showToast('Create a stream room using the quick action cards below!', 'info')} className="btn btn-primary">
                    Get Started
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div style={{
                  position: 'absolute',
                  right: '-10%',
                  top: '-10%',
                  width: '350px',
                  height: '350px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, rgba(0, 0, 0, 0) 70%)',
                  filter: 'blur(50px)',
                  zIndex: 1
                }} />
              </section>

              {/* Statistics Grid */}
              <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                {[
                  { label: 'Active Streams', value: stats.activeStreams, icon: <Video size={20} color="var(--primary)" />, trend: 'Live streams' },
                  { label: 'Users Online', value: stats.usersOnline, icon: <Users size={20} color="#06b6d4" />, trend: 'Active sockets' },
                  { label: 'Meetings Today', value: stats.meetingsToday, icon: <Calendar size={20} color="#f59e0b" />, trend: 'Created today' },
                  { label: 'Total Users', value: stats.totalUsers, icon: <Activity size={20} color="var(--success)" />, trend: 'Registered accounts' }
                ].map((stat, idx) => (
                  <div key={idx} className="glass-container" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', border: '1px solid var(--border-light)' }}>
                    <div style={{
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      borderRadius: '12px',
                      padding: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border-light)'
                    }}>
                      {stat.icon}
                    </div>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</span>
                      <span style={{ fontSize: '1.5rem', fontWeight: 800, display: 'block', margin: '2px 0' }}>{stat.value}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <TrendingUp size={12} />
                        {stat.trend}
                      </span>
                    </div>
                  </div>
                ))}
              </section>

              {/* Quick Action Cards Grid */}
              <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2.0rem' }}>
                {/* Create Room */}
                <div className="glass-container" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: 'rgba(139, 92, 246, 0.15)' }}>
                      <Plus size={20} color="var(--primary)" />
                    </div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{isScheduled ? 'Schedule a Meeting' : 'Start an Instant Stream'}</h3>
                  </div>
                  <form onSubmit={handleCreateRoom}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="room-name-ov">Room Name</label>
                      <input
                        id="room-name-ov"
                        type="text"
                        className="form-input"
                        placeholder="e.g. Frontend Engineering Sync"
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        required
                      />
                    </div>

                     <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '0.75rem', marginBottom: '0.75rem' }}>
                       <input
                         type="checkbox"
                         id="is-scheduled-ov"
                         checked={isScheduled}
                         onChange={(e) => setIsScheduled(e.target.checked)}
                         style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer', margin: 0 }}
                       />
                       <label htmlFor="is-scheduled-ov" style={{ fontSize: '0.875rem', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>Schedule for later</label>
                     </div>

                    {isScheduled && (
                      <div className="form-group" style={{ marginBottom: '1rem', animation: 'fadeIn 0.2s ease-out' }}>
                        <label className="form-label" htmlFor="scheduled-time-ov">Scheduled Date & Time</label>
                        <input
                          id="scheduled-time-ov"
                          type="datetime-local"
                          className="form-input"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          required
                          style={{ colorScheme: 'dark' }}
                        />
                      </div>
                    )}

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.25rem' }} disabled={actionLoading}>
                      <Video size={18} />
                      {actionLoading ? (isScheduled ? 'Scheduling...' : 'Creating room...') : (isScheduled ? 'Schedule Meeting' : 'Create & Join Stream')}
                    </button>
                  </form>
                </div>

                {/* Join Room */}
                <div className="glass-container" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: 'rgba(6, 182, 212, 0.15)' }}>
                      <LogIn size={20} color="#06b6d4" />
                    </div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Join Meeting Room</h3>
                  </div>
                  <form onSubmit={handleJoinRoom}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="room-code-ov">Room Code</label>
                      <input
                        id="room-code-ov"
                        type="text"
                        className="form-input"
                        placeholder="e.g. abc-defg-hij"
                        value={joinRoomCode}
                        onChange={(e) => setJoinRoomCode(e.target.value)}
                        required
                      />
                    </div>
                    <button type="submit" className="btn btn-secondary" style={{ width: '100%', borderColor: 'rgba(6, 182, 212, 0.4)', marginTop: '0.25rem' }}>
                      <LogIn size={18} />
                      Join Room
                    </button>
                  </form>
                </div>
              </section>

              {/* Active Streams List */}
              <section className="glass-container" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="status-badge live"></span>
                    Running Streams
                  </h3>
                  <button onClick={fetchRooms} className="btn btn-secondary" style={{ padding: '0.5rem', borderRadius: '50%' }} title="Refresh" disabled={isLoading}>
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} style={{ animation: isLoading ? 'spin 1.5s linear infinite' : 'none' }} />
                  </button>
                </div>

                {isLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '1rem' }}>
                    <RefreshCw size={36} color="var(--primary)" className="animate-spin" style={{ animation: 'spin 1.5s linear infinite' }} />
                    <span style={{ color: 'var(--text-muted)' }}>Searching for live streams...</span>
                  </div>
                ) : rooms.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', border: '1px dashed var(--border-light)', borderRadius: '12px', textAlign: 'center' }}>
                    <Video size={32} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '0.75rem' }} />
                    <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>No Active Streams</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Start an instant stream above to begin broadcasting.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                    {rooms.map((room) => (
                      <div
                        key={room._id}
                        onClick={() => navigate(`/room/${room.roomId}`)}
                        className="glass-container glass-container-hover"
                        style={{ padding: '1.25rem', border: '1px solid var(--border-light)', cursor: 'pointer', position: 'relative' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'rgba(139, 92, 246, 0.1)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(139, 92, 246, 0.15)' }}>
                            LIVE
                          </span>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={(e) => handleCopyLink(room.roomId, e)} className="btn" style={{ padding: '4px', background: 'none', border: 'none', color: 'var(--text-muted)' }} title="Copy Link">
                              <LogIn size={14} />
                            </button>
                            {user && room.host && user._id === room.host._id && (
                              <button onClick={(e) => handleDeleteRoom(room.roomId, e)} className="btn" style={{ padding: '4px', background: 'none', border: 'none', color: 'var(--text-muted)' }} title="Delete Room">
                                <Trash2 size={14} color="var(--danger)" />
                              </button>
                            )}
                          </div>
                        </div>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {room.name}
                        </h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span>Host: {room.host?.username || 'Unknown'}</span>
                          <span>{room.participants?.length || 0} watching</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Bottom Multi-column Layout: Scheduled Meetings & Recent Activity */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                {/* Upcoming Scheduled */}
                <section className="glass-container" style={{ padding: '2rem' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={18} color="#f59e0b" />
                    Upcoming Scheduled Meetings
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {scheduledMeetings.length === 0 ? (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No upcoming scheduled meetings.</span>
                    ) : (
                      scheduledMeetings.map((meeting) => (
                        <div key={meeting._id} className="glass-container" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)' }}>
                          <div>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>{meeting.name}</h4>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                              {new Date(meeting.scheduledAt).toLocaleString()}
                            </span>
                          </div>
                          <button onClick={() => navigate(`/room/${meeting.roomId}`)} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: '8px' }}>
                            Join
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                {/* Recent Activities */}
                <section className="glass-container" style={{ padding: '2rem' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={18} color="var(--success)" />
                    Recent Activity
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {activities.length === 0 ? (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No recent activity logged.</span>
                    ) : (
                      activities.map((act) => (
                        <div key={act._id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', fontSize: '0.85rem' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)', marginTop: '5px', flexShrink: 0 }}></div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ color: 'var(--text-main)', lineHeight: 1.4 }}>{act.text}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {new Date(act.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>

            </div>
          )}

          {/* TAB 2: ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <h2 className="title-gradient" style={{ fontSize: '1.5rem', fontWeight: 800 }}>Analytics Workspace</h2>
              
              {/* Performance Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                <div className="glass-container" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Meeting Duration</h3>
                  <span style={{ fontSize: '1.75rem', fontWeight: 800 }}>24.8 Hours</span>
                  <p style={{ fontSize: '0.8rem', color: 'var(--success)', marginTop: '4px' }}>+4.2 hours compared to last week</p>
                </div>
                <div className="glass-container" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Network Quality</h3>
                  <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success)' }}>Excellent</span>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Avg Latency: 24ms (RTT)</p>
                </div>
                <div className="glass-container" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Active Device</h3>
                  <span style={{ fontSize: '1.75rem', fontWeight: 800 }}>Browser / Client</span>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Windows PC (Chrome)</p>
                </div>
              </div>

              {/* Data Table */}
              <section className="glass-container" style={{ padding: '2rem', overflowX: 'auto' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem' }}>Recent Streaming Session Log</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <th style={{ padding: '12px 8px' }}>Date</th>
                      <th style={{ padding: '12px 8px' }}>Room Name</th>
                      <th style={{ padding: '12px 8px' }}>Duration</th>
                      <th style={{ padding: '12px 8px' }}>Participants</th>
                      <th style={{ padding: '12px 8px' }}>Quality Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { date: '2026-07-29', name: 'Product Engineering Sync', dur: '45 mins', members: 4, q: '98% (Excellent)' },
                      { date: '2026-07-28', name: 'UI Design Review Workshop', dur: '1 hr 12m', members: 3, q: '94% (Good)' },
                      { date: '2026-07-25', name: 'Marketing Core Pitch Sync', dur: '30 mins', members: 6, q: '89% (Good)' },
                      { date: '2026-07-24', name: 'Weekly General Alignment', dur: '58 mins', members: 12, q: '96% (Excellent)' }
                    ].map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)', fontSize: '0.875rem' }}>
                        <td style={{ padding: '12px 8px' }}>{row.date}</td>
                        <td style={{ padding: '12px 8px', fontWeight: 600 }}>{row.name}</td>
                        <td style={{ padding: '12px 8px' }}>{row.dur}</td>
                        <td style={{ padding: '12px 8px' }}>{row.members} peers</td>
                        <td style={{ padding: '12px 8px', color: 'var(--success)' }}>{row.q}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          )}

          {/* TAB 3: PROFILE */}
          {activeTab === 'profile' && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '600px' }}>
              <h2 className="title-gradient" style={{ fontSize: '1.5rem', fontWeight: 800 }}>Profile Configuration</h2>
              
              <section className="glass-container" style={{ padding: '2.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                  <div style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    backgroundColor: user?.avatarColor || 'var(--primary)',
                    backgroundImage: profilePicture ? `url(${profilePicture})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.75rem',
                    color: '#fff',
                    border: '3px solid rgba(255,255,255,0.08)',
                    position: 'relative'
                  }}>
                    {!profilePicture && (fullName || 'U').substring(0, 2).toUpperCase()}
                    <div style={{
                      position: 'absolute',
                      bottom: '0',
                      right: '0',
                      background: 'var(--primary-gradient)',
                      borderRadius: '50%',
                      padding: '4px',
                      border: '2px solid var(--bg-dark)',
                      display: 'flex'
                    }}>
                      <Camera size={12} color="#fff" />
                    </div>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{fullName}</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Registered Email: {user?.email}</span>
                  </div>
                </div>

                <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="full-name">Full Name</label>
                    <input
                      id="full-name"
                      type="text"
                      className="form-input"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="profile-picture">Profile Picture URL</label>
                    <input
                      id="profile-picture"
                      type="text"
                      className="form-input"
                      placeholder="https://example.com/avatar.jpg"
                      value={profilePicture}
                      onChange={(e) => setProfilePicture(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: 'fit-content', padding: '0.75rem 1.5rem', marginTop: '0.5rem' }} disabled={profileLoading}>
                    <Save size={16} />
                    {profileLoading ? 'Saving edits...' : 'Save Profile Edits'}
                  </button>
                </form>
              </section>
            </div>
          )}

          {/* TAB 4: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '600px' }}>
              <h2 className="title-gradient" style={{ fontSize: '1.5rem', fontWeight: 800 }}>Account & Audio Settings</h2>
              
              {/* Quality Presets */}
              <section className="glass-container" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Tv size={18} color="var(--primary)" />
                  Default Streaming Resolution
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  {['1080p', '720p', '480p'].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setStreamQuality(q); showToast(`Resolution preset set to ${q}`, 'info'); }}
                      style={{
                        padding: '0.75rem',
                        background: streamQuality === q ? 'var(--primary-glow)' : 'rgba(255,255,255,0.02)',
                        border: streamQuality === q ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                        borderRadius: '10px',
                        color: streamQuality === q ? 'var(--primary)' : 'var(--text-main)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'var(--transition-smooth)'
                      }}
                    >
                      {q === '1080p' ? 'Full HD (1080p)' : q === '720p' ? 'HD Ready (720p)' : 'Standard (480p)'}
                    </button>
                  ))}
                </div>
              </section>

              {/* Notification Toggles */}
              <section className="glass-container" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Bell size={18} color="#06b6d4" />
                  Alert Preferences
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Item 1 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block' }}>Audio Alert Sounds</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Play sound on user joins and reactions.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={audioAlerts}
                      onChange={(e) => setAudioAlerts(e.target.checked)}
                      style={{ width: '38px', height: '20px', cursor: 'pointer' }}
                    />
                  </div>
                  {/* Item 2 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                    <div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block' }}>Screen Toast Notifications</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Display alerts on the bottom right of the screen.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={screenAlerts}
                      onChange={(e) => setScreenAlerts(e.target.checked)}
                      style={{ width: '38px', height: '20px', cursor: 'pointer' }}
                    />
                  </div>
                  {/* Item 3 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                    <div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block' }}>Email Summaries</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Receive email updates with AI summaries after meetings.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailAlerts}
                      onChange={(e) => setEmailAlerts(e.target.checked)}
                      style={{ width: '38px', height: '20px', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              </section>
            </div>
          )}

        </main>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .sidebar-nav-container {
            width: 72px !important;
            padding: 1rem 0.5rem !important;
            align-items: center !important;
          }
          .sidebar-nav-container span {
            display: none !important;
          }
          .tab-nav-btn {
            justify-content: center !important;
            padding: 10px !important;
          }
        }
        @media (max-width: 768px) {
          .header-search-bar {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
