import axios from 'axios';
import type {
  LoginRequest,
  AuthResponse,
  CreatePaymentRequest,
  Payment,
  RouteAnalysis,
  Alert,
  MonitoringStats,
} from '../types';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sg_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  login: (data: LoginRequest) => api.post<AuthResponse>('/auth/login', data),
  updatePreference: (preference: string) => api.patch('/auth/me/preference', { ai_preference: preference }),
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
  trigger: () => api.post('/revalidation/trigger'),
  triggerSanctions: () => api.post('/revalidation/trigger/sanctions'),
  triggerPolicy: (corridors?: string[]) => api.post('/revalidation/trigger/policy', { corridors: corridors || [] }),
  triggerWallet: (wallets?: string[]) => api.post('/revalidation/trigger/wallet', { wallets: wallets || [] }),
  triggerIssuer: (token?: string, riskLevel?: string) => api.post('/revalidation/trigger/issuer', { token: token || '', risk_level: riskLevel || '' }),
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

export default api;
