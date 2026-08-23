import axios from 'axios';
import { clearToken, readToken, usesToken } from './tokenStore';

// withCredentials is what lets the httpOnly auth cookie ride along on XHR. It
// is harmless in token mode, and leaving it on means switching VITE_AUTH_MODE
// is the only change needed to move back to cookies.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5050/api',
  withCredentials: true,
});

// In token mode the session is a Bearer header instead of a cookie. Read per
// request rather than at module load, so a fresh login applies immediately.
if (usesToken) {
  api.interceptors.request.use((config) => {
    const token = readToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  // A 401 means the stored token is expired or was signed with a different
  // secret. Drop it, or every later request keeps sending the same dead token.
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error?.response?.status === 401) clearToken();
      return Promise.reject(error);
    }
  );
}

export function apiErrorMessage(err, fallback = 'Something went wrong') {
  return err?.response?.data?.message || err?.message || fallback;
}

export default api;
