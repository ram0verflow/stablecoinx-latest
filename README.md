<div align="center">
  <img src="docs/assets/stablecoinx-mark.svg" width="900" alt="StableCoinX" />

  <br/>
  <strong>Institutional stablecoin settlement where compliance is part of the transaction.</strong>

<br/><br/>

  <img src="https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-2547DB?style=for-the-badge&logo=react&logoColor=white" alt="React + TypeScript" />
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Contracts-Solidity%20%2B%20Foundry-363636?style=for-the-badge&logo=solidity&logoColor=white" alt="Solidity + Foundry" />
  <img src="https://img.shields.io/badge/Chains-Base%20Sepolia%20%7C%20Polygon%20Amoy-111827?style=for-the-badge" alt="Supported chains" />
  <img src="https://img.shields.io/badge/License-MIT-15754C?style=for-the-badge" alt="MIT License" />

<br/><br/>

<em>Policy → Intelligence → Veto → Privacy → Proof → Settlement</em>

</div>

<br/>

<p align="center">
  <img src="docs/assets/animated-settlement-flow.svg" width="1100" alt="Animated StableCoinX settlement flow" />
</p>

What is StableCoinX?

StableCoinX is a compliance-aware stablecoin settlement orchestration platform for enterprise treasury flows. Instead of treating compliance as a post-transaction report, it makes compliance evidence a first-class input to authorization.

A payment intent is evaluated across jurisdictional policy, treasury controls, KYC/KYB and sanctions, wallet intelligence, provenance, issuer risk, chain governance, route economics, AI-assisted reasoning, deterministic policy vetoes, privacy checks, ZK attestation, approvals, and on-chain execution.

The design goal is simple:

A transfer should become executable only when the system can explain why it is allowed to settle.

The idea in one transaction

Imagine an enterprise moving 9,000 USDC from Singapore to the UAE.

The question is not only “Can the chain move the money?” It is:

Can this payment be authorized, defended, audited, re-evaluated later, and proved on-chain?

StableCoinX turns that one payment into a sequence of independent evidence checks:

Intent → Policy → Compliance → Wallet Graph → Provenance → Counterparty → Issuer → Chain → Liquidity → AI Advisory → Final Veto → FHE → ZK Proof → Approval → Settlement

No single probabilistic signal silently becomes truth. No provider outage silently becomes a clean pass. Privacy-seeking transaction structure is treated as a risk/uncertainty signal, not as proof of illicit activity.

Why this architecture is different

01 — The LLM is deliberately not the judge

Ollama / Groq can synthesize risk, explain evidence, and suggest an action. The deterministic policy_veto_service remains authoritative for hard constraints such as sanctions, corridor restrictions, treasury limits, degraded compliance providers, and other policy gates.

<p align="center">
  <img src="docs/assets/decision-gate.svg" width="1000" alt="AI advisory and deterministic policy veto" />
</p>

02 — Privacy structure ≠ illicit attribution

The obfuscation intelligence layer classifies Bitcoin transaction structure (for the current implementation, protocol-aware Whirlpool legacy patterns) separately from external attribution. A high-confidence privacy pattern can trigger enhanced review without automatically becoming a block.

Privacy is not guilt. Uncertainty is not clearance.

External provider attribution is deliberately kept as a separate signal and can escalate to a block when the provider explicitly returns a sanctions/scam hit.

03 — Degraded dependencies fail toward review

The project explicitly treats unavailable intelligence as uncertainty. For example, a degraded compliance provider produces pending_review, while unreachable Neo4j wallet intelligence is represented as degraded rather than as a fake low-risk result.

That posture appears throughout the stack: provider failure should be visible to the operator, not hidden by a convenient default.

04 — Every important decision leaves evidence

Compliance results, AI metadata, FHE checks, ZK proof references, approvals, alerts, and settlement artifacts are persisted so a treasury/compliance operator can inspect the path behind a decision.

Historical revalidation can then revisit executed payments when sanctions, policies, or intelligence change.

Architecture

24-layer control model → 14 master orchestration stages

The repository documents a 24-layer conceptual control architecture. The executable payment_pipeline.py implements those controls as 14 master orchestration stages with sub-stages such as counterparty intelligence, FHE checks, and ZK generation.

That distinction matters: the 24-layer view describes the product/system boundary; the 14-stage view describes the master execution function.

