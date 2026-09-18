# Compliance-Aware Stablecoin Settlement Orchestration

A production-grade, multi-chain stablecoin settlement platform that routes every payment through a 24-layer compliance pipeline before on-chain execution. The system combines real-time AML/sanctions screening, graph-based wallet intelligence, AI-powered risk assessment, zero-knowledge privacy proofs, fully homomorphic encryption, cross-chain governance, and on-chain proof attestation to deliver enterprise-grade regulatory compliance for stablecoin transfers across Base Sepolia and Polygon Amoy.

---

## System Layers

| #  | Layer                          | Description                                                        |
|----|--------------------------------|--------------------------------------------------------------------|
| 1  | Frontend                       | React + TypeScript dashboard for payment initiation and monitoring |
| 2  | Auth                           | Supabase JWT authentication with RBAC                              |
| 3  | Wallet                         | Wallet connection, ownership validation, and address registry      |
| 4  | Payment Intent                 | Canonical settlement request representation                       |
| 5  | Country Policy                 | Jurisdiction-aware regulatory rule evaluation                      |
| 6  | Corporate Treasury Controls    | Enterprise spending limits and multi-sig approval thresholds       |
| 7  | Compliance Engine              | AML screening, sanctions checks, PEP detection                    |
| 8  | Wallet Graph Intelligence      | Neo4j graph analytics for wallet relationship risk scoring         |
| 9  | Stablecoin Issuer Risk Engine  | Issuer reserve, audit, and depegging risk assessment               |
| 10 | Cross-Chain Governance         | Multi-chain bridge risk and destination chain health monitoring    |
| 11 | Liquidity Cost Engine          | Slippage, gas, bridge fee calculation and optimal routing          |
| 12 | AI Decision Engine             | LLM-powered advisory risk synthesis (Ollama / Groq)               |
| 13 | Policy Final Veto              | Deterministic hard-rule aggregation gate                           |
| 14 | FHE Private Checks             | Privacy-preserving compliance on encrypted data                    |
| 15 | ZK Proof Generator             | Zero-knowledge proof of compliance for on-chain attestation        |
| 16 | Human Approval Workflow        | Manual review queue with multi-level approval chains               |
| 17 | Execution Orchestrator         | On-chain operation sequencing, retries, and gas management         |
| 18 | Smart Contracts                | Solidity contracts for authorization, policy, and settlement       |
| 19 | Blockchain Settlement          | Atomic ERC-20 transfers and cross-chain bridge execution           |
| 20 | On-chain Proof Registry        | Immutable ZK proof and compliance attestation storage              |
| 21 | Notifications                  | Telegram, in-app, and webhook real-time alerts                     |
| 22 | Audit Vault                    | Cryptographically-sealed immutable audit log                       |
| 23 | Historical Revalidation        | Retroactive compliance re-evaluation against updated rules         |
| 24 | Monitoring                     | Real-time health, latency, and analytics dashboard                 |

---

## Tech Stack

| Layer       | Technology                                                                 |
|-------------|----------------------------------------------------------------------------|
| Frontend    | React, TypeScript, Vite, Tailwind CSS, Radix UI, Recharts, wagmi, viem    |
| Backend     | FastAPI, SQLAlchemy, Pydantic, Alembic, Supabase, Redis, Neo4j            |
| Blockchain  | Solidity, Foundry, Base Sepolia, Polygon Amoy, ERC-20                     |
| AI          | Ollama (gemma:2b), Groq (llama3-8b-8192)                                 |
| Privacy     | ZK Proofs, Fully Homomorphic Encryption                                   |
| Messaging   | Telegram Bot API                                                          |

---

## Getting Started

```bash
# Clone the repository
git clone <repo-url> && cd Altaria

# Backend
cd backend
pip install -r requirements.txt
cp ../.env.example ../.env  # fill in values
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev

# Contracts
cd contracts
forge build
forge test
```

---

## License

MIT