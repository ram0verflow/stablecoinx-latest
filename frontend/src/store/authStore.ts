import { create } from 'zustand';
import type { User } from '../types';
import { Session } from '@supabase/supabase-js';
import { setStoredToken, removeStoredAuth, getStoredToken } from '../lib/authStorage';
import { supabase } from '../lib/supabase';

interface AuthState {
  token: string | null;
  user: User | null;
  role: string | null;
  supabaseSession: Session | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User, role: string) => void;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  updatePreference: (preference: string) => void;
  setWallet: (address: string) => void;
  canApprove: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  role: null,
  supabaseSession: null,
  isAuthenticated: false,

  setAuth: (token, user, role) => {
    set({
      token,
      user,
      role,
      isAuthenticated: true,
    });
    setStoredToken(token);
    localStorage.setItem('auth_role', role);
    localStorage.setItem('auth_user', JSON.stringify(user));
  },

  logout: async () => {
    // Clear state immediately to prevent race conditions during async signOut
    set({
      token: null,
      user: null,
      role: null,
      supabaseSession: null,
      isAuthenticated: false,
    });
    
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('Supabase signout error:', error);
    }
    
    removeStoredAuth();
    localStorage.removeItem('auth_role');
    localStorage.removeItem('auth_user');
  },

  restoreSession: async () => {
    // First try to restore from persisted JWT (manual login path)
    const token = getStoredToken();
    const role = localStorage.getItem('auth_role');
    const userStr = localStorage.getItem('auth_user');

    if (token && role && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({
          token,
          role,
          user,
          supabaseSession: null,
          isAuthenticated: true,
        });
        // Also try to sync Supabase session in background (non-blocking)
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) set({ supabaseSession: session });
        });
        return;
      } catch (e) {
        // JSON parse failed — fall through to clear
      }
    }

    // No valid persisted session found — clear everything
    set({
      token: null,
      user: null,
      role: null,
      supabaseSession: null,
      isAuthenticated: false,
    });
    removeStoredAuth();
    localStorage.removeItem('auth_role');
    localStorage.removeItem('auth_user');
  },

  updatePreference: (preference) => {
    const user = get().user;
    if (user) {
      const updated = { ...user, aiPreference: preference };
      localStorage.setItem('auth_user', JSON.stringify(updated));
      set({ user: updated });
    }
  },

  setWallet: (address) => {
    const user = get().user;
    if (user) {
      const updated = { ...user, walletAddress: address };
      localStorage.setItem('auth_user', JSON.stringify(updated));
      set({ user: updated });
    }
  },

  canApprove: () => {
    const role = get().role?.toLowerCase().replace(/ /g, '_') || '';
    return ['admin', 'treasury_officer', 'reviewer'].includes(role);
  },
}));
