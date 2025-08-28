import * as SecureStore from 'expo-secure-store';
import { AUTH_CONFIG } from '../../utils/constants';

interface SessionInfo {
  sessionId: string;
  userId: string;
  startTime: number;
  lastActivity: number;
  expiresAt: number;
}

class SessionManager {
  private static instance: SessionManager;
  private currentSession: SessionInfo | null = null;
  private sessionTimeoutTimer: NodeJS.Timeout | null = null;
  private readonly SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes
  private readonly SESSION_KEY = 'current_session';
  private sessionTimeoutCallbacks: (() => void)[] = [];

  private constructor() {}

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  async initializeSession(userId: string): Promise<string> {
    const sessionId = this.generateSessionId();
    const now = Date.now();
    
    this.currentSession = {
      sessionId,
      userId,
      startTime: now,
      lastActivity: now,
      expiresAt: now + this.SESSION_TIMEOUT
    };

    await SecureStore.setItemAsync(this.SESSION_KEY, JSON.stringify(this.currentSession));
    this.startSessionTimer();
    
    return sessionId;
  }

  async isSessionValid(): Promise<boolean> {
    if (!this.currentSession) {
      const storedSession = await SecureStore.getItemAsync(this.SESSION_KEY);
      if (storedSession) {
        this.currentSession = JSON.parse(storedSession);
      }
    }

    if (!this.currentSession) {
      return false;
    }

    const now = Date.now();
    if (now > this.currentSession.expiresAt) {
      await this.logout();
      return false;
    }

    return true;
  }

  async refreshSession(): Promise<void> {
    if (!this.currentSession) return;

    const now = Date.now();
    this.currentSession.lastActivity = now;
    this.currentSession.expiresAt = now + this.SESSION_TIMEOUT;

    await SecureStore.setItemAsync(this.SESSION_KEY, JSON.stringify(this.currentSession));
    this.resetSessionTimer();
  }

  async getSessionId(): Promise<string | null> {
    if (!this.currentSession) {
      const storedSession = await SecureStore.getItemAsync(this.SESSION_KEY);
      if (storedSession) {
        this.currentSession = JSON.parse(storedSession);
      }
    }
    return this.currentSession?.sessionId || null;
  }

  async getCurrentUserId(): Promise<string | null> {
    if (!this.currentSession) {
      const storedSession = await SecureStore.getItemAsync(this.SESSION_KEY);
      if (storedSession) {
        this.currentSession = JSON.parse(storedSession);
      }
    }
    return this.currentSession?.userId || null;
  }

  async logout(): Promise<void> {
    this.currentSession = null;
    await SecureStore.deleteItemAsync(this.SESSION_KEY);
    await SecureStore.deleteItemAsync(AUTH_CONFIG.TOKEN_KEY);
    await SecureStore.deleteItemAsync(AUTH_CONFIG.REFRESH_TOKEN_KEY);
    
    if (this.sessionTimeoutTimer) {
      clearTimeout(this.sessionTimeoutTimer);
      this.sessionTimeoutTimer = null;
    }

    // Notify all listeners
    this.sessionTimeoutCallbacks.forEach(callback => callback());
  }

  onSessionTimeout(callback: () => void): () => void {
    this.sessionTimeoutCallbacks.push(callback);
    // Return unsubscribe function
    return () => {
      const index = this.sessionTimeoutCallbacks.indexOf(callback);
      if (index > -1) {
        this.sessionTimeoutCallbacks.splice(index, 1);
      }
    };
  }

  private startSessionTimer(): void {
    this.resetSessionTimer();
  }

  private resetSessionTimer(): void {
    if (this.sessionTimeoutTimer) {
      clearTimeout(this.sessionTimeoutTimer);
    }

    this.sessionTimeoutTimer = setTimeout(async () => {
      await this.logout();
      this.sessionTimeoutCallbacks.forEach(callback => callback());
    }, this.SESSION_TIMEOUT);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const sessionManager = SessionManager.getInstance();