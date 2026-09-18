import { create } from 'zustand';
import type { Payment } from '../types';

const MOCK_PAYMENTS: Payment[] = [
  { id: 'PAY-001', senderCompany: 'TechCorp SG', receiverCompany: 'FinServ UK', sourceCountry: 'Singapore', destinationCountry: 'UK', sourceChain: 'Base Sepolia', destinationChain: 'Polygon Amoy', amount: 250000, token: 'USDC', purpose: 'Treasury Transfer', urgency: 'High', status: 'settled', corridor: 'SG → UK', riskScore: 12, aiDecision: 'APPROVE', createdAt: '2025-04-27T09:00:00Z', updatedAt: '2025-04-27T09:05:00Z' },
  { id: 'PAY-002', senderCompany: 'GlobalPay Inc', receiverCompany: 'MerchantHub DE', sourceCountry: 'USA', destinationCountry: 'Germany', sourceChain: 'Polygon Amoy', destinationChain: 'Base Sepolia', amount: 180000, token: 'USDT', purpose: 'Supplier Payment', urgency: 'Medium', status: 'pending', corridor: 'US → DE', riskScore: 45, aiDecision: 'ESCALATE', createdAt: '2025-04-27T10:30:00Z', updatedAt: '2025-04-27T10:30:00Z' },
  { id: 'PAY-003', senderCompany: 'OilTrade UAE', receiverCompany: 'RefineryCo IN', sourceCountry: 'UAE', destinationCountry: 'India', sourceChain: 'Base Sepolia', destinationChain: 'Polygon Amoy', amount: 500000, token: 'USDC', purpose: 'Cross-border Settlement', urgency: 'Critical', status: 'review', corridor: 'AE → IN', riskScore: 72, aiDecision: 'ESCALATE', createdAt: '2025-04-27T11:15:00Z', updatedAt: '2025-04-27T11:20:00Z' },
  { id: 'PAY-004', senderCompany: 'NexaPay SG', receiverCompany: 'CloudServ US', sourceCountry: 'Singapore', destinationCountry: 'USA', sourceChain: 'Polygon Amoy', destinationChain: 'Base Sepolia', amount: 75000, token: 'USDC', purpose: 'Payroll', urgency: 'Low', status: 'approved', corridor: 'SG → US', riskScore: 8, aiDecision: 'APPROVE', createdAt: '2025-04-27T13:00:00Z', updatedAt: '2025-04-27T13:02:00Z' },
  { id: 'PAY-005', senderCompany: 'BlockFin UK', receiverCompany: 'DataMesh DE', sourceCountry: 'UK', destinationCountry: 'Germany', sourceChain: 'Base Sepolia', destinationChain: 'Polygon Amoy', amount: 320000, token: 'USDT', purpose: 'Supplier Payment', urgency: 'High', status: 'blocked', corridor: 'UK → DE', riskScore: 89, aiDecision: 'REJECT', createdAt: '2025-04-27T14:45:00Z', updatedAt: '2025-04-27T14:46:00Z' },
  { id: 'PAY-006', senderCompany: 'TradeFlow IN', receiverCompany: 'LogiCorp SG', sourceCountry: 'India', destinationCountry: 'Singapore', sourceChain: 'Polygon Amoy', destinationChain: 'Base Sepolia', amount: 92000, token: 'USDC', purpose: 'Treasury Transfer', urgency: 'Medium', status: 'settled', corridor: 'IN → SG', riskScore: 15, aiDecision: 'APPROVE', createdAt: '2025-04-26T08:00:00Z', updatedAt: '2025-04-26T08:04:00Z' },
];

interface PaymentState {
  payments: Payment[];
  selectedPayment: Payment | null;
  isLoading: boolean;
  setPayments: (p: Payment[]) => void;
  addPayment: (p: Payment) => void;
  setSelected: (p: Payment | null) => void;
  setLoading: (v: boolean) => void;
  updateStatus: (id: string, status: Payment['status']) => void;
}

export const usePaymentStore = create<PaymentState>((set, get) => ({
  payments: MOCK_PAYMENTS,
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
}));
