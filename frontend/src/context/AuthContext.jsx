/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getProfile } from "../services/authApi";
import { setAccessToken, getAccessToken, resetAuthSession } from "../services/urlApi";
import axios from "axios";
import { API_BASE_URL } from '../services/apiConfig.js';

const AuthContext = createContext(null);
export const AuthProvider = ({ children }) => {
  const allowRefresh = useRef(true);
  const refreshPromise = useRef(null);
  const [token, setToken] = useState(() => getAccessToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState("");

  // A stored profile is never an authorization source. Load the current account from the API.
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        if (token) {
          const response = await getProfile(token);
          if (!cancelled && getAccessToken() === token) {
            setProfileError("");
            setUser(response.data?.data || null);
          }
        } else if (!getAccessToken() && allowRefresh.current) {
          if (!refreshPromise.current) refreshPromise.current = axios.post(API_BASE_URL + "/auth/refresh", {}, { withCredentials: true, timeout: 20000 });
          const response = await refreshPromise.current;
          if (!cancelled && !getAccessToken() && response.data?.data?.accessToken) {
            setAccessToken(response.data.data.accessToken);
            setToken(response.data.data.accessToken);
          }
        }
      } catch (error) {
        if (!cancelled && token && getAccessToken() === token) setProfileError("Unable to load your account. Check your connection and reload.");
        if (!cancelled && token && getAccessToken() === token && [401,403].includes(error.response?.status)) { setAccessToken(null); setToken(null); }
      } finally { if (!cancelled) setLoading(false); }
    };
    restore();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    const refreshed = event => { setAccessToken(event.detail); setToken(event.detail); };
    const failed = () => { allowRefresh.current = false; setUser(null); setAccessToken(null); setToken(null); };
    window.addEventListener("auth-refreshed", refreshed);
    window.addEventListener("auth-failed", failed);
    return () => { window.removeEventListener("auth-refreshed", refreshed); window.removeEventListener("auth-failed", failed); };
  }, []);

  const login = useCallback(newToken => { allowRefresh.current = false; setUser(null); setProfileError(""); setLoading(true); resetAuthSession(newToken); setToken(newToken); }, []);
  const logout = useCallback(async () => {
    // Clear local state before the network request, so old account data disappears immediately.
    allowRefresh.current = false;
    setUser(null); setToken(null); resetAuthSession(null);
    for (const key of ["pburls_user", "pburls_recent_links", "pburls_evaluator_session"]) localStorage.removeItem(key);
    try { await axios.post(API_BASE_URL + "/auth/logout", {}, { withCredentials: true, timeout: 20000 }); } catch { /* Local sign-out still completes if the server is unavailable. */ }
  }, []);
  const value = useMemo(() => ({ token, user, loading, profileError, login, logout, setUser }), [token, user, loading, profileError, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
export const useAuth = () => useContext(AuthContext);
