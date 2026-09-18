import { create } from 'zustand';
import type { Alert } from '../types';

const MOCK_ALERTS: Alert[] = [
  { id: 'ALT-001', type: 'approved', paymentId: 'PAY-001', message: 'Payment PAY-001 (SG → UK) settled successfully via Base Sepolia. All 24 compliance layers passed.', timestamp: '2025-04-27T09:05:00Z', read: true },
  { id: 'ALT-002', type: 'blocked', paymentId: 'PAY-005', message: 'Payment PAY-005 (UK → DE) blocked by Compliance Engine. Wallet risk score 89 exceeds threshold of 70.', timestamp: '2025-04-27T14:46:00Z', read: false },
  { id: 'ALT-003', type: 'review', paymentId: 'PAY-003', message: 'Payment PAY-003 (AE → IN) requires manual review. AI Decision Engine recommends escalation due to high-value cross-border transfer.', timestamp: '2025-04-27T11:20:00Z', read: false },
  { id: 'ALT-004', type: 'approved', paymentId: 'PAY-004', message: 'Payment PAY-004 (SG → US) approved automatically. Low risk score of 8 within acceptable range.', timestamp: '2025-04-27T13:02:00Z', read: true },
  { id: 'ALT-005', type: 'revalidation', paymentId: 'PAY-006', message: 'Historical revalidation triggered for PAY-006 (IN → SG). Updated sanctions list requires re-evaluation.', timestamp: '2025-04-27T15:00:00Z', read: false },
  { id: 'ALT-006', type: 'review', paymentId: 'PAY-002', message: 'Payment PAY-002 (US → DE) pending treasury officer approval. Amount $180,000 exceeds auto-approval threshold.', timestamp: '2025-04-27T10:35:00Z', read: false },
];

interface AlertState {
  alerts: Alert[];
  unreadCount: number;
  setAlerts: (a: Alert[]) => void;
  markRead: (id: string) => void;
  addAlert: (a: Alert) => void;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: MOCK_ALERTS,
  unreadCount: MOCK_ALERTS.filter((a) => !a.read).length,

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