flowchart LR
    U[👤 Treasury User]
    F[🖥️ React + TypeScript]
    A[🔐 Supabase Auth / RBAC]
    API[⚡ FastAPI API]
    PI[📄 Payment Intent]

    subgraph GOV[Policy & Governance]
      CP[Country Corridor Policy]
      TC[Treasury Controls]
      CG[Chain Governance]
      LIQ[Liquidity & Cost]
      PV{Deterministic
      Policy Veto}
    end

    subgraph INTEL[Risk & Intelligence]
      CO[Compliance / KYC / KYB / Sanctions]
      WG[Neo4j Wallet Graph]
      PR[Provenance / Path Integrity]
      CR[Counterparty Risk]
      IR[Issuer Risk]
      OB[Obfuscation Intelligence]
      MX[Mixer Signals]
    end

    subgraph AI[Advisory]
      LLM[Ollama / Groq]
    end

    subgraph PRIV[Privacy & Proof]
      FHE[FHE Threshold Checks]
      ZK[ZK Proof Generator]
    end

    subgraph CHAIN[Execution & Settlement]
      EXE[Execution Orchestrator]
      PA[PaymentAuthorization.sol]
      PRG[SettlementProofRegistry.sol]
      POL[PolicyRegistry.sol]
      ERC[Mock USDC / USDT]
    end

    subgraph OPS[Operations]
      AP[Human Approval Queue]
      NTF[Telegram / n8n]
      AUD[(Postgres / Audit Vault)]
      REV[Historical Revalidation]
      MON[Monitoring]
    end

    U --> F --> A --> API --> PI
    PI --> CP --> TC --> CO --> WG --> PR --> CR --> IR --> CG --> LIQ --> LLM --> PV
    OB -. separate signal .-> INTEL
    MX -. separate signal .-> INTEL
    PV --> FHE --> ZK --> AP --> EXE
    EXE --> PA --> ERC
    EXE --> PRG
    PV --> POL
    API --> AUD
    EXE --> AUD
    API --> NTF
    AUD --> REV
    AUD --> MON

Runtime sequence

sequenceDiagram
    autonumber
    actor User as Treasury Operator
    participant UI as React Dashboard
    participant API as FastAPI
    participant DB as Postgres
    participant Intel as Risk Intelligence
    participant AI as Ollama/Groq
    participant Veto as Policy Veto
    participant Privacy as FHE + ZK
    participant Chain as EVM Contracts
    participant Ops as Approval / Alerts

    User->>UI: Create payment intent
    UI->>API: POST /api/v1/payments/create
    API->>DB: Persist intent
    API->>Intel: Run policy + compliance + graph + provenance + issuer checks
    Intel-->>API: Independent evidence
    API->>AI: Synthesize explanation (advisory only)
    AI-->>API: Decision + reasoning + confidence
    API->>Veto: Apply deterministic policy gates
    Veto-->>API: APPROVED / REVIEW / BLOCKED
    API->>Privacy: FHE thresholds + ZK proof generation
    Privacy-->>API: Check result + proof bundle
    API->>Ops: Approval / notifications when required
    Ops-->>API: Authorization state
    API->>Chain: Execute settlement
    Chain-->>API: Tx hash / finality
    API->>Chain: Register proof attestation
    API->>DB: Persist audit trail
    API-->>UI: Payment status + evidence

The core feature set

Capability

What it does

Why it exists

Policy-aware routing

Checks source/destination corridor rules and treasury constraints before settlement

A technically valid transfer can still be a policy-invalid transfer

Compliance screening

KYC/KYB, sanctions and internal blacklist signals with provider abstraction

Keeps hard compliance evidence independent from AI reasoning

Wallet graph intelligence

Neo4j relationship analysis, mixer adjacency, laundering-cluster signals, suspicious links

A wallet cannot be understood only as a single address

Provenance / path integrity

Evaluates route transparency and path signals

Opaque routing can reduce confidence without pretending to deanonymize it

Counterparty intelligence

Combines route transparency, KYB/KYC status, wallet behavior and hard compliance signals

Converts fragmented evidence into an explainable enterprise authorization signal

Stablecoin issuer risk

Scores issuer/reserve/depeg-related risk inputs

The asset itself is part of settlement risk

Cross-chain governance

Checks allowed chains, bridge trust, gas/finality and chain conditions

Multi-chain is a governance problem, not only an RPC problem

Liquidity / cost engine

Compares route economics, bridge costs and slippage assumptions

Compliance-safe does not automatically mean economically sane

AI decision engine

Uses Ollama or Groq for synthesis and human-readable reasoning

Makes a complex risk state inspectable without outsourcing the hard veto

Deterministic final veto

Applies hard rules over all pipeline evidence

Prevents an LLM from overriding non-negotiable controls

FHE checks

Runs privacy-preserving threshold checks

Sensitive thresholds can be evaluated without exposing raw data in the same way as a plaintext path

