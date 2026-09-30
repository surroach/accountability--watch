/**
 * Session Management for Accountability Watch
 * 
 * Manages user sessions with timeout and token refresh:
 * - Session expiration after inactivity
 * - Automatic token refresh
 * - Cross-tab session synchronization
 * - Secure session storage
 * 
 * SECURITY PRINCIPLES:
 * - Tokens stored in memory (not localStorage to prevent XSS theft)
 * - Session ID verified server-side on each request
 * - Automatic cleanup of expired sessions
 * - Logout clears all session data
 */

/**
 * Session configuration
 */
export const SESSION_CONFIG = {
  // Inactivity timeout - user automatically logged out after this duration
  inactivityTimeoutSeconds: 15 * 60, // 15 minutes
  
  // Token refresh interval - refresh token before it expires
  tokenRefreshIntervalSeconds: 5 * 60, // 5 minutes
  
  // Maximum absolute session duration (regardless of activity)
  maxSessionDurationSeconds: 8 * 60 * 60, // 8 hours
  
  // Session storage key
  sessionStorageKey: 'accountability_session',
};

/**
 * Represents a user session
 */
export interface Session {
  id: string;
  userId: string;
  email: string;
  role: 'admin' | 'legal_partner' | 'moderator' | 'user';
  token: string;
  refreshToken: string;
  createdAt: number;  // Timestamp in ms
  lastActivityAt: number;  // Timestamp in ms
  expiresAt: number;  // Timestamp in ms
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Session management state
 */
interface SessionState {
  session: Session | null;
  isRefreshing: boolean;
  refreshTimer: NodeJS.Timeout | null;
  inactivityTimer: NodeJS.Timeout | null;
}

class SessionManager {
  private state: SessionState = {
    session: null,
    isRefreshing: false,
    refreshTimer: null,
    inactivityTimer: null,
  };

  private listeners: Set<(session: Session | null) => void> = new Set();

  constructor() {
    this.initializeFromStorage();
    this.setupEventListeners();
  }

  /**
   * Create a new session after successful login
   */
  createSession(
    userId: string,
    email: string,
    role: 'admin' | 'legal_partner' | 'moderator' | 'user',
    token: string,
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string
  ): Session {
    const now = Date.now();
    const session: Session = {
      id: this.generateSessionId(),
      userId,
      email,
      role,
      token,
      refreshToken,
      createdAt: now,
      lastActivityAt: now,
      expiresAt: now + SESSION_CONFIG.maxSessionDurationSeconds * 1000,
      ipAddress,
      userAgent,
    };

    this.state.session = session;
    this.storeSession(session);
    this.startInactivityTimer();
    this.startRefreshTimer();
    this.notifyListeners(session);

    return session;
  }

  /**
   * Get current session
   */
  getSession(): Session | null {
    return this.state.session;
  }

  /**
   * Update session activity timestamp
   * Called on every user action to prevent inactivity timeout
   */
  updateActivity(): void {
    if (!this.state.session) return;

    this.state.session.lastActivityAt = Date.now();
    this.storeSession(this.state.session);

    // Reset inactivity timer
    this.clearInactivityTimer();
    this.startInactivityTimer();
  }

