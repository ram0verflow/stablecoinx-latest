# Compliance-Aware Stablecoin Settlement Orchestration — System Architecture

This document describes the full 24-layer compliance pipeline that every stablecoin settlement transaction traverses before on-chain execution.

---

## Layer 1: Frontend

The React + TypeScript dashboard where users initiate payment intents, view transaction status, manage wallets, and interact with governance controls. Built with Vite, Tailwind CSS, and Radix UI primitives. Connects to blockchain via wagmi/viem.

## Layer 2: Auth

Supabase-backed authentication layer handling JWT issuance, session management, role-based access control (RBAC), and multi-factor authentication. All downstream API calls carry a signed JWT validated by the backend.

## Layer 3: Wallet

Wallet connection and management layer. Supports externally-owned accounts (EOA) via WalletConnect/MetaMask and backend-managed custodial wallets. Validates wallet ownership, maintains address registries, and enforces wallet-level spending limits.

## Layer 4: Payment Intent

The canonical representation of a settlement request. Captures sender, receiver, amount, stablecoin type (USDC/USDT), destination chain, and metadata. The payment intent is the immutable input that flows through all subsequent compliance layers.

## Layer 5: Country Policy

Jurisdiction-aware policy engine that evaluates the payment intent against country-specific regulatory rules. Checks sanctions lists, currency controls, cross-border transfer limits, and region-specific KYC/AML thresholds. Policies are stored in the Policy Registry smart contract.

## Layer 6: Corporate Treasury Controls

Enterprise-level financial controls including daily/monthly transfer limits, multi-signatory approval thresholds, department-level budgets, and counterparty whitelists. Configurable per organization and enforced before compliance checks.

## Layer 7: Compliance Engine

The core regulatory enforcement layer. Runs AML screening, sanctions checks (OFAC, EU, UN), PEP detection, and transaction pattern analysis. Produces a compliance score and a pass/fail determination with detailed reasoning.

## Layer 8: Wallet Graph Intelligence

Neo4j-powered graph analytics layer that maps wallet relationships, detects suspicious transaction patterns, identifies mixer/tumbler interactions, and computes risk scores based on graph topology. Flags transactions involving high-risk wallet clusters.

## Layer 9: Stablecoin Issuer Risk Engine

Evaluates the risk profile of the stablecoin issuer itself — reserve composition, audit history, depegging events, regulatory status, and redemption reliability. Adjusts settlement parameters based on issuer risk tier.

## Layer 10: Cross-Chain Governance

Governance layer for multi-chain settlements. Manages bridge risk assessment, chain-specific gas estimation, cross-chain message verification, and destination chain health monitoring. Enforces governance votes on supported chains and bridge protocols.

## Layer 11: Liquidity Cost Engine

Real-time liquidity analysis that calculates slippage, gas costs, bridge fees, and optimal routing across DEXs and bridges. Provides cost transparency to the user and enforces maximum cost thresholds before execution.

## Layer 12: AI Decision Engine

LLM-powered (Ollama/Groq) advisory layer that synthesizes outputs from all previous layers into a human-readable risk assessment and recommendation. Provides natural language explanations for compliance decisions. Never makes final deterministic decisions — advisory only.

## Layer 13: Policy Final Veto

Deterministic policy checkpoint that aggregates all layer outputs and applies hard-coded business rules. Any single layer failure results in transaction rejection. No AI or probabilistic logic — pure rule evaluation. This is the last off-chain gate before privacy checks.

## Layer 14: FHE Private Checks

Fully Homomorphic Encryption layer that performs compliance checks on encrypted data without revealing sensitive transaction details. Enables privacy-preserving AML screening where counterparty data remains encrypted during evaluation.

## Layer 15: ZK Proof Generator

Generates zero-knowledge proofs attesting that all compliance checks passed without revealing the underlying data. The ZK proof is submitted on-chain alongside the settlement transaction as cryptographic evidence of compliance.

## Layer 16: Human Approval Workflow

Manual review queue for high-value or flagged transactions. Compliance officers review the AI assessment, compliance scores, and graph intelligence output. Supports multi-level approval chains with Telegram notifications and audit trails.

## Layer 17: Execution Orchestrator

The settlement execution coordinator. Sequences the on-chain operations: token approval, payment authorization, settlement execution, and proof registry submission. Handles transaction retries, gas management, and nonce ordering.

## Layer 18: Smart Contracts

Solidity contracts deployed on Base Sepolia and Polygon Amoy:
- **PaymentAuthorization**: Validates and authorizes settlement transactions on-chain.
- **PolicyRegistry**: Stores country and corporate policies as on-chain rules.
- **MockUSDC/MockUSDT**: Test stablecoin contracts for development.

## Layer 19: Blockchain Settlement

The actual on-chain token transfer execution. Handles ERC-20 approvals, atomic settlement via the PaymentAuthorization contract, and cross-chain bridge interactions. Monitors transaction confirmation and finality.

## Layer 20: On-chain Proof Registry

The SettlementProofRegistry contract that stores ZK proofs, compliance attestations, and settlement metadata on-chain. Provides an immutable, publicly verifiable record that each transaction passed all 24 compliance layers.

## Layer 21: Notifications

Multi-channel notification system delivering real-time updates via Telegram bots, in-app toasts, and webhook integrations. Notifies users on transaction status changes, approval requests, compliance flags, and settlement confirmations.

## Layer 22: Audit Vault

Immutable audit log stored in Supabase with cryptographic integrity. Records every layer's input/output, timestamps, decision rationale, and actor identity. Designed for regulatory examination and internal audit review.

## Layer 23: Historical Revalidation

Background process that retroactively re-evaluates past settlements against updated compliance rules, sanctions lists, and risk models. Identifies transactions that would fail under current policies and generates remediation reports.

## Layer 24: Monitoring

Real-time system health and transaction monitoring dashboard. Tracks layer latencies, failure rates, compliance score distributions, and blockchain gas costs. Powers Recharts-based analytics in the frontend and triggers alerts on anomalies.

---

## Data Flow Summary

```
User → Frontend → Auth → Wallet → Payment Intent
  → Country Policy → Corporate Treasury Controls
  → Compliance Engine → Wallet Graph Intelligence
  → Stablecoin Issuer Risk Engine → Cross-Chain Governance
  → Liquidity Cost Engine → AI Decision Engine
  → Policy Final Veto → FHE Private Checks
  → ZK Proof Generator → Human Approval Workflow
  → Execution Orchestrator → Smart Contracts
  → Blockchain Settlement → On-chain Proof Registry
  → Notifications → Audit Vault
  → Historical Revalidation → Monitoring
```

Every transaction must pass through all 24 layers sequentially. A failure at any layer halts the pipeline and returns a detailed rejection to the user.
