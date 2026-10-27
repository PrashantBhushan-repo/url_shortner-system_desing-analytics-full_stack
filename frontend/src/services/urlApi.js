import axios from "axios";
import { API_BASE_URL } from './apiConfig.js';

const ACCESS_TOKEN_STORAGE_KEY = "pburls_access_token";
let accessTokenInMemory = null;
let sessionEpoch = 0;

const readStoredAccessToken = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
};

export const setAccessToken = (token) => {
  accessTokenInMemory = token;

  if (typeof window !== "undefined") {
    if (token) {
      window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    }
  }
};

// Explicit login/logout starts a new account boundary. Old requests must never replay into it.
export const resetAuthSession = token => {
  sessionEpoch++;
  setAccessToken(token);
  processQueue(Object.assign(new Error("Account session changed"), { code: "ERR_CANCELED" }), null);
  isRefreshing = false;
};

export const getAccessToken = () => {
  if (accessTokenInMemory) {
    return accessTokenInMemory;
  }

  const storedToken = readStoredAccessToken();
  if (storedToken) {
    accessTokenInMemory = storedToken;
  }
  return accessTokenInMemory;
};

const API = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

API.interceptors.request.use((config) => {
  config.authEpoch ??= sessionEpoch;
  if (config.authEpoch !== sessionEpoch) return Promise.reject(Object.assign(new Error("Account session changed"), { code: "ERR_CANCELED" }));
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null, epoch = null) => {
  const pending = failedQueue;
  failedQueue = [];
  pending.forEach((prom) => {
    if (epoch !== null && prom.epoch !== epoch) { failedQueue.push(prom); return; }
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
};

API.interceptors.response.use(
  (response) => {
    if (response.config?.authEpoch !== sessionEpoch) return Promise.reject(Object.assign(new Error("Account session changed"), { code: "ERR_CANCELED" }));
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (originalRequest.authEpoch !== sessionEpoch) return Promise.reject(error);
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshEpoch = sessionEpoch;
      if (
        ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/auth/options', '/auth/verify-email', '/auth/verify-login-otp', '/auth/resend-otp', '/auth/forgot-password', '/auth/reset-password', '/auth/force-change-password'].includes(originalRequest.url)
      ) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, epoch: refreshEpoch });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return API(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(
          `${API.defaults.baseURL}/auth/refresh`,
          {},
          { withCredentials: true, timeout: 20000 }
        );
        if (refreshEpoch !== sessionEpoch) throw Object.assign(new Error("Account session changed"), { code: "ERR_CANCELED" });
        const newAccessToken = response.data?.data?.accessToken;
        if (!newAccessToken) throw new Error("No refreshed access token returned");

        setAccessToken(newAccessToken);
        window.dispatchEvent(new CustomEvent("auth-refreshed", { detail: newAccessToken }));

        processQueue(null, newAccessToken, refreshEpoch);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return API(originalRequest);
      } catch (refreshError) {
        if (refreshEpoch === sessionEpoch) { setAccessToken(null); window.dispatchEvent(new CustomEvent("auth-failed")); }
        processQueue(refreshError, null, refreshEpoch);
        return Promise.reject(refreshError);
      } finally {
        if (refreshEpoch === sessionEpoch) isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default API;
