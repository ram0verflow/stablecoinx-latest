import { create } from 'zustand';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  setWallet: (address: string) => void;
  updatePreference: (preference: string) => void;
  canApprove: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: localStorage.getItem('sg_user')
    ? JSON.parse(localStorage.getItem('sg_user')!)
    : null,
  token: localStorage.getItem('sg_token'),
  isAuthenticated: !!localStorage.getItem('sg_token'),

  login: (user, token) => {
    localStorage.setItem('sg_token', token);
    localStorage.setItem('sg_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('sg_token');
    localStorage.removeItem('sg_user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  setWallet: (address) => {
    const user = get().user;
    if (user) {
      const updated = { ...user, walletAddress: address };
      localStorage.setItem('sg_user', JSON.stringify(updated));
      set({ user: updated });
    }
  },

  updatePreference: (preference) => {
    const user = get().user;
    if (user) {
      const updated = { ...user, aiPreference: preference };
      localStorage.setItem('sg_user', JSON.stringify(updated));
      set({ user: updated });
    }
  },

  canApprove: () => {
    const role = get().user?.role as string;
    if (!role) return false;
    const r = role.toLowerCase().replace(' ', '_');
    return r === 'admin' || r === 'treasury_officer';
  },
}));
