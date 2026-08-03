import { useState, useEffect, useCallback } from 'preact/hooks';
import { CONFIG } from '../config.js';

const USER_STORAGE_KEY = 'vera-pwa-user';

export function useGoogleAuth() {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem(USER_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [tokenClient, setTokenClient] = useState(null);
  const [initializing, setInitializing] = useState(true);

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
            fetchUserInfo(response.access_token);
          }
          setInitializing(false);
        },
        error_callback: () => {
          setInitializing(false);
        },
      });
      setTokenClient(client);

      // Attempt silent re-auth if user was previously signed in
      if (sessionStorage.getItem(USER_STORAGE_KEY)) {
        client.requestAccessToken({ prompt: '' });
      } else {
        setInitializing(false);
      }
    };

    initGis();
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
  }, [accessToken]);

  const caretaker = user?.email ? (CONFIG.CARETAKER_MAP[user.email] || user.name) : null;

  return {
    isSignedIn: !!accessToken,
    isInitializing: initializing,
    accessToken,
    user,
    caretaker,
    signIn,
    signOut,
  };
}
