import axios from 'axios';
import type {
  LoginRequest,
  AuthResponse,
  CreatePaymentRequest,
  Payment,
  RouteAnalysis,
  AuditReport,
  Alert,
  RevalidationRecord,
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

export const routeApi = {
  analyze: (paymentId: string) => api.get<RouteAnalysis>(`/payments/${paymentId}/analysis`),
};

export const reportApi = {
  list: () => api.get<AuditReport[]>('/reports'),
  download: (id: string) => api.get(`/reports/${id}`, { responseType: 'blob' }),
  downloadAll: () => api.get('/reports/download-all', { responseType: 'blob' }),
};

export const alertApi = {
  list: () => api.get<Alert[]>('/alerts'),
  markRead: (id: string) => api.post(`/alerts/${id}/read`),
};

export const revalidationApi = {
  list: () => api.get<RevalidationRecord[]>('/revalidation'),
  trigger: (paymentId: string) => api.post('/revalidation/trigger', { paymentId }),
  getReport: (id: string) => api.get(`/revalidation/${id}/report`),
};

export default api;
