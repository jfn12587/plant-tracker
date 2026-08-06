import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { CONFIG, getClientSecret } from '../config.js';

const REFRESH_TOKEN_KEY = 'vera-pwa-refresh-token';
const USER_STORAGE_KEY = 'vera-pwa-user';

export function useGoogleAuth() {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(USER_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isRefreshing, setIsRefreshing] = useState(() => {
    try {
      return !!localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return false;
    }
  });

  const refreshTimerRef = useRef(null);

  // Exchange authorization code for tokens
  const exchangeCodeForTokens = async (code) => {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CONFIG.OAUTH_CLIENT_ID,
        client_secret: getClientSecret(),
        redirect_uri: 'postmessage',
        grant_type: 'authorization_code',
      }),
    });

    if (!res.ok) {
      throw new Error('Token exchange failed');
    }

    return res.json();
  };

  // Refresh access token using stored refresh token
  const refreshAccessToken = useCallback(async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      setIsRefreshing(false);
      return null;
    }

    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: CONFIG.OAUTH_CLIENT_ID,
          client_secret: getClientSecret(),
          grant_type: 'refresh_token',
        }),
      });

      if (!res.ok) {
        // Refresh token revoked or invalid — clear everything
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
        setAccessToken(null);
        setUser(null);
        setIsRefreshing(false);
        return null;
      }

      const data = await res.json();
      setAccessToken(data.access_token);
      setIsRefreshing(false);
      scheduleRefresh(data.expires_in);
      return data.access_token;
    } catch {
      // Network error — keep refresh token but clear access token
      setIsRefreshing(false);
      return null;
    }
  }, []);

  // Schedule auto-refresh before token expires
  const scheduleRefresh = (expiresIn) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    // Refresh 60 seconds before expiry
    const refreshDelay = (expiresIn - 60) * 1000;
    if (refreshDelay > 0) {
      refreshTimerRef.current = setTimeout(() => {
        refreshAccessToken();
      }, refreshDelay);
    }
  };

  // On mount: attempt to refresh if we have a stored refresh token
  useEffect(() => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      setIsRefreshing(true);
      refreshAccessToken().then((token) => {
        if (token) {
          fetchUserInfo(token);
        }
      });
    }

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [refreshAccessToken]);

  const fetchUserInfo = async (token) => {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const info = await res.json();
      const userData = {
        email: info.email,
        name: info.name,
        picture: info.picture,
      };
      setUser(userData);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
    }
  };

  const signIn = useCallback(() => {
    const initAndRequest = () => {
      if (!window.google?.accounts?.oauth2) {
        setTimeout(initAndRequest, 100);
        return;
      }

      const codeClient = window.google.accounts.oauth2.initCodeClient({
        client_id: CONFIG.OAUTH_CLIENT_ID,
        scope: CONFIG.SCOPES,
        ux_mode: 'popup',
        callback: async (response) => {
          if (response.code) {
            try {
              const tokens = await exchangeCodeForTokens(response.code);
              setAccessToken(tokens.access_token);

              if (tokens.refresh_token) {
                localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
              }

              scheduleRefresh(tokens.expires_in);
              fetchUserInfo(tokens.access_token);
            } catch (err) {
              console.error('Auth code exchange failed:', err);
            }
          }
        },
      });

      codeClient.requestCode();
    };

    initAndRequest();
  }, []);

  const signOut = useCallback(async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

    // Revoke the refresh token
    if (refreshToken) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${refreshToken}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
      } catch {
        // Best-effort revocation
      }
    }

    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    setAccessToken(null);
    setUser(null);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    // Clean up old key if it exists
    localStorage.removeItem('vera-pwa-token');
  }, []);

  const caretaker = user?.email ? (CONFIG.CARETAKER_MAP[user.email] || user.name) : null;

  return {
    isSignedIn: !!accessToken && !!user,
    isRefreshing,
    accessToken,
    user,
    caretaker,
    signIn,
    signOut,
  };
}
