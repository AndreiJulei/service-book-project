/**
 * Centralized authentication service using JWT tokens.
 * Handles login, registration, token management, and inactivity logout.
 */

const API_BASE = '/api';

interface LoginResponse {
  user: {
    id: number;
    username: string;
    email: string;
    roles: string[];
  };
  access_token: string;
  refresh_token: string;
}

interface JWTPayload {
  user_id: number;
  username: string;
  roles: string[];
  exp: number;
  iat: number;
  type: string;
}

class AuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes
  private onLogoutCallback: (() => void) | null = null;

  constructor() {
    // Restore tokens from localStorage on page load
    this.accessToken = localStorage.getItem('sb_access_token');
    this.refreshToken = localStorage.getItem('sb_refresh_token');
    
    if (this.accessToken) {
      this.startInactivityTimer();
      this.scheduleTokenRefresh();
    }
  }

  /**
   * Register a callback to be called when the user is logged out (e.g., for navigation).
   */
  onLogout(callback: () => void) {
    this.onLogoutCallback = callback;
  }

  /**
   * Log in with username/email and password. Returns the login response with tokens.
   */
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Invalid credentials');
    }
    const data: LoginResponse = await res.json();

    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    localStorage.setItem('sb_access_token', data.access_token);
    localStorage.setItem('sb_refresh_token', data.refresh_token);

    this.startInactivityTimer();
    this.scheduleTokenRefresh();

    return data;
  }

  /**
   * Register a new user account.
   */
  async register(username: string, email: string, password: string, role: string = 'client'): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, role }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Registration failed');
    }
    // Auto-login after registration
    return this.login(username, password);
  }

  /**
   * Log out — clear all tokens and timers.
   */
  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });
    } catch {
      // Ignore network errors on logout
    }
    this.clearSession();
  }

  /**
   * Refresh the access token using the refresh token.
   */
  async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });
      if (!res.ok) {
        this.clearSession();
        return false;
      }
      const data = await res.json();
      this.accessToken = data.access_token;
      localStorage.setItem('sb_access_token', data.access_token);
      this.scheduleTokenRefresh();
      return true;
    } catch {
      this.clearSession();
      return false;
    }
  }

  /**
   * Get the Authorization headers for API calls.
   */
  getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    return headers;
  }

  /**
   * Get the current user info by decoding the JWT locally (no API call).
   */
  getCurrentUser(): JWTPayload | null {
    if (!this.accessToken) return null;
    try {
      const parts = this.accessToken.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1]));
      // Check if token is expired
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        return null;
      }
      return payload as JWTPayload;
    } catch {
      return null;
    }
  }

  /**
   * Fetch the current user from the API (for full user data including email).
   */
  async fetchCurrentUser(): Promise<any> {
    if (!this.accessToken) return null;
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: this.getAuthHeaders(),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Check if a user is currently authenticated.
   */
  isAuthenticated(): boolean {
    const user = this.getCurrentUser();
    return user !== null;
  }

  /**
   * Check if the current user has a specific role.
   */
  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return user ? user.roles.includes(role) : false;
  }

  /**
   * Get the current access token (for WebSocket auth, etc.).
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  // --- Inactivity Timer ---

  startInactivityTimer() {
    this.stopInactivityTimer();
    // Listen for user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    const resetHandler = () => this.resetInactivityTimer();
    events.forEach(event => document.addEventListener(event, resetHandler, { passive: true }));
    // Store the handler and events for cleanup
    (this as any)._activityHandler = resetHandler;
    (this as any)._activityEvents = events;
    this.resetInactivityTimer();
  }

  resetInactivityTimer() {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    this.inactivityTimer = setTimeout(() => {
      console.warn('Session expired due to inactivity');
      this.clearSession();
    }, this.INACTIVITY_TIMEOUT);
  }

  stopInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    // Remove event listeners
    const handler = (this as any)._activityHandler;
    const events = (this as any)._activityEvents;
    if (handler && events) {
      events.forEach((event: string) => document.removeEventListener(event, handler));
    }
  }

  // --- Token Refresh Scheduling ---

  private scheduleTokenRefresh() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    const user = this.getCurrentUser();
    if (!user || !user.exp) return;

    // Refresh 60 seconds before expiry
    const msUntilExpiry = user.exp * 1000 - Date.now() - 60000;
    if (msUntilExpiry <= 0) {
      // Token is about to expire or already expired
      this.refreshAccessToken();
      return;
    }
    this.refreshTimer = setTimeout(() => this.refreshAccessToken(), msUntilExpiry);
  }

  private clearSession() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('sb_access_token');
    localStorage.removeItem('sb_refresh_token');
    this.stopInactivityTimer();
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.onLogoutCallback) {
      this.onLogoutCallback();
    }
  }
}

// Singleton instance
export const authService = new AuthService();
export type { LoginResponse, JWTPayload };
