import { create } from 'zustand';
import type { Alert } from '../types';

const INITIAL_ALERTS: Alert[] = [];

interface AlertState {
  alerts: Alert[];
  unreadCount: number;
  setAlerts: (a: Alert[]) => void;
  markRead: (id: string) => void;
  addAlert: (a: Alert) => void;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: INITIAL_ALERTS,
  unreadCount: INITIAL_ALERTS.filter((a) => !a.read).length,

  setAlerts: (alerts) =>
    set({ alerts, unreadCount: alerts.filter((a) => !a.read).length }),

  markRead: (id) => {
    const alerts = get().alerts.map((a) =>
      a.id === id ? { ...a, read: true } : a
    );
    set({ alerts, unreadCount: alerts.filter((a) => !a.read).length });
  },

  addAlert: (alert) => {
    const alerts = [alert, ...get().alerts];
    set({ alerts, unreadCount: alerts.filter((a) => !a.read).length });
  },
}));
