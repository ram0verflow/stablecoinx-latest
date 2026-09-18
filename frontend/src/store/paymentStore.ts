import { create } from 'zustand';
import type { Payment } from '../types';
import { paymentApi } from '../lib/api';

export function transformPayment(raw: any): Payment {
  return {
    id: raw.id,
    senderCompany: raw.sender_company,
    receiverCompany: raw.receiver_company,
    sourceCountry: raw.source_country,
    destinationCountry: raw.destination_country,
    sourceChain: raw.source_chain,
    destinationChain: raw.destination_chain,
    amount: raw.amount,
    token: raw.token,
    purpose: raw.purpose,
    urgency: raw.urgency,
    status: raw.status,
    corridor: `${raw.source_country} -> ${raw.destination_country}`,
    riskScore: raw.risk_score ?? 0,
    aiDecision: raw.ai_decision ?? 'N/A',
    senderWallet: raw.sender_wallet,
    receiverWallet: raw.receiver_wallet,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

interface PaymentState {
  payments: Payment[];
  selectedPayment: Payment | null;
  isLoading: boolean;
  setPayments: (p: Payment[]) => void;
  addPayment: (p: Payment) => void;
  setSelected: (p: Payment | null) => void;
  setLoading: (v: boolean) => void;
  updateStatus: (id: string, status: Payment['status']) => void;
  fetchPayments: () => Promise<void>;
}

export const usePaymentStore = create<PaymentState>((set, get) => ({
  payments: [],
  selectedPayment: null,
  isLoading: false,

  setPayments: (payments) => set({ payments }),
  addPayment: (p) => set({ payments: [p, ...get().payments] }),
  setSelected: (selectedPayment) => set({ selectedPayment }),
  setLoading: (isLoading) => set({ isLoading }),
  updateStatus: (id, status) =>
    set({
      payments: get().payments.map((p) =>
        p.id === id ? { ...p, status, updatedAt: new Date().toISOString() } : p
      ),
    }),
  fetchPayments: async () => {
    set({ isLoading: true });
    try {
      const { data } = await paymentApi.list();
      set({ payments: (data || []).map(transformPayment) });
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    } finally {
      set({ isLoading: false });
    }
  },
}));
