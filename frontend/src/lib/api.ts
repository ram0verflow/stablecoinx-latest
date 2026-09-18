import axios from 'axios';
import type {
  AuthResponse,
  CreatePaymentRequest,
  Payment,
  RouteAnalysis,
  Alert,
  MonitoringStats,
  ObfuscationAnalyzeResult,
  ObfuscationValidationSnapshot,
} from '../types';
import { getStoredToken, removeStoredAuth } from './authStorage'; // FIXED: A5
import { useAuthStore } from '../store/authStore'; // FIXED: A5 — clear Zustand on 401

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
if (!import.meta.env.VITE_API_BASE_URL && !import.meta.env.VITE_BACKEND_URL) {
  console.error('Missing VITE_API_BASE_URL (or VITE_BACKEND_URL) environment variable');
}

const api = axios.create({
  baseURL: `${API_BASE}/api/v1`, // FIXED: PHASE5
  headers: { 'Content-Type': 'application/json' }, // FIXED: PHASE5
});

api.interceptors.request.use((config) => {
  const token = getStoredToken(); // FIXED: A5
  if (token) {
    config.headers.Authorization = `Bearer ${token}`; // FIXED: A5
  }
  return config; // FIXED: A5
});

api.interceptors.response.use(
  (res) => res, // FIXED: A5
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout(); // FIXED: A5 — clears Supabase + persisted JWT/user
      window.location.href = '/login'; // FIXED: A5
    }
    return Promise.reject(err); // FIXED: A5
  },
); // FIXED: A5

export const healthApi = {
  check: () => axios.get<{ status: string; checks: { database: boolean; redis: boolean } }>(`${API_BASE}/health`),
};

export const authApi = {
  login: (data: { email: string; password: string }) => api.post<AuthResponse>('/auth/login', data), // FIXED: A2
  register: (data: { email: string; password: string; full_name: string }) =>
    api.post<AuthResponse>('/auth/register', data), // FIXED: A2
  updatePreference: (preference: string) => api.patch('/auth/me/preference', { ai_preference: preference }), // FIXED: A5
  getRoles: () => axios.get<{roles: {value: string, label: string}[]}>(`${API_BASE}/api/v1/auth/roles`),
};

export const paymentApi = {
  create: (data: CreatePaymentRequest) => api.post<Payment>('/payments/create', data),
  list: () => api.get<Payment[]>('/payments'),
  getById: (id: string) => api.get<Payment>(`/payments/${id}`),
  approve: (id: string) => api.post(`/payments/${id}/approve`),
  reject: (id: string) => api.post(`/payments/${id}/reject`),
  escalate: (id: string) => api.post(`/payments/${id}/escalate`),
  getPendingApprovals: () => api.get<Payment[]>('/payments/pending'),
};

export const aiApi = {
  getHealth: () => api.get('/ai/health'),
  analyze: (paymentId: string) => api.post(`/ai/analyze/${paymentId}`),
  getDecision: (paymentId: string) => api.get(`/ai/decision/${paymentId}`),
};

export const routeApi = {
  analyze: (paymentId: string) => api.get<RouteAnalysis>(`/payments/${paymentId}/analysis`),
};

export const policyApi = {
  rules: () => api.get('/policy/rules'),
  check: (paymentId: string) => api.get(`/policy/check/${paymentId}`),
};

export const reportApi = {
  list: () => api.get('/audit/list'),
  downloadPayment: (paymentId: string) => api.get(`/audit/reports/${paymentId}`, { responseType: 'blob' }),
  generateAll: () => api.post('/audit/generate-all'),
};

export const alertApi = {
  list: () => api.get<Alert[]>('/alerts'),
  markRead: (id: string) => api.post(`/alerts/${id}/read`),
};

export const revalidationApi = {
  list: () => api.get('/revalidation'),
  trigger: (data: {
    trigger_type: string;
    corridors?: string[];
    wallets?: string[];
    token?: string;
    risk_level?: string;
  }) => api.post('/revalidation/trigger', data),
  triggerSanctions: () => api.post('/revalidation/trigger/sanctions'),
  triggerPolicy: (corridors?: string[]) => api.post('/revalidation/trigger/policy', { corridors: corridors || [] }),
  triggerWallet: (wallets?: string[]) => api.post('/revalidation/trigger/wallet', { wallets: wallets || [] }),
  triggerIssuer: (token?: string, riskLevel?: string) =>
    api.post('/revalidation/trigger/issuer', { token: token || '', risk_level: riskLevel || '' }),
  getDetail: (id: string) => api.get(`/revalidation/${id}`),
  rescore: (paymentId: string) => api.post(`/revalidation/rescore/${paymentId}`),
  getStats: () => api.get('/revalidation/stats/summary'),
};

export const monitoringApi = {
  stats: () => api.get<MonitoringStats>('/monitoring/stats'),
  aiPerformance: () => api.get('/monitoring/ai-performance'),
  routeEfficiency: () => api.get('/monitoring/route-efficiency'),
};

export const privacyApi = {
  runFheChecks: (paymentId: string) => api.post(`/privacy/fhe-check/${paymentId}`),
  generateZkProofs: (paymentId: string) => api.post(`/privacy/zk-proof/${paymentId}`),
  getProofs: (paymentId: string) => api.get(`/privacy/proofs/${paymentId}`),
  verifyProofs: (paymentId: string) => api.post(`/privacy/verify/${paymentId}`),
};

export const executionApi = {
  execute: (paymentId: string) => api.post(`/execution/execute/${paymentId}`),
  status: (paymentId: string) => api.get(`/execution/status/${paymentId}`),
  auditTrail: (paymentId: string) => api.get(`/execution/audit/${paymentId}`),
};

export const walletApi = {
  connect: (address: string) => api.post('/wallet/connect', { address }),
  balance: (address: string) => api.get(`/wallet/balance/${address}`),
  networkStatus: () => api.get('/wallet/network-status'),
};

export const obfuscationApi = {
  analyze: (txid: string, chain: string = 'bitcoin') =>
    api.post<ObfuscationAnalyzeResult>('/obfuscation/analyze', { txid, chain }),
  demoTxids: () => api.get<{ txids: string[] }>('/obfuscation/demo-txids'),
  validationSnapshot: () => api.get<ObfuscationValidationSnapshot>('/obfuscation/validation-snapshot'),
};

export default api;