ZK proof generation

Creates a combined proof artifact for the compliance/settlement path

Makes compliance evidence attestable rather than merely claimable

Human approval workflow

Routes high-value / high-risk decisions into an approval queue

Sensitive transfers need accountable human intervention

On-chain proof registry

Stores proof and settlement metadata through Solidity contracts

Turns “we checked it” into independently inspectable on-chain evidence

Historical revalidation

Re-runs old payments after policy/sanctions/intelligence changes

Compliance is not a one-time decision

Operations automation

Telegram + n8n webhook/email routing

Operators need the event, not only the dashboard

Monitoring

DB, Redis, AI, Neo4j and chain health plus payment analytics

Infrastructure health is itself part of the decision context

Obfuscation Intelligence — the interesting bit

StableCoinX includes a standalone classifier under tools/obfuscation_classifier/ and a backend adapter under backend/app/services/obfuscation/.

The current classifier is intentionally narrow and transparent: it detects protocol-aware Bitcoin transaction structure for the supported Whirlpool legacy pattern, scores structural evidence, and keeps external attribution separate.

flowchart TB
    T[Bitcoin TXID]
    T --> S[Structural classifier]
    S -->|high structural confidence| ER[Enhanced Review]
    S -->|ordinary structure| N[No Obfuscation Action]
    T --> P[External attribution provider]
    P -->|explicit scam / sanctions exposure| B[Blocked by External Attribution]
    P -->|provider unavailable| R[Manual Review — Provider Unavailable]
    P -->|clean| K[Keep classifier recommendation]

The important product behavior is the separation of signals:

Structural privacy behavior is not treated as a crime signal by itself.

Explicit external attribution can still trigger a hard block.

Provider outage becomes uncertainty → review.

The UI exposes evidence, counter-evidence, limitations, and validation state instead of hiding the reasoning behind one score.

The repository also includes real demo fixtures, benchmark tooling, validation notes, and a dedicated UI at /obfuscation-intelligence.

Policy decision logic

A simplified view of the final gate is:

                 ┌──────────────────────────┐
                 │     Evidence bundle      │
                 └────────────┬─────────────┘
                              │
          ┌───────────────────▼───────────────────┐
          │      AI advisory (Ollama / Groq)      │
          │ explain + synthesize + suggest only   │
          └───────────────────┬───────────────────┘
                              │
                              ▼
                 ┌─────────────────────────┐
                 │  Deterministic veto     │
                 │ sanctions / policy /    │
                 │ treasury / provider /   │
                 │ risk hard gates         │
                 └───────────┬─────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
          APPROVED         REVIEW         BLOCKED

Notable hard-stop behavior implemented in policy_veto_service.py includes sanctions hits, internal blacklist hits, disallowed corridors, treasury-limit failures, high/critical issuer risk, degraded compliance provider state, and configured counterparty policy actions.

Tech stack — with the actual tooling

<p align="center">
  <img src="https://skillicons.dev/icons?i=react,ts,vite,tailwind,python,fastapi,postgres,redis,neo4j,solidity,foundry,supabase,github&perline=7" alt="Technology logos" />
</p>

Area

Tools in this repo

Web

React 18, TypeScript, Vite, Tailwind CSS, Radix UI, React Router, Zustand

Data / UX

Cytoscape.js, Dagre, Lucide icons, custom analytics views

API

FastAPI, Pydantic, SQLAlchemy, Alembic, SlowAPI

Persistence

PostgreSQL, Redis

Identity

Supabase JWT + RBAC guards

Graph / intelligence

Neo4j, local deterministic fixtures, Beeceptor provider abstraction

AI

Ollama (gemma:2b default in docs/config) and Groq (llama3-8b-8192 configured option)

Blockchain

Solidity ^0.8.20, Foundry, Web3.py, Base Sepolia, Polygon Amoy, ERC-20 test tokens

Privacy

FHE service integration point + combined ZK proof generation path

Automation / alerts

Telegram Bot API, n8n webhook integration

Ops

Render Blueprint (render.yaml), health probes, rate limiting, request logging

Integration logos

