// contexts/AppContext.js
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { socket } from '../../client-socket';
import { post } from '../../utilities';
import { useAuth } from './AuthContext';

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  
  // Socket state
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketId, setSocketId] = useState(null);
  
  // Global app state
  const [notifications, setNotifications] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [dataChanges, setDataChanges] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Initialize socket when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      initializeSocket();
    } else {
      disconnectSocket();
    }
    
    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated, user]);

  const initializeSocket = useCallback(async () => {
    try {
      // Connect socket
      socket.connect();
      
      // Set up socket event listeners
      socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        setSocketConnected(true);
        setSocketId(socket.id);
        
        // Initialize socket on server
        if (user) {
          post('/api/initsocket', { socketid: socket.id }).catch(err => 
            console.error('Failed to init socket on server:', err)
          );
        }
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected');
        setSocketConnected(false);
        setSocketId(null);
      });

      // Handle real-time data changes
      socket.on('dataChanged', (data) => {
        console.log('Data changed:', data);
        setDataChanges(prev => [...prev, data]);
        
        // Add notification for important changes
        if (data.severityScore >= 7) {
          addNotification({
            type: 'urgent',
            title: 'High Severity Alert',
            message: data.message,
            timestamp: new Date()
          });
        }
      });

      // Handle active users updates
      socket.on('activeUsers', (users) => {
        setActiveUsers(users);
      });

      // Handle messages
      socket.on('message', (message) => {
        addNotification({
          type: 'message',
          title: `New message from ${message.sender.name}`,
          message: message.content,
          timestamp: new Date()
        });
      });

    } catch (error) {
      console.error('Socket initialization error:', error);
    }
  }, [user]);

  const disconnectSocket = useCallback(() => {
    if (socket.connected) {
      socket.disconnect();
    }
    // Remove all listeners
    socket.off('connect');
    socket.off('disconnect');
    socket.off('dataChanged');
    socket.off('activeUsers');
    socket.off('message');
  }, []);

  // Notification management
  const addNotification = useCallback((notification) => {
    const newNotification = {
      id: Date.now(),
      ...notification,
      read: false
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    
    // Auto-remove after 10 seconds for non-urgent notifications
    if (notification.type !== 'urgent') {
      setTimeout(() => {
        removeNotification(newNotification.id);
      }, 10000);
    }
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const markNotificationAsRead = useCallback((id) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Menu management
  const toggleMenu = useCallback(() => {
    setIsMenuOpen(prev => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  // Emit socket events
  const emitSocketEvent = useCallback((event, data) => {
    if (socketConnected) {
      socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit event:', event);
    }
  }, [socketConnected]);

  // Get latest data change for a specific collection
  const getLatestDataChange = useCallback((collection) => {
    return dataChanges
      .filter(change => change.collection === collection)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
  }, [dataChanges]);

  // Clear data changes older than specified minutes
  const clearOldDataChanges = useCallback((minutes = 5) => {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    setDataChanges(prev => 
      prev.filter(change => new Date(change.timestamp) > cutoffTime)
    );
  }, []);

  const value = {
    // Socket state
    socket,
    socketConnected,
    socketId,
    
    // Socket methods
    emitSocketEvent,
    
    // Notifications
    notifications,
    addNotification,
    removeNotification,
    markNotificationAsRead,
    clearAllNotifications,
    
    // Active users
    activeUsers,
    
    // Data changes
    dataChanges,
    getLatestDataChange,
    clearOldDataChanges,
    
    // Menu state
    isMenuOpen,
    toggleMenu,
    closeMenu
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

// HOC for components that need app context
export const withApp = (Component) => {
  return (props) => {
    const appContext = useApp();
    return <Component {...props} {...appContext} />;
  };
};


