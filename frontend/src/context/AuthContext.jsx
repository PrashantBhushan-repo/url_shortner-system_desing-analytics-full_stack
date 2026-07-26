import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getProfile } from "../services/authApi";
import { setAccessToken, getAccessToken } from "../services/urlApi";
import axios from "axios";

const AUTH_USER_STORAGE_KEY = "snapurl_user";
const AUTH_TOKEN_STORAGE_KEY = "snapurl_access_token";

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

  useEffect(() => {
    const persistAuthState = () => {
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
    };

    persistAuthState();
  }, [token, user]);

  // Restore the session from storage or silently refresh it
  useEffect(() => {
    const bootstrap = async () => {
      const storedToken = getAccessToken();

      if (storedToken) {
        setAccessToken(storedToken);
        setToken(storedToken);

        try {
          const response = await getProfile(storedToken);
          const profile = response.data?.data || null;
          setUser(profile);
          setLoading(false);
          return;
        } catch (error) {
          setUser(null);
        }
      }

      try {
        const response = await axios.post(
          (import.meta.env.VITE_API_URL || "http://localhost:5000/api") + "/auth/refresh",
          {},
          { withCredentials: true }
        );
        const newAccessToken = response.data?.data?.accessToken;
        if (newAccessToken) {
          setAccessToken(newAccessToken);
          setToken(newAccessToken);
          try {
            const profileResponse = await getProfile(newAccessToken);
            setUser(profileResponse.data?.data || null);
          } catch (profileError) {
            setUser(null);
          }
        }
      } catch (error) {
        setAccessToken(null);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
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

  // Fetch profile when token changes
  useEffect(() => {
    const fetchUser = async () => {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const response = await getProfile(token);
        setUser(response.data?.data || null);
      } catch (error) {
        setAccessToken(null);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [token]);

  const login = (newToken) => {
    setAccessToken(newToken);
    setToken(newToken);
  };

  const logout = () => {
    setAccessToken(null);
    setToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({ token, user, loading, login, logout, setUser }), [token, user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
