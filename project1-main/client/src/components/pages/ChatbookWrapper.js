// pages/ChatbookWrapper.js
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import Chatbook from './Chatbook'; // Your existing Chatbook with socket features

const ChatbookWrapper = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading chat...</div>;
  }

  if (!isAuthenticated || !user) {
    return null; // ProtectedRoute handles redirect
  }

  // Pass userId to your original Chatbook
  return <Chatbook userId={user.id} />;
};

export default ChatbookWrapper;
