// ── User & Auth ──────────────────────────────────────────────
export type UserRole =
  | 'Admin'
  | 'Treasury Officer'
  | 'Compliance Officer'
  | 'Auditor'
  | 'Reviewer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  walletAddress?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  role: UserRole;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// ── Payment ──────────────────────────────────────────────────
export type PaymentStatus =
  | 'pending'
  | 'approved'
  | 'blocked'
  | 'settled'
  | 'review'
  | 'revalidation';

export type Token = 'USDC' | 'USDT';
export type Urgency = 'Low' | 'Medium' | 'High' | 'Critical';
export type Chain = 'Base Sepolia' | 'Polygon Amoy';
export type Country = 'Singapore' | 'USA' | 'UK' | 'UAE' | 'India' | 'Germany';
export type Purpose =
  | 'Payroll'
  | 'Supplier Payment'
  | 'Treasury Transfer'
  | 'Cross-border Settlement';

export interface Payment {
  id: string;
  senderCompany: string;
  receiverCompany: string;
  sourceCountry: Country;
  destinationCountry: Country;
  sourceChain: Chain;
  destinationChain: Chain;
  amount: number;
  token: Token;
  purpose: Purpose;
  urgency: Urgency;
  status: PaymentStatus;
  corridor: string;
  riskScore: number;
  aiDecision: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentRequest {
  senderCompany: string;
  receiverCompany: string;
  sourceCountry: Country;
  destinationCountry: Country;
  sourceChain: Chain;
  destinationChain: Chain;
  amount: number;
  token: Token;
  purpose: Purpose;
  urgency: Urgency;
}

// ── Alert ────────────────────────────────────────────────────
export type AlertType = 'approved' | 'blocked' | 'review' | 'revalidation';

export interface Alert {
  id: string;
  type: AlertType;
  paymentId: string;
  message: string;
  timestamp: string;
  read: boolean;
}

// ── Decision / Route Analysis ────────────────────────────────
export type DecisionStatus = 'PASS' | 'FAIL' | 'WARNING';

export interface Decision {
  layer: string;
  status: DecisionStatus;
  details: string;
  confidence?: number;
}

export interface WalletRisk {
  score: number;
  level: 'Low' | 'Medium' | 'High' | 'Critical';
  warnings: string[];
}

export interface IssuerRiskEntry {
  rating: string;
  reserve: string;
  audited: boolean;
  depegEvents: number;
}

export interface RouteAnalysis {
  paymentId: string;
  payment: Payment;
  countryPolicy: Decision[];
  walletRisk: WalletRisk;
  issuerRisk: {
    usdc: IssuerRiskEntry;
    usdt: IssuerRiskEntry;
  };
  chainGovernance: {
    allowedChains: string[];
    bridgeTrustScore: number;
    gasEstimate: string;
  };
  liquidityAnalysis: {
    cheapestRoute: string;
    slippage: string;
    eta: string;
    totalCost: string;
  };
  aiDecision: {
    action: 'APPROVE' | 'REJECT' | 'ESCALATE';
    reasoning: string;
    confidence: number;
  };
  fheCheck: { status: 'PASS' | 'FAIL'; details: string };
  zkProof: { generated: boolean; proofHash: string };
}

// ── Audit Report ─────────────────────────────────────────────
export interface AuditReport {
  id: string;
  paymentId: string;
  corridor: string;
  amount: number;
  token: string;
  status: string;
  aiDecision: string;
  zkProof: string;
  timestamp: string;
}

// ── Revalidation ─────────────────────────────────────────────
export type RevalidationStatus = 'pending' | 'completed' | 'failed';

export interface RevalidationRecord {
  id: string;
  paymentId: string;
  originalDecision: string;
  revalidationReason: string;
  newRiskScore: number;
  status: RevalidationStatus;
  timestamp: string;
}
