/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getProfile } from "../services/authApi";
import { setAccessToken, getAccessToken } from "../services/urlApi";
import axios from "axios";

const AUTH_USER_STORAGE_KEY = "pburls_user";
const AUTH_TOKEN_STORAGE_KEY = "pburls_access_token";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  });

  const [user, setUser] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      return JSON.parse(window.localStorage.getItem(AUTH_USER_STORAGE_KEY) || "null");
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);

  // Sync state changes to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (token) {
      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }

    if (user) {
      window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    }
  }, [token, user]);

  // Restore the session on initial app mount
  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      const storedToken = getAccessToken();

      if (storedToken) {
        setAccessToken(storedToken);
        if (isMounted) setToken(storedToken);

        try {
          const response = await getProfile(storedToken);
          if (isMounted) {
            setUser(response.data?.data || null);
            setLoading(false);
          }
          return;
        } catch {
          if (isMounted) {
            setUser(null);
            setToken(null);
            setAccessToken(null);
          }
        }
      }

      // Try silent refresh using HTTP-only cookie if no access token
      try {
        const response = await axios.post(
          (import.meta.env.VITE_API_URL || "http://localhost:5000/api") + "/auth/refresh",
          {},
          { withCredentials: true }
        );
        const newAccessToken = response.data?.data?.accessToken;
        if (newAccessToken && isMounted) {
          setAccessToken(newAccessToken);
          setToken(newAccessToken);
          try {
            const profileResponse = await getProfile(newAccessToken);
            if (isMounted) setUser(profileResponse.data?.data || null);
          } catch {
            if (isMounted) setUser(null);
          }
        }
      } catch {
        if (isMounted) {
          setAccessToken(null);
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  // Synchronize token updates from Axios interceptors
  useEffect(() => {
    const handleRefreshed = (e) => {
      const refreshedToken = e.detail;
      setToken(refreshedToken);
      setAccessToken(refreshedToken);
    };

    const handleFailed = () => {
      setAccessToken(null);
      setToken(null);
      setUser(null);
    };

    window.addEventListener("auth-refreshed", handleRefreshed);
    window.addEventListener("auth-failed", handleFailed);

    return () => {
      window.removeEventListener("auth-refreshed", handleRefreshed);
      window.removeEventListener("auth-failed", handleFailed);
    };
  }, []);

  const login = (newToken) => {
    setAccessToken(newToken);
    setToken(newToken);
  };

  const logout = async () => {
    try {
      await axios.post(
        (import.meta.env.VITE_API_URL || "http://localhost:5000/api") + "/auth/logout",
        {},
        { withCredentials: true }
      );
    } catch (_) {
      // Ignore network errors on logout
    }

    setAccessToken(null);
    setToken(null);
    setUser(null);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      window.localStorage.removeItem("pburls_evaluator_session");
      window.localStorage.removeItem("pburls_recent_links");
    }
  };

  const value = useMemo(
    () => ({ token, user, loading, login, logout, setUser }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
