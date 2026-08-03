import { useState, useEffect, useCallback } from 'preact/hooks';
import { CONFIG } from '../config.js';

const USER_STORAGE_KEY = 'vera-pwa-user';
const TOKEN_STORAGE_KEY = 'vera-pwa-token';

export function useGoogleAuth() {
  const [accessToken, setAccessToken] = useState(() => {
    try {
      return sessionStorage.getItem(TOKEN_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });
  const [user, setUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem(USER_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [tokenClient, setTokenClient] = useState(null);

  useEffect(() => {
    const initGis = () => {
      if (!window.google?.accounts?.oauth2) {
        setTimeout(initGis, 100);
        return;
      }

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.OAUTH_CLIENT_ID,
        scope: CONFIG.SCOPES,
        callback: (response) => {
          if (response.access_token) {
            setAccessToken(response.access_token);
            sessionStorage.setItem(TOKEN_STORAGE_KEY, response.access_token);
            fetchUserInfo(response.access_token);
          }
        },
      });
      setTokenClient(client);
    };

    initGis();
  }, []);

  // Validate stored token on load
  useEffect(() => {
    if (accessToken && !user) {
      fetchUserInfo(accessToken);
    } else if (accessToken && user) {
      // Verify token is still valid
      fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((res) => {
        if (!res.ok) {
          // Token expired, clear it
          setAccessToken(null);
          sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      });
    }
  }, []);

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
      sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
    } else {
      // Token invalid
      setAccessToken(null);
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  };

  const signIn = useCallback(() => {
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    }
  }, [tokenClient]);

  const signOut = useCallback(() => {
    if (accessToken) {
      window.google.accounts.oauth2.revoke(accessToken);
    }
    setAccessToken(null);
    setUser(null);
    sessionStorage.removeItem(USER_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  }, [accessToken]);

  const caretaker = user?.email ? (CONFIG.CARETAKER_MAP[user.email] || user.name) : null;

  return {
    isSignedIn: !!accessToken && !!user,
    accessToken,
    user,
    caretaker,
    signIn,
    signOut,
  };
}
