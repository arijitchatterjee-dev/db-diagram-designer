import axios from 'axios';

// withCredentials is mandatory here — the auth token lives in an httpOnly
// cookie, so without it every request would arrive at the API unauthenticated.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5050/api',
  withCredentials: true,
});

export function apiErrorMessage(err, fallback = 'Something went wrong') {
  return err?.response?.data?.message || err?.message || fallback;
}

export default api;
