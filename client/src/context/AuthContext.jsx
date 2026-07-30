import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('livelink_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedUser = localStorage.getItem('livelink_user');
      const storedToken = localStorage.getItem('livelink_token');

      if (storedUser && storedToken) {
        try {
          setUser(JSON.parse(storedUser));
          setToken(storedToken);
          
          // Verify token with backend
          const response = await api.get('/auth/me');
          setUser(response.data);
          localStorage.setItem('livelink_user', JSON.stringify(response.data));
        } catch (error) {
          console.error('Session validation failed:', error);
          logout();
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token: userToken, ...userData } = response.data;
      
      localStorage.setItem('livelink_token', userToken);
      localStorage.setItem('livelink_user', JSON.stringify(userData));
      
      setToken(userToken);
      setUser(userData);
      setLoading(false);
      return { success: true };
    } catch (error) {
      setLoading(false);
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed. Please try again.',
      };
    }
  };

  const register = async (username, email, password) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/register', { username, email, password });
      const { token: userToken, ...userData } = response.data;

      localStorage.setItem('livelink_token', userToken);
      localStorage.setItem('livelink_user', JSON.stringify(userData));

      setToken(userToken);
      setUser(userData);
      setLoading(false);
      return { success: true };
    } catch (error) {
      setLoading(false);
      return {
        success: false,
        message: error.response?.data?.message || 'Registration failed. Please try again.',
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('livelink_token');
    localStorage.removeItem('livelink_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
