import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Video,
  Bot,
  Globe2,
  FileText,
  MonitorUp,
  ShieldCheck,
  CircleDot,
  MessageSquare,
  Settings,
  Quote
} from 'lucide-react';
import '../styles/landing.css';

const Landing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleStartMeeting = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="landing-wrapper">
      {/* Background Particles */}
      <div className="landing-particle" style={{ width: '300px', height: '300px', top: '10%', left: '20%' }}></div>
      <div className="landing-particle" style={{ width: '200px', height: '200px', top: '60%', left: '80%', animationDelay: '5s' }}></div>
      <div className="landing-particle" style={{ width: '150px', height: '150px', top: '30%', left: '60%', animationDelay: '10s' }}></div>

      {/* Navbar */}
      <nav className="landing-nav">
        <Link to="/" className="landing-logo">
          <Video className="landing-logo-icon" size={28} />
          LiveLink
        </Link>
        <div className="landing-nav-links">
          <a href="#features" className="landing-nav-link">Features</a>
          <a href="#how-it-works" className="landing-nav-link">How it Works</a>
          <a href="#testimonials" className="landing-nav-link">Testimonials</a>
          {user ? (
            <Link to="/dashboard" className="landing-btn-outline">Dashboard</Link>
          ) : (
            <Link to="/login" className="landing-btn-outline">Log In</Link>
          )}
        </div>
      </nav>

      <div className="landing-container">
        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-grid">
            <div className="hero-content">
              <h1>The Future of AI-Powered Meetings</h1>
              <p>
                Experience seamless HD video conferencing with built-in AI assistance,
                real-time translation, and automated summaries. Elevate your collaboration today.
              </p>
              <div className="hero-actions">
                <button onClick={handleStartMeeting} className="landing-btn-primary hero-btn-large">
                  Start Meeting
                </button>
                <button onClick={handleStartMeeting} className="landing-btn-outline hero-btn-large">
                  Join Meeting
                </button>
              </div>
            </div>
            <div className="hero-image-wrapper">
              <div className="hero-glow"></div>
              <img src="/hero-preview.png" alt="LiveLink Dashboard Preview" className="hero-image" />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="section-padding">
          <div className="section-header">
            <h2 className="section-title">Powerful Features</h2>
            <p className="section-subtitle">Everything you need for productive, intelligent, and secure meetings.</p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-wrapper"><Video size={32} /></div>
              <h3>HD Video Meetings</h3>
              <p>Crystal clear 720p/1080p video with low-latency WebRTC technology for seamless communication.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrapper"><Bot size={32} /></div>
              <h3>AI Assistant</h3>
              <p>Your personal meeting co-pilot. Ask questions, get insights, and manage tasks in real-time.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrapper"><Globe2 size={32} /></div>
              <h3>Live Language Translation</h3>
              <p>Break down language barriers with real-time audio and text translation during your streams.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrapper"><FileText size={32} /></div>
              <h3>AI Meeting Summary</h3>
              <p>Automatically generate comprehensive transcripts and actionable summaries after every meeting.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrapper"><MonitorUp size={32} /></div>
              <h3>Screen Sharing</h3>
              <p>Share your entire screen, a specific window, or a browser tab with high frame rates.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrapper"><ShieldCheck size={32} /></div>
              <h3>Secure Authentication</h3>
              <p>Enterprise-grade security ensuring your meetings and data are always protected.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrapper"><CircleDot size={32} /></div>
              <h3>Meeting Recording</h3>
              <p>Record your sessions directly to your local device or the cloud for later review.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrapper"><MessageSquare size={32} /></div>
              <h3>Real-Time Chat</h3>
              <p>Integrated text chat with file sharing and emoji support alongside your video stream.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrapper"><Settings size={32} /></div>
              <h3>Host Controls</h3>
              <p>Manage participants, control audio/video permissions, and moderate the room effectively.</p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="section-padding">
          <div className="section-header">
            <h2 className="section-title">How It Works</h2>
            <p className="section-subtitle">Get started in four simple steps</p>
          </div>
          <div className="steps-container">
            <div className="step-card">
              <div className="step-number">1</div>
              <h3>Login</h3>
              <p style={{ color: 'var(--landing-text-muted)' }}>Create an account or sign in securely.</p>
              <div className="step-connector"></div>
            </div>
            <div className="step-card">
              <div className="step-number">2</div>
              <h3>Create or Join</h3>
              <p style={{ color: 'var(--landing-text-muted)' }}>Start a new room or join with a unique ID.</p>
              <div className="step-connector"></div>
            </div>
            <div className="step-card">
              <div className="step-number">3</div>
              <h3>Collaborate with AI</h3>
              <p style={{ color: 'var(--landing-text-muted)' }}>Use the AI assistant to summarize and assist.</p>
              <div className="step-connector"></div>
            </div>
            <div className="step-card">
              <div className="step-number">4</div>
              <h3>Save History</h3>
              <p style={{ color: 'var(--landing-text-muted)' }}>Access transcripts and summaries anytime.</p>
            </div>
          </div>
        </section>

        {/* Statistics */}
        <section className="section-padding">
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-value">50k+</div>
              <div className="stat-label">Meetings Created</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">120k</div>
              <div className="stat-label">Active Users</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">1M+</div>
              <div className="stat-label">AI Responses</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">150+</div>
              <div className="stat-label">Countries Supported</div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="section-padding">
          <div className="section-header">
            <h2 className="section-title">Loved by Teams</h2>
            <p className="section-subtitle">See what our users are saying about LiveLink.</p>
          </div>
          <div className="testimonials-grid">
            <div className="testimonial-card">
              <Quote className="quote-icon" size={48} />
              <p className="testimonial-text">
                "We migrated our 500+ remote team to LiveLink. The AI meeting summaries are incredibly accurate, and the real-time translation has completely unified our global offices. It's essentially replaced three different tools in our stack."
              </p>
              <div className="testimonial-author">
                <img src="https://i.pravatar.cc/150?img=11" alt="Alex Chen" className="author-avatar" />
                <div className="author-info">
                  <h4>Alex Chen</h4>
                  <p>VP of Engineering at TechFlow</p>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <Quote className="quote-icon" size={48} />
              <p className="testimonial-text">
                "Hosting virtual classes has never been easier. The HD video remains stable even with 100+ participants, and the host controls give our instructors perfect command over the room. The integrated screen sharing is flawless."
              </p>
              <div className="testimonial-author">
                <img src="https://i.pravatar.cc/150?img=32" alt="Priya Sharma" className="author-avatar" />
                <div className="author-info">
                  <h4>Priya Sharma</h4>
                  <p>Director of Education at GlobalEd</p>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <Quote className="quote-icon" size={48} />
              <p className="testimonial-text">
                "As an independent consultant, having a professional, secure meeting platform is crucial. LiveLink's sleek interface impresses my clients every time, and the auto-generated transcripts save me hours of manual note-taking."
              </p>
              <div className="testimonial-author">
                <img src="https://i.pravatar.cc/150?img=8" alt="Marcus Johnson" className="author-avatar" />
                <div className="author-info">
                  <h4>Marcus Johnson</h4>
                  <p>Independent Consultant</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-col">
            <Link to="/" className="landing-logo" style={{ marginBottom: '1rem', display: 'inline-flex' }}>
              <Video className="landing-logo-icon" size={24} />
              LiveLink
            </Link>
            <p>
              Empowering remote teams with next-generation, AI-driven video collaboration. Build connections without boundaries.
            </p>
          </div>
          <div className="footer-col">
            <h3>Features</h3>
            <ul className="footer-links">
              <li><a href="#features">Video Conferencing</a></li>
              <li><a href="#features">AI Assistant</a></li>
              <li><a href="#features">Live Translation</a></li>
              <li><a href="#features">Meeting Summaries</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h3>Company</h3>
            <ul className="footer-links">
              <li><a href="#">About Us</a></li>
              <li><a href="#">Careers</a></li>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms of Service</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h3>Connect</h3>
            <ul className="footer-links">
              <li><a href="#">Contact Support</a></li>
              <li><a href="#">Twitter / X</a></li>
              <li><a href="#">LinkedIn</a></li>
              <li><a href="#">GitHub</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          &copy; {new Date().getFullYear()} LiveLink. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Landing;
