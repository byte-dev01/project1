// contexts/UIContext.js
import React, { createContext, useContext, useState, useCallback } from 'react';

const UIContext = createContext();

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error("useUI must be used within a UIProvider");
  }
  return context;
};

export const UIProvider = ({ children }) => {
  const [theme, setTheme] = useState('light');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentClinic, setCurrentClinic] = useState({
    id: null,
    name: '',
    settings: {}
  });
  
  // Language/locale settings
  const [locale, setLocale] = useState('en');
  
  // UI preferences
  const [uiPreferences, setUiPreferences] = useState({
    fontSize: 'medium',
    compactMode: false,
    animations: true,
    soundEnabled: true
  });

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  const updateClinicSettings = useCallback((newSettings) => {
    setCurrentClinic(prev => ({
      ...prev,
      settings: { ...prev.settings, ...newSettings }
    }));
  }, []);

  const updateUIPreferences = useCallback((updates) => {
    setUiPreferences(prev => ({ ...prev, ...updates }));
  }, []);

  const value = {
    // Theme
    theme,
    setTheme,
    toggleTheme,
    
    // Sidebar
    sidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebar,
    
    // Clinic
    currentClinic,
    setCurrentClinic,
    updateClinicSettings,
    
    // Locale
    locale,
    setLocale,
    
    // UI Preferences
    uiPreferences,
    updateUIPreferences
  };

  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
};

// HOC for class components
export const withUI = (Component) => {
  return (props) => {
    const uiContext = useUI();
    return <Component {...props} {...uiContext} />;
  };
};