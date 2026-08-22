import { create } from 'zustand';
import * as authApi from '../api/authApi';

export const useAuthStore = create((set) => ({
  user: null,
  // 'loading' until the initial /auth/me round-trip settles, so ProtectedRoute
  // doesn't bounce a logged-in user to /login on a hard refresh.
  status: 'loading',

  async bootstrap() {
    try {
      const user = await authApi.fetchMe();
      set({ user, status: 'ready' });
    } catch {
      set({ user: null, status: 'ready' });
    }
  },

  async login(credentials) {
    const user = await authApi.login(credentials);
    set({ user, status: 'ready' });
    return user;
  },

  async register(payload) {
    const user = await authApi.register(payload);
    set({ user, status: 'ready' });
    return user;
  },

  async logout() {
    try {
      await authApi.logout();
    } finally {
      set({ user: null, status: 'ready' });
    }
  },
}));