<p align="center">
  <img src="https://cdn.simpleicons.org/ollama/131417" width="34" alt="Ollama" title="Ollama" />
  <img src="https://cdn.simpleicons.org/groq/131417" width="34" alt="Groq" title="Groq" />
  <img src="https://cdn.simpleicons.org/supabase/131417" width="34" alt="Supabase" title="Supabase" />
  <img src="https://cdn.simpleicons.org/neo4j/131417" width="34" alt="Neo4j" title="Neo4j" />
  <img src="https://cdn.simpleicons.org/redis/131417" width="34" alt="Redis" title="Redis" />
  <img src="https://cdn.simpleicons.org/postgresql/131417" width="34" alt="PostgreSQL" title="PostgreSQL" />
  <img src="https://cdn.simpleicons.org/n8n/131417" width="34" alt="n8n" title="n8n" />
  <img src="https://cdn.simpleicons.org/telegram/131417" width="34" alt="Telegram" title="Telegram" />
  <img src="https://cdn.simpleicons.org/ethereum/131417" width="34" alt="EVM" title="EVM" />
</p>

Product surface

The frontend is not a single dashboard. It exposes the major control-plane views:

Landing
 ├─ Login
 └─ Authenticated Shell
     ├─ Dashboard / Overview
     ├─ Payments
     ├─ Create Payment
     ├─ Route Analysis
     ├─ Approval Queue
     ├─ Policies
     ├─ Compliance
     ├─ Obfuscation Intelligence
     ├─ Mixer Signals
     ├─ Audit Reports
     ├─ Historical Revalidation
     ├─ Integrations
     ├─ Infrastructure
     ├─ Proof Page
     └─ Settings

The UI also contains focused components for counterparty intelligence, provenance, mixer signals, obfuscation charts, policy engine settings, status badges, RBAC guards, and error boundaries.

Repository map

.
├── frontend/
│   └── src/
│       ├── pages/             # operator-facing product surfaces
│       ├── components/        # reusable risk / graph / status UI
│       ├── lib/               # API, Supabase, wagmi
│       └── store/              # auth + payment state
│
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/  # REST surface
│   │   ├── services/          # orchestration + intelligence + execution
│   │   ├── models/            # SQLAlchemy persistence models
│   │   ├── core/              # settings, blockchain, security, rate limit
│   │   └── middleware/        # logging + throttling
│   └── tests/                 # backend behavior + pipeline tests
│
├── contracts/
│   ├── src/                   # Solidity contracts
│   ├── test/                  # Foundry tests
│   └── script/                # deployment script
│
├── tools/
│   └── obfuscation_classifier/ # standalone classifier + benchmark tooling
│
├── docs/
│   ├── architecture.md
│   ├── HACKATHON_BASELINE.md
│   ├── SPONSOR_INTEGRATIONS.md
│   ├── OBFUSCATION_INTELLIGENCE_DEMO.md
│   ├── demo_script.md
│   └── assets/                # README diagrams / animated visuals
│
└── render.yaml                # deployable infra blueprint

Quick start

1. Clone

git clone <your-repo-url>
cd stablecoinx-latest-main

2. Backend

cd backend
python -m venv .venv

# macOS/Linux
source .venv/bin/activate

# Windows PowerShell
# .venv\Scripts\Activate.ps1

pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000

The API exposes health checks at:

GET /health
GET /api/v1/health

3. Frontend

cd frontend
npm ci
cp .env.example .env
npm run dev

4. Contracts

cd contracts
forge build
forge test

Deployment is driven by contracts/script/Deploy.s.sol and uses the configured backend wallet and EVM RPC settings.

Configuration

Copy the relevant examples before starting the services:

.env.example
backend/.env.example
frontend/.env.example

The important configuration families are:

Group

Examples

Database / cache

DATABASE_URL, REDIS_URL

Identity

SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT settings

AI

OLLAMA_BASE_URL, OLLAMA_MODEL, GROQ_API_KEY, GROQ_MODEL

Graph

NEO4J_URI, NEO4J_USER / NEO4J_USERNAME, NEO4J_PASSWORD

Chains

BASE_SEPOLIA_RPC_URL, POLYGON_AMOY_RPC_URL, chain IDs

Contracts

PAYMENT_AUTHORIZATION_ADDRESS, SETTLEMENT_PROOF_REGISTRY_ADDRESS, POLICY_REGISTRY_ADDRESS, mock token addresses

Providers

COMPLIANCE_PROVIDER, BEECEPTOR_BASE_URL, OBFUSCATION_PROVIDER_MODE, BEECEPTOR_OBFUSCATION_URL

Operations

Telegram and n8n webhook settings

Privacy

FHE_GATEWAY_URL, ZK_PROVER_URL

Never commit real secrets. The examples in this repository are placeholders/configuration templates.

Demo paths worth showing

A. Clean payment

Create a normal payment and show the pipeline evidence → AI explanation → final approved/review state → proof reference.

B. Sanctions block

Use a seeded/demo counterparty such as Tehran Trade Co and inspect how the compliance provider + policy veto produce a hard block.

C. Provider outage

