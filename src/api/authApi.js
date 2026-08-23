import api from './axiosInstance';
import { clearToken, writeToken } from './tokenStore';

// In cookie mode the server sends no `token` and these calls are no-ops; in
// token mode they are what keeps the session across a reload.
export async function register(payload) {
  const { data } = await api.post('/auth/register', payload);
  writeToken(data.token);
  return data.user;
}

export async function login(payload) {
  const { data } = await api.post('/auth/login', payload);
  writeToken(data.token);
  return data.user;
}

export async function logout() {
  try {
    await api.post('/auth/logout');
  } finally {
    // Drop the local token even if the request failed — otherwise a network
    // blip would leave the browser still holding a usable session.
    clearToken();
  }
}

export async function fetchMe() {
  const { data } = await api.get('/auth/me');
  return data.user;
}