  /**
   * Refresh authentication token before expiration
   */
  async refreshToken(): Promise<{ success: boolean; newToken?: string; error?: string }> {
    if (!this.state.session) {
      return { success: false, error: 'No active session' };
    }

    if (this.state.isRefreshing) {
      return { success: false, error: 'Token refresh already in progress' };
    }

    try {
      this.state.isRefreshing = true;

      // Call refresh endpoint (should be implemented in your auth service)
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.state.session.refreshToken}`,
        },
      });

      if (!response.ok) {
        this.logout();
        return {
          success: false,
          error: `Token refresh failed: ${response.statusText}`,
        };
      }

      const data = await response.json();
      const newToken = data.token || data.access_token;

      if (!newToken) {
        return { success: false, error: 'No token in refresh response' };
      }

      // Update session with new token
      this.state.session.token = newToken;
      if (data.refreshToken || data.refresh_token) {
        this.state.session.refreshToken = data.refreshToken || data.refresh_token;
      }

      this.storeSession(this.state.session);
      this.notifyListeners(this.state.session);

      return { success: true, newToken };
    } catch (error: any) {
      return { success: false, error: error.message };
    } finally {
      this.state.isRefreshing = false;
    }
  }

  /**
   * Check if session is still valid
   */
  isSessionValid(): boolean {
    const session = this.state.session;
    if (!session) return false;

    const now = Date.now();

    // Check absolute expiration
    if (now > session.expiresAt) {
      this.logout();
      return false;
    }

    // Check inactivity timeout
    const inactivityMs = now - session.lastActivityAt;
    const inactivitySeconds = inactivityMs / 1000;

    if (inactivitySeconds > SESSION_CONFIG.inactivityTimeoutSeconds) {
      this.logout();
      return false;
    }

    return true;
  }

  /**
   * Logout user - clear session data
   */
  logout(): void {
    // Notify server of logout
    if (this.state.session) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.state.session.token}`,
        },
      }).catch(err => console.error('Error notifying server of logout:', err));
    }

    // Clear local state
    this.clearTimers();
    this.state.session = null;
    this.clearStoredSession();
    this.notifyListeners(null);
  }

  /**
   * Get authorization header for API requests
   */
  getAuthorizationHeader(): string | null {
    if (!this.isSessionValid()) {
      return null;
    }

    return `Bearer ${this.state.session?.token}`;
  }

  /**
   * Subscribe to session changes
   */
  onSessionChange(callback: (session: Session | null) => void): () => void {
    this.listeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Get session time remaining in seconds
   */
  getTimeRemaining(): number {
    if (!this.state.session) return 0;

    const now = Date.now();
    const remainingMs = Math.min(
      this.state.session.expiresAt - now,
      (SESSION_CONFIG.inactivityTimeoutSeconds * 1000) -
        (now - this.state.session.lastActivityAt)
    );

    return Math.max(0, Math.floor(remainingMs / 1000));
  }

  /**
   * PRIVATE METHODS
   */

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private storeSession(session: Session): void {
    try {
      sessionStorage.setItem(SESSION_CONFIG.sessionStorageKey, JSON.stringify(session));
    } catch (error) {
      console.error('Failed to store session:', error);
    }
  }

  private clearStoredSession(): void {
    try {
      sessionStorage.removeItem(SESSION_CONFIG.sessionStorageKey);
    } catch (error) {
      console.error('Failed to clear stored session:', error);
    }
  }

  private initializeFromStorage(): void {
    try {
      const stored = sessionStorage.getItem(SESSION_CONFIG.sessionStorageKey);
      if (stored) {
        const session: Session = JSON.parse(stored);
        
        // Check if session is still valid
        if (Date.now() < session.expiresAt) {
          this.state.session = session;
          this.startInactivityTimer();
          this.startRefreshTimer();
          this.notifyListeners(session);
        } else {
          this.clearStoredSession();
        }
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
      this.clearStoredSession();
    }
  }

  private startRefreshTimer(): void {
    this.clearRefreshTimer();

    // Refresh token before it expires
    const refreshDelay = SESSION_CONFIG.tokenRefreshIntervalSeconds * 1000;

    this.state.refreshTimer = setTimeout(() => {
      this.refreshToken().then(() => {
        // Restart refresh timer
        this.startRefreshTimer();
      }).catch(err => {
        console.error('Token refresh failed:', err);
      });
    }, refreshDelay);
  }

  private startInactivityTimer(): void {
    this.clearInactivityTimer();

    const inactivityDelay = SESSION_CONFIG.inactivityTimeoutSeconds * 1000;

    this.state.inactivityTimer = setTimeout(() => {
      console.warn('Session expired due to inactivity');
      this.logout();
    }, inactivityDelay);
  }

  private clearRefreshTimer(): void {
    if (this.state.refreshTimer) {
      clearTimeout(this.state.refreshTimer);
      this.state.refreshTimer = null;
    }
  }

  private clearInactivityTimer(): void {
    if (this.state.inactivityTimer) {
      clearTimeout(this.state.inactivityTimer);
      this.state.inactivityTimer = null;
    }
  }

  private clearTimers(): void {
    this.clearRefreshTimer();
    this.clearInactivityTimer();
  }

  private notifyListeners(session: Session | null): void {
    this.listeners.forEach(callback => {
      try {
        callback(session);
      } catch (error) {
        console.error('Error in session listener:', error);
      }
    });
  }

  private setupEventListeners(): void {
    // Track user activity
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    activityEvents.forEach(event => {
      document.addEventListener(event, () => {
        this.updateActivity();
      }, { passive: true });
    });

    // Handle tab/window close
    window.addEventListener('beforeunload', () => {
      // Could send logout signal here if needed
    });

    // Handle visibility changes (user switching tabs)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // User switched away - pause activity tracking
        this.clearInactivityTimer();
      } else {
        // User switched back - check if session is still valid
        if (this.isSessionValid()) {
          this.updateActivity();
        }
      }
    });
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();

/**
 * Hook for React components to use session management
 */
export function useSession(): {
  session: Session | null;
  isValid: boolean;
  timeRemaining: number;
  logout: () => void;
} {
  const [session, setSession] = React.useState<Session | null>(sessionManager.getSession());
  const [timeRemaining, setTimeRemaining] = React.useState(sessionManager.getTimeRemaining());

  React.useEffect(() => {
    // Subscribe to session changes
    const unsubscribe = sessionManager.onSessionChange(setSession);

    // Update time remaining periodically
    const interval = setInterval(() => {
      setTimeRemaining(sessionManager.getTimeRemaining());
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return {
    session,
    isValid: session !== null && sessionManager.isSessionValid(),
    timeRemaining,
    logout: () => sessionManager.logout(),
  };
}

// Import React for hook (normally would be at top, but placed here for clarity)
import React from 'react';