Use the configured Beeceptor outage scenario to show that a compliance provider failure produces degraded evidence and routes the payment to review rather than silently passing.

D. High-risk wallet

Use the high-risk demo wallet fixture to show Neo4j/Beeceptor wallet intelligence elevating the payment into review.

E. Obfuscation beat

Open Risk & Compliance → Obfuscation Intelligence, paste a demo Bitcoin TXID, and show the structural classifier separately from external attribution.

F. Historical revalidation

Flip a policy/intelligence condition and run revalidation to demonstrate that previously executed payments can be revisited under updated controls.

Testing

Backend

cd backend
pytest

The current backend suite includes coverage for:

AI decision parsing / fallback behavior

Beeceptor provider behavior

compliance engine

counterparty risk

country policy

execution

full payment pipeline

policy veto

provenance policy mapping / provenance service

RBAC

historical revalidation

wallet graph

Smart contracts

cd contracts
forge test

The Foundry suite covers authorization behavior, policy registry state, settlement proof registration, and mock ERC-20 mint/transfer behavior.

Obfuscation classifier

python3 tools/obfuscation_classifier/run_demo.py --txid <bitcoin_txid>
python3 tools/obfuscation_classifier/benchmark.py

See tools/obfuscation_classifier/README.md and VALIDATION_NOTES.md for classifier-specific limitations and benchmark interpretation.

Failure model

StableCoinX intentionally prefers visible uncertainty over silent clearance.

flowchart LR
    X[Dependency / evidence source fails] --> Q{Is the signal safety-critical?}
    Q -->|Yes| R[REVIEW / DEGRADED]
    Q -->|Explicit hard violation| B[BLOCK]
    Q -->|Operational notification failure| N[Log + continue]
    R --> O[Operator sees why]
    B --> O
    N --> O

Examples from the implementation:

Condition

System posture

Compliance provider unreachable

pending_review

Neo4j unavailable

degraded wallet result, not fake low risk

FHE check fails hard

can override final decision to blocked

n8n / Telegram notification fails

log the failure; do not change settlement decision

ZK/on-chain proof registration unavailable

proof bundle can degrade gracefully while the system records the condition

Explicit sanctions / blacklist hit

block

High-risk wallet above hard threshold

review

Opaque/private-relay route

enhanced review, not automatic guilt

Sponsor / integration status

The repository's docs/SPONSOR_INTEGRATIONS.md records the current integration posture:

Integration

Repository status

Beeceptor

Live provider abstraction + demo scenarios

n8n

Live local operations-alert workflow

Render

Blueprint / infra-as-code present; live deployment not verified in the repo

Trace Commons

Not started

.xyz

Not started

CodeCrafters

Not started

This status is intentionally kept separate from the core trust path: optional integrations should not become hidden single points of failure.

Known limitations

The repository documents these limitations explicitly; they are part of the engineering story, not footnotes to hide:

The obfuscation classifier currently targets a narrow Whirlpool legacy transaction shape rather than all modern CoinJoin variants.

The obfuscation benchmark is curated and small; benchmark numbers should not be interpreted as production-level coverage.

Bitcoin obfuscation analysis is currently the supported chain for that feature.

Beeceptor is a mock external provider for the demo path, not a substitute for production blockchain intelligence vendors.

Render is defined as infrastructure-as-code, but the repository does not establish that the application has been deployed to a live Render account.

Dual-approval orchestration through n8n is not the completed architecture; n8n covers operational alerting while the approval workflow remains in the application.

The FHE and ZK paths are integrated as services/attestation components; deployment-grade cryptographic proving infrastructure still depends on the configured external/local prover or gateway.

Built for judges, operators, and engineers

For a judge

“Show me the block.”

→ sanctions / hard policy veto

“Show me something the AI cannot override.”

→ policy_veto_service.py

“Show me the privacy-vs-illicit distinction.”

→ Obfuscation Intelligence

“Show me proof.”

→ ZK bundle + SettlementProofRegistry.sol

“Show me it can change its mind later.”

→ Historical Revalidation

For an engineer

Start with:

backend/app/services/payment_pipeline.py
backend/app/services/governance/policy_veto_service.py
backend/app/services/compliance/
backend/app/services/privacy/
backend/app/services/blockchain/
tools/obfuscation_classifier/
contracts/src/

Those directories describe the trust path from payment intent to evidence, decision, proof, and settlement.

The design principle

Move money only after you can explain the risk, enforce the policy, preserve the evidence, and prove the decision.

<br/>

<div align="center">
  <sub>StableCoinX • compliance-aware stablecoin settlement orchestration</sub>
</div>
