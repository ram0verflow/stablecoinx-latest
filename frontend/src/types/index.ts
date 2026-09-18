// ── User & Auth ──────────────────────────────────────────────
export type UserRole =
  | 'Admin'
  | 'Treasury Officer'
  | 'Compliance Officer'
  | 'Auditor'
  | 'Reviewer'
  | 'Viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  walletAddress?: string;
  aiPreference?: string;
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
  | 'under_review'
  | 'approved'
  | 'blocked'
  | 'executed'
  | 'failed'
  | 'review'
  | 'revalidation';

export type Token = 'USDC' | 'USDT' | 'DAI' | 'BUSD' | 'TUSD';
export type Urgency = 'Low' | 'Medium' | 'High' | 'Critical';
export type Chain = 'Base Sepolia' | 'Polygon Amoy' | 'Ethereum Mainnet' | 'Arbitrum' | 'Optimism';
// FIXED: L2
export type Country =
  | 'SG'
  | 'USA'
  | 'UK'
  | 'UAE'
  | 'India'
  | 'Germany'
  | 'Singapore'
  | 'Hong Kong'
  | 'Egypt'
  | 'Japan'
  | 'South Korea'
  | 'Russia'
  | 'Iran'
  | 'North Korea'
  | 'Switzerland'
  | 'Canada'
  | 'Australia';
export type Purpose =
  | 'Payroll'
  | 'Supplier Payment'
  | 'Treasury Transfer'
  | 'Cross-border Settlement'
  | 'Invoice Payment'
  | 'Refund'
  | 'Dividend Payment';

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
  senderWallet?: string;
  receiverWallet: string;
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
  senderWallet?: string;
  receiverWallet: string;
}

// ── Alert ────────────────────────────────────────────────────
export type AlertType =
  | 'approved'
  | 'blocked'
  | 'review'
  | 'revalidation'
  | 'review_needed'
  | 'settlement_executed'
  | 'settlement_failed';

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
    action: string;
    reasoning: string;
    confidence: number;
    engineUsed?: string;
    latencyMs?: number;
    riskSummary?: string;
    flags?: string[];
    alternativeOptions?: string[];
  };
  fheCheck: {
    status: 'PASS' | 'FAIL' | 'PENDING';
    details: string;
    checks?: FheCheckItem[];
    method?: string;
    overall_pass?: boolean | null;
    fhe_available?: boolean;
  };
  zkProof: {
    generated: boolean;
    proofHash: string;
    bundleId?: string;
    isValid?: boolean;
    proofMethod?: string;
    on_chain_tx?: string | null;
    basescan_url?: string | null;
    components?: {
      kyc?: ZkComponent;
      range?: ZkComponent;
      approval?: ZkComponent;
    };
    privacy_statement?: string;
  };
}

export interface FheCheckItem {
  check_id: string;
  check_label: string;
  threshold: number;
  result: boolean;
  method: string;
  encrypted_proof: string;
  privacy_note?: string;
}

export interface ZkComponent {
  proof_type?: string;
  is_valid?: boolean;
  proof_hash?: string;
  public_inputs?: Record<string, unknown>;
  proof_method?: string;
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
  payment_id: string;
  trigger_reason: string;
  original_decision: string;
  new_decision: string;
  new_risk_score: number;
  status: RevalidationStatus;
  created_at: string;
  decision_changed?: boolean;
}

export interface MonitoringStats {
  total_payments: number;
  total_volume: number;
  approved_today: number;
  blocked_today: number;
  pending_review: number;
  avg_ai_latency_ms: number;
  tx_success_rate: number;
  top_corridors: { corridor: string; count: number; block_rate: number }[];
  ai_engine_status: 'ollama' | 'groq' | 'down';
  rpc_status: { base_sepolia: boolean; polygon_amoy: boolean };
  neo4j_status: boolean;
  redis_status: boolean;
  compliance_provider?: { name: string; configured: boolean };
  wallet_intelligence?: { provider: 'neo4j' | 'beeceptor'; status: boolean };
}

export interface ObfuscationEvidenceSignal {
  name: string;
  passed: boolean;
  weight: number;
  detail: string;
}

export interface ObfuscationProviderAttribution {
  source: string;
  status: string;
  known_illicit_attribution?: boolean | null;
  known_scam_exposure?: boolean | null;
  known_sanctions_exposure?: boolean | null;
  risk_score?: number | null;
  freshness_seconds?: number | null;
  reason?: string | null;
}

export interface ObfuscationAnalyzeResult {
  txid: string;
  classification: string;
  protocol: string;
  confidence: number;
  obfuscation_confidence: string;
  provenance_confidence: string;
  illicit_attribution: string;
  provider_attribution: ObfuscationProviderAttribution;
  policy_recommendation: string;
  policy_message: string;
  evidence: ObfuscationEvidenceSignal[];
  evidence_against: string[];
  classification_hint?: string | null;
  limits: string[];
  source: 'cached_validation_fixture' | 'live_blockstream_fetch' | string;
}

export interface ObfuscationValidationSnapshot {
  available: boolean;
  generated_at?: string;
  claim?: string;
  total_runnable_cases?: number;
  error_cases?: number;
  correct_count?: number;
  incorrect_count?: number;
  precision?: number | null;
  recall?: number | null;
  small_sample_warning?: boolean;
}
