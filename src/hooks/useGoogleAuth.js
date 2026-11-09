import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { CONFIG, getClientSecret } from '../config.js';

const REFRESH_TOKEN_KEY = 'vera-pwa-refresh-token';
const USER_STORAGE_KEY = 'vera-pwa-user';

// Pull Google's actual error text out of a failed OAuth/API response so the UI
// can show something more useful than "it didn't work".
async function describeFailure(res, label) {
  let detail = '';
  try {
    const body = await res.json();
    detail = body.error_description || body.error?.message || body.error || '';
    if (typeof detail === 'object') detail = JSON.stringify(detail);
  } catch {
    try {
      detail = (await res.text()).slice(0, 200);
    } catch {
      detail = '';
    }
  }
  return `${label} failed (HTTP ${res.status})${detail ? `: ${detail}` : ''}`;
}

export function useGoogleAuth() {
  const [accessToken, setAccessToken] = useState(null);
  const [authError, setAuthError] = useState(null);
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

  const clearAuthError = useCallback(() => setAuthError(null), []);

  // Exchange authorization code for tokens
  const exchangeCodeForTokens = async (code) => {
    const secret = getClientSecret();
    if (!secret) {
      throw new Error('No app secret is saved on this device.');
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CONFIG.OAUTH_CLIENT_ID,
        client_secret: secret,
        redirect_uri: 'postmessage',
        grant_type: 'authorization_code',
      }),
    });

    if (!res.ok) {
      throw new Error(await describeFailure(res, 'Token exchange'));
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

    const secret = getClientSecret();
    if (!secret) {
      setAuthError('No app secret is saved on this device.');
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
          client_secret: secret,
          grant_type: 'refresh_token',
        }),
      });

      if (!res.ok) {
        // Refresh token revoked or invalid — clear everything
        const message = await describeFailure(res, 'Session refresh');
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
        setAccessToken(null);
        setUser(null);
        setAuthError(`${message} — please sign in again.`);
        setIsRefreshing(false);
        return null;
      }

      const data = await res.json();
      setAccessToken(data.access_token);
      setAuthError(null);
      setIsRefreshing(false);
      scheduleRefresh(data.expires_in);
      return data.access_token;
    } catch (err) {
      // Network error — keep refresh token but clear access token
      setAuthError(`Could not reach Google to restore your session: ${err.message}`);
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
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        // Without profile info the app can't finish signing in, so say so
        // instead of silently returning to the sign-in screen.
        setAuthError(
          `${await describeFailure(res, 'Reading your Google profile')} — the sign-in may not have granted the "email" and "profile" permissions.`
        );
        return;
      }

      const info = await res.json();
      const userData = {
        email: info.email,
        name: info.name,
        picture: info.picture,
      };
      setUser(userData);
      setAuthError(null);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
    } catch (err) {
      setAuthError(`Could not read your Google profile: ${err.message}`);
    }
  };

  const signIn = useCallback(() => {
    setAuthError(null);

    let waited = 0;
    const initAndRequest = () => {
      if (!window.google?.accounts?.oauth2) {
        waited += 100;
        if (waited > 10000) {
          setAuthError(
            "Google's sign-in library never loaded. Check your connection, or whether an ad/content blocker is blocking accounts.google.com."
          );
          return;
        }
        setTimeout(initAndRequest, 100);
        return;
      }

      const codeClient = window.google.accounts.oauth2.initCodeClient({
        client_id: CONFIG.OAUTH_CLIENT_ID,
        scope: CONFIG.SCOPES,
        ux_mode: 'popup',
        error_callback: (err) => {
          setAuthError(
            `Google sign-in was not completed: ${err?.type || 'unknown error'}${err?.message ? ` (${err.message})` : ''}`
          );
        },
        callback: async (response) => {
          if (response.error) {
            setAuthError(
              `Google sign-in returned an error: ${response.error}${response.error_description ? ` (${response.error_description})` : ''}`
            );
            return;
          }

          if (!response.code) {
            setAuthError('Google sign-in did not return an authorization code.');
            return;
          }

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
            setAuthError(err.message);
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
    setAuthError(null);
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
    authError,
    clearAuthError,
    user,
    caretaker,
    signIn,
    signOut,
  };
}
