import api from './axiosInstance';

export async function register(payload) {
  const { data } = await api.post('/auth/register', payload);
  return data.user;
}

export async function login(payload) {
  const { data } = await api.post('/auth/login', payload);
  return data.user;
}

export async function logout() {
  await api.post('/auth/logout');
}

export async function fetchMe() {
  const { data } = await api.get('/auth/me');
  return data.user;
}
