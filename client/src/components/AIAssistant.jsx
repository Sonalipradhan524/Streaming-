import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  MessageSquare,
  X,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Languages,
  RotateCcw,
  Copy,
  Check,
  Bot,
  Trash2,
  Loader2
} from 'lucide-react';

const LANGUAGES = [
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

const AIAssistant = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState('English');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (user && isOpen && history.length === 0) {
      loadHistory();
    }
  }, [isOpen, user]);

  useEffect(() => {
    scrollToBottom();
  }, [history, isTyping]);

  useEffect(() => {
    if (window.SpeechRecognition || window.webkitSpeechRecognition) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      // Note: We can try mapping the selected language to a locale later, but 'en-US' is a safe default.
      recognitionRef.current.lang = 'en-US'; 
      
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev ? `${prev} ${transcript}` : transcript);
        setIsListening(false);
      };
      
      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
        showToast('Speech recognition failed. Please try again.', 'error');
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const loadHistory = async () => {
    try {
      const currentMeetingId = window.meetingContext?.roomId || 'global';
      const res = await api.get(`/ai/history/${currentMeetingId}`);
      if (res.data.success) {
        setHistory(res.data.history);
      }
    } catch (err) {
      console.error('Failed to load AI history:', err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (textToProcess = input) => {
    if (!textToProcess.trim()) return;
    
    const userMsg = { _id: Date.now().toString(), question: textToProcess, response: '', language, isTemp: true };
    setHistory(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const currentMeetingId = window.meetingContext?.roomId || 'global';
      let contextStr = '';
      
      // Inject real-time meeting context securely
      if (window.meetingContext?.messages) {
        const recentMessages = window.meetingContext.messages.slice(-50).map(m => `${m.senderName}: ${m.text}`).join('\n');
        contextStr += `Recent Chat History:\n${recentMessages}\n\n`;
      }
      if (window.meetingContext?.timelineEvents) {
        const events = window.meetingContext.timelineEvents.slice(-20).map(e => `[${e.type}] ${e.title}: ${e.description}`).join('\n');
        contextStr += `Recent Timeline Events:\n${events}`;
      }

      const res = await api.post('/ai/ask', {
        question: textToProcess,
        meetingId: currentMeetingId,
        context: contextStr,
        language
      });

      if (res.data.success) {
        setHistory(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg.isTemp) {
            lastMsg.response = res.data.answer;
            lastMsg._id = res.data.chatId;
            delete lastMsg.isTemp;
          }
          return updated;
        });
      }
    } catch (error) {
      showToast('AI is currently unavailable. Please try again.', 'error');
      setHistory(prev => prev.filter(msg => !msg.isTemp)); // Remove failed msg
    } finally {
      setIsTyping(false);
    }
  };

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      try {
        const selectedLang = LANGUAGES.find(l => l.label === language);
        if (selectedLang) {
          recognitionRef.current.lang = selectedLang.code;
        }
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        showToast('Speech API is busy, please wait.', 'warning');
      }
    }
  };

  const speakText = (text) => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    const selectedLang = LANGUAGES.find(l => l.label === language);
    if (selectedLang) {
      utterance.lang = selectedLang.code;
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  const handleCopy = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      showToast('Failed to copy text', 'error');
    }
  };
  
  const handleRegenerate = (question) => {
    handleSend(question);
  };

  const clearChat = () => {
    setHistory([]);
    showToast('Chat cleared locally', 'info');
  };

  if (!user) return null; // Don't show if not logged in

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          className="btn btn-primary ai-assistant-fab"
          onClick={() => setIsOpen(true)}
          title="Ask AI Assistant"
        >
          <Bot size={24} />
        </button>
      )}

      {/* AI Chat Panel */}
      <div className={`ai-chat-panel glass-container ${isOpen ? 'open' : ''}`}>
        
        {/* Header */}
        <div className="ai-chat-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: 'var(--primary)', padding: '6px', borderRadius: '8px', color: '#fff' }}>
              <Bot size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 'bold' }}>AI Assistant</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Powered by Gemini</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button onClick={clearChat} className="btn btn-icon-only" style={{ width: '32px', height: '32px', background: 'none', border: 'none' }} title="Clear Chat">
              <Trash2 size={16} />
            </button>
            <button onClick={() => setIsOpen(false)} className="btn btn-icon-only" style={{ width: '32px', height: '32px', background: 'none', border: 'none' }} title="Close">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Configuration Bar */}
        <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)' }}>
          <Languages size={14} color="var(--text-muted)" />
          <select 
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={{ flex: 1, background: 'var(--surface-light)', border: '1px solid var(--border-light)', color: 'var(--text-main)', borderRadius: '6px', padding: '4px 8px', fontSize: '0.8rem' }}
          >
            {LANGUAGES.map(lang => (
              <option key={lang.code} value={lang.label}>{lang.label}</option>
            ))}
          </select>
        </div>

        {/* Chat History Area */}
        <div className="ai-chat-history">
          {history.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center', gap: '1rem', padding: '2rem' }}>
              <Bot size={48} opacity={0.3} />
              <p style={{ fontSize: '0.9rem' }}>Hi {user.username}! I can help you summarize the meeting, answer technical questions, or track action items.<br/><br/>Ask me anything!</p>
            </div>
          ) : (
            history.map((msg, idx) => (
              <div key={msg._id || idx} style={{ marginBottom: '1.5rem' }}>
                
                {/* User Message */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                  <div style={{ background: 'var(--primary)', color: '#fff', padding: '10px 14px', borderRadius: '16px', borderBottomRightRadius: '4px', maxWidth: '85%', fontSize: '0.9rem', lineHeight: 1.4 }}>
                    {msg.question}
                  </div>
                </div>

                {/* AI Response */}
                {msg.response && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ background: 'var(--surface-light)', border: '1px solid var(--border-light)', padding: '12px', borderRadius: '16px', borderBottomLeftRadius: '4px', maxWidth: '90%', fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text-main)' }}>
                      
                      <div className="markdown-body">
                        <ReactMarkdown
                          components={{
                            code({node, inline, className, children, ...props}) {
                              const match = /language-(\w+)/.exec(className || '')
                              return !inline && match ? (
                                <SyntaxHighlighter
                                  children={String(children).replace(/\n$/, '')}
                                  style={vscDarkPlus}
                                  language={match[1]}
                                  PreTag="div"
                                  {...props}
                                />
                              ) : (
                                <code className={className} style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '4px' }} {...props}>
                                  {children}
                                </code>
                              )
                            }
                          }}
                        >
                          {msg.response}
                        </ReactMarkdown>
                      </div>

                      {/* Action Bar for AI Response */}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--border-light)' }}>
                        <button onClick={() => speakText(msg.response)} className="btn btn-icon-only" style={{ width: '28px', height: '28px', background: 'none', border: 'none', color: isSpeaking ? 'var(--primary)' : 'var(--text-muted)' }} title={isSpeaking ? 'Stop speaking' : 'Read aloud'}>
                          {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                        </button>
                        <button onClick={() => handleCopy(msg.response, msg._id)} className="btn btn-icon-only" style={{ width: '28px', height: '28px', background: 'none', border: 'none', color: copiedId === msg._id ? 'var(--success)' : 'var(--text-muted)' }} title="Copy">
                          {copiedId === msg._id ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                        <button onClick={() => handleRegenerate(msg.question)} className="btn btn-icon-only" style={{ width: '28px', height: '28px', background: 'none', border: 'none', color: 'var(--text-muted)' }} title="Regenerate">
                          <RotateCcw size={14} />
                        </button>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            ))
          )}
          
          {isTyping && (
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', color: 'var(--primary)', padding: '1rem', background: 'var(--surface-light)', borderRadius: '16px', borderBottomLeftRadius: '4px', width: 'fit-content' }}>
              <Loader2 size={16} className="animate-spin" />
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>AI is thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="ai-chat-input-area">
          <button 
            onClick={toggleListen}
            className={`btn btn-icon-only ${isListening ? 'btn-danger animate-pulse' : ''}`}
            style={{ width: '40px', height: '40px', background: isListening ? 'var(--danger)' : 'var(--surface-dark)', border: 'none', borderRadius: '50%' }}
            title={isListening ? 'Stop listening' : 'Voice input'}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={isListening ? "Listening..." : "Ask me anything..."}
            style={{
              flex: 1,
              background: 'var(--surface-dark)',
              border: '1px solid var(--border-light)',
              color: '#fff',
              padding: '10px 14px',
              borderRadius: '20px',
              fontSize: '0.9rem',
              outline: 'none'
            }}
          />
          
          <button 
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isTyping}
            className="btn btn-primary btn-icon-only"
            style={{ width: '40px', height: '40px', borderRadius: '50%', opacity: (!input.trim() || isTyping) ? 0.5 : 1 }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </>
  );
};

export default AIAssistant;
