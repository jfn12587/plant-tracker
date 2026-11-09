import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { CONFIG, getClientSecret } from '../config.js';

const REFRESH_TOKEN_KEY = 'vera-pwa-refresh-token';
const USER_STORAGE_KEY = 'vera-pwa-user';
const OAUTH_STATE_KEY = 'vera-pwa-oauth-state';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

// Must match an "Authorized redirect URI" on the OAuth client exactly.
// BASE_URL is Vite's configured base ('/plant-tracker/'), so this resolves to
// https://jfn12587.github.io/plant-tracker/ in production and
// http://localhost:5173/plant-tracker/ in dev.
function getRedirectUri() {
  return window.location.origin + import.meta.env.BASE_URL;
}

function hasOAuthReturn() {
  const params = new URLSearchParams(window.location.search);
  return params.has('code') || params.has('error');
}

function newStateToken() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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
      return hasOAuthReturn() || !!localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return false;
    }
  });

  const refreshTimerRef = useRef(null);
  const bootstrappedRef = useRef(false);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  // Exchange authorization code for tokens
  const exchangeCodeForTokens = async (code) => {
    const secret = getClientSecret();
    if (!secret) {
      throw new Error('No app secret is saved on this device.');
    }

    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CONFIG.OAUTH_CLIENT_ID,
        client_secret: secret,
        redirect_uri: getRedirectUri(),
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
      const res = await fetch(TOKEN_ENDPOINT, {
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

  // On mount: either finish a redirect sign-in, or restore the previous
  // session from the stored refresh token.
  useEffect(() => {
    if (!bootstrappedRef.current) {
      bootstrappedRef.current = true;

      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const oauthError = params.get('error');
      const returnedState = params.get('state');

      if (code || oauthError) {
        let expectedState = null;
        try {
          expectedState = localStorage.getItem(OAUTH_STATE_KEY);
          localStorage.removeItem(OAUTH_STATE_KEY);
        } catch {
          // storage unavailable; handled as a state mismatch below
        }

        // Strip the query string immediately. Authorization codes are
        // single-use, so a reload must not try to replay a spent one.
        history.replaceState({}, '', getRedirectUri());

        if (oauthError) {
          setAuthError(
            oauthError === 'access_denied'
              ? 'Google sign-in was cancelled or declined.'
              : `Google sign-in failed: ${oauthError}`
          );
          setIsRefreshing(false);
        } else if (!expectedState || returnedState !== expectedState) {
          setAuthError(
            'Sign-in could not be verified (state did not match). Please try signing in again.'
          );
          setIsRefreshing(false);
        } else {
          setIsRefreshing(true);
          exchangeCodeForTokens(code)
            .then(async (tokens) => {
              setAccessToken(tokens.access_token);
              if (tokens.refresh_token) {
                localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
              }
              scheduleRefresh(tokens.expires_in);
              await fetchUserInfo(tokens.access_token);
            })
            .catch((err) => {
              console.error('Auth code exchange failed:', err);
              setAuthError(err.message);
            })
            .finally(() => setIsRefreshing(false));
        }
      } else if (localStorage.getItem(REFRESH_TOKEN_KEY)) {
        setIsRefreshing(true);
        refreshAccessToken().then((token) => {
          if (token) {
            fetchUserInfo(token);
          }
        });
      }
    }

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [refreshAccessToken]);

  // Full-page redirect to Google. No popup, so nothing for a popup blocker to
  // block and no dependency on the Google JS library having loaded.
  const signIn = useCallback(() => {
    setAuthError(null);

    const state = newStateToken();
    try {
      localStorage.setItem(OAUTH_STATE_KEY, state);
    } catch {
      setAuthError('Sign-in needs browser storage, which appears to be blocked.');
      return;
    }

    const params = new URLSearchParams({
      client_id: CONFIG.OAUTH_CLIENT_ID,
      redirect_uri: getRedirectUri(),
      response_type: 'code',
      scope: CONFIG.SCOPES,
      // Required to get a refresh token; 'consent' makes Google reissue one
      // on every sign-in rather than only the very first authorization.
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });

    window.location.assign(`${AUTH_ENDPOINT}?${params.toString()}`);
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
    localStorage.removeItem(OAUTH_STATE_KEY);
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
