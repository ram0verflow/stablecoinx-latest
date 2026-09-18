# PHASE 9 DEPLOYMENT & TESTING GUIDE

**Project**: Compliance-Aware Stablecoin Settlement Orchestration  
**Phase**: 9 - System Integration & Validation  
**Status**: ✅ READY TO START  
**Validation**: All 35 checks PASSED  

---

## 🚀 QUICK START CHECKLIST

Before beginning Phase 9, verify:

- [x] All validation audits completed (PHASE_9_VALIDATION_REPORT.md)
- [x] Smart contracts deployed to Base Sepolia ✅
- [x] Environment variables configured ✅
- [x] Backend services fully implemented ✅
- [x] Frontend UI scaffolded ✅
- [x] Database models initialized ✅
- [x] No blocking issues found ✅

**Status**: Ready to proceed with Phase 9 testing and integration.

---

## 📋 PHASE 9 OBJECTIVES

Phase 9 focuses on:
1. **System Integration Testing** - Ensure all components work together
2. **End-to-End Flow Validation** - Complete payment lifecycle
3. **Performance & Load Testing** - Scalability verification
4. **Failure Scenario Testing** - Resilience validation
5. **Audit & Compliance** - Privacy and security verification
6. **Deployment Preparation** - Production readiness

---

## 🔧 ENVIRONMENT SETUP

### Prerequisites

```bash
# Required Services (before starting)
1. ✅ Ollama running: http://localhost:11434
2. ✅ Redis running: redis://localhost:6379
3. ✅ Neo4j accessible: neo4j+s://[your-neo4j-uri]
4. ✅ Backend DB: SQLite at ./backend/settleguard.db
5. ✅ Alchemy API key configured
6. ✅ Base Sepolia RPC accessible

# Optional Services (recommended)
7. Supabase project active
8. Groq API key configured (fallback AI)
9. Telegram bot token configured (alerts)
```

### Start Backend Service

```bash
cd backend/
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Expected output:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Neo4j seeding initiated
INFO:     Application startup complete
```

### Start Frontend

```bash
cd frontend/
npm install  # if not done
npm run dev
```

Expected output:
```
  VITE v... dev server running at:

  ➜  Local:   http://localhost:5173/
```

---

## 🧪 TESTING PHASES

### Phase 9A: Unit Component Testing

#### Test 1: Health Endpoints
```bash
# Backend health
curl http://localhost:8000/health

# Expected:
# {"status": "ok", "version": "1.0.0"}

# AI health
curl http://localhost:8000/api/v1/ai/health

# Expected:
# {"active_engine": "ollama", "status": "online"}
```

#### Test 2: Authentication
```bash
# Register user
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "full_name": "Test User",
    "role": "treasury_officer"
  }'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'

# Expected: JWT token returned
```

#### Test 3: Policy Rules
```bash
# Get all policy rules
curl http://localhost:8000/api/v1/policy/rules \
  -H "Authorization: Bearer {token}"

# Expected: Array of policy rules
```

---

### Phase 9B: End-to-End Payment Flow

#### Test Flow: Create → Process → Verify

```bash
# Step 1: Create Payment
PAYMENT=$(curl -X POST http://localhost:8000/api/v1/payments/create \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "sender_company": "Acme Corp",
    "receiver_company": "Global Trading Ltd",
    "source_country": "Singapore",
    "destination_country": "UAE",
    "source_chain": "base_sepolia",
    "destination_chain": "polygon_amoy",
    "amount": 50000,
    "token": "USDC",
    "purpose": "Supplier Payment",
    "urgency": "High"
  }')

PAYMENT_ID=$(echo $PAYMENT | jq -r '.id')
echo "Payment created: $PAYMENT_ID"

# Step 2: Wait for Pipeline (5-10 seconds)
sleep 10

# Step 3: Check Payment Status
curl http://localhost:8000/api/v1/payments/$PAYMENT_ID \
  -H "Authorization: Bearer {token}"

# Step 4: Get Full Analysis
curl http://localhost:8000/api/v1/payments/$PAYMENT_ID/analysis \
  -H "Authorization: Bearer {token}"

# Expected response includes:
# - payment intent
# - compliance_decision with all engine results
# - ai_decision
# - fhe_check_result
# - zk_proof_reference
# - final_decision (approved/blocked/pending_review)
```

#### Verify Pipeline Results

```python
# From the analysis endpoint response, verify:

✅ Payment Status: pending | under_review | approved | blocked

✅ Compliance Decision Fields:
   - country_policy_result (JSON)
   - treasury_controls_result (JSON)
   - compliance_result (JSON)
   - wallet_risk_result (JSON)
   - issuer_risk_result (JSON)
   - chain_governance_result (JSON)
   - liquidity_result (JSON)

✅ AI Engine Results:
   - ai_decision: one of [direct_transfer, alternate_chain, ...]
   - ai_reasoning: non-empty string
   - ai_confidence: float ∈ [0.0, 1.0]
   - ai_flags: list of risk flags
   - ai_alternatives: list of alternative options
   - ai_engine_used: "ollama" | "groq"
   - ai_latency_ms: latency in milliseconds

✅ FHE Checks:
   - fhe_check_result.checks: array of checks
   - Each check has: check_id, label, threshold, result, method, encrypted_proof
   - fhe_check_result.overall_pass: boolean

✅ ZK Proofs:
   - zk_proof_reference.kyc_proof: valid structure
   - zk_proof_reference.amount_range_proof: exact amount not in public_inputs
   - zk_proof_reference.combined_proof_hash: SHA256 hash
   - zk_proof_reference.on_chain_tx: transaction hash on Base Sepolia
```

---

### Phase 9C: AI Engine Fallback Testing

#### Test Ollama → Groq Fallback

```bash
# 1. Kill Ollama service (simulate unavailability)
killall ollama

# 2. Create another payment
PAYMENT=$(curl -X POST http://localhost:8000/api/v1/payments/create ...)
PAYMENT_ID=$(echo $PAYMENT | jq -r '.id')

# 3. Wait 10 seconds for pipeline
sleep 10

# 4. Check AI result
curl http://localhost:8000/api/v1/ai/decision/$PAYMENT_ID \
  -H "Authorization: Bearer {token}"

# Expected:
# {
#   "decision": "...",
#   "engine_used": "groq"  ← Should be Groq, not Ollama
# }

# 5. Restart Ollama
ollama serve &
```

---

### Phase 9D: On-Chain Proof Verification

#### Verify Proof on Base Sepolia

```bash
# From payment analysis, extract:
BASESCAN_URL = response.zk_proof_reference.basescan_url

# Example: https://sepolia.basescan.org/tx/0xabcd...

# 1. Open in browser
# 2. Verify transaction is present
# 3. Verify To Address = SETTLEMENT_PROOF_REGISTRY_ADDRESS
# 4. Verify function call = registerProof
# 5. Verify proof_hash matches zk_proof_reference.combined_proof_hash

# Expected: Transaction visible on Basescan with correct function data
```

#### Query Proof from Contract

```python
from web3 import Web3
from app.services.blockchain.contract_service import ContractService

contract_service = ContractService()
proof_registry = contract_service.get_settlement_proof_registry_contract()

# Query proof
payment_id_bytes = Web3.to_bytes(hexstr=payment_id)
proof = proof_registry.functions.getProof(payment_id_bytes).call()

print(f"Proof exists: {proof_registry.functions.proofExists(payment_id_bytes).call()}")
print(f"Proof hash: {proof['zkProofHash'].hex()}")
```

---

### Phase 9E: Performance Testing

#### Load Test: 10 Concurrent Payments

```bash
# Script: test_load.sh

#!/bin/bash
for i in {1..10}; do
  curl -X POST http://localhost:8000/api/v1/payments/create \
    -H "Authorization: Bearer {token}" \
    -H "Content-Type: application/json" \
    -d "{
      \"sender_company\": \"Company_$i\",
      \"receiver_company\": \"Receiver_$i\",
      \"source_country\": \"Singapore\",
      \"destination_country\": \"UAE\",
      \"source_chain\": \"base_sepolia\",
      \"destination_chain\": \"polygon_amoy\",
      \"amount\": $(($i * 10000)),
      \"token\": \"USDC\",
      \"purpose\": \"Test Payment\",
      \"urgency\": \"High\"
    }" &
done

wait

echo "10 payments created. Waiting for processing..."
sleep 30

# Check completion
curl http://localhost:8000/api/v1/payments/ -H "Authorization: Bearer {token}" | jq '.[] | select(.status != "pending")'
```

**Metrics to Monitor**:
- Average pipeline execution time: < 10 seconds
- Redis cache hit rate: > 70%
- Neo4j query time: < 100ms
- AI response time: 2-5 seconds (Ollama), < 1 second (Groq)
- Memory usage: < 500MB
- CPU usage: < 80%

---

### Phase 9F: Failure Scenario Testing

#### Scenario 1: Neo4j Unavailable
```bash
# Kill Neo4j
# Create payment
# Verify: System degrades gracefully, wallet_risk_result includes error message
# Status: Payment still processes, but wallet risk not analyzed
```

#### Scenario 2: Redis Disconnected
```bash
# Kill Redis
# Create payment
# Verify: Pipeline completes without cache, slower but functional
# Status: Repeated queries are slower (no caching)
```

#### Scenario 3: AI JSON Parse Failure
```bash
# Manually corrupt AI response
# Verify: System falls back to manual_review decision
# Status: Decision saved as manual_review with error message
```

#### Scenario 4: Contract Call Fails
```bash
# Set invalid contract address in env
# Create payment
# Verify: Pipeline completes, but zk_proof_reference.on_chain_tx is null
# Status: Warning logged, proof not on-chain but stored in DB
```

---

### Phase 9G: Security & Compliance Audit

#### Check 1: PII Protection
```bash
# Create payment with wallet addresses in company names
# Grep backend logs for exact wallet addresses
# Expected: Addresses should be redacted as WALLET_0x12ab...REDACTED
```

#### Check 2: FHE Privacy
```bash
# Check FHE results in DB
SELECT fhe_check_result FROM compliance_decisions LIMIT 1;
# Expected: No exact payment amount in results (only comparison result)
```

#### Check 3: ZK Proof Privacy
```bash
# Check ZK proof in DB
SELECT zk_proof_reference FROM compliance_decisions LIMIT 1;
# Parse JSON
# Expected: Exact amount NOT in public_inputs (only in private_inputs_hash)
```

#### Check 4: Policy Veto
```bash
# Create payment from sanctioned country
# Verify: final_decision = blocked
# Expected: AI decision is ignored, policy veto overrides
```

---

## 📊 MONITORING & DEBUGGING

### Enable Logging

```python
# In backend/app/main.py (add)
import logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

### Key Logs to Watch

```
✅ Pipeline start: "Running payment pipeline for payment_id={id}"
✅ Engine results: "Country policy result: {result}"
✅ AI analysis: "AI Decision: {decision} (confidence: {conf})"
✅ FHE checks: "FHE checks completed - overall_pass={pass}"
✅ ZK proofs: "ZK proofs generated - combined_hash={hash}"
✅ On-chain: "Proof registered on-chain - tx_hash={tx}"
✅ Status update: "Payment status updated to {status}"
```

### Database Inspection

```bash
# Using sqlite3
sqlite3 backend/settleguard.db

# List tables
.tables

# Query recent payments
SELECT id, sender_company, receiver_company, amount, status FROM payment_intents ORDER BY created_at DESC LIMIT 5;

# Query compliance decisions
SELECT payment_id, ai_decision, final_decision FROM compliance_decisions ORDER BY created_at DESC LIMIT 5;

# Check FHE results
SELECT payment_id, json_extract(fhe_check_result, '$.overall_pass') FROM compliance_decisions LIMIT 5;
```

---

## ✅ PHASE 9 SUCCESS CRITERIA

Mark complete when all pass:

```
□ Health endpoints responding
□ Authentication working
□ Single payment created and processed
□ Pipeline execution < 15 seconds
□ All engine results populated
□ AI decision generated correctly
□ FHE checks running
□ ZK proofs generated
□ On-chain proof registered
□ Payment status updated
□ 10 concurrent payments handled
□ Ollama → Groq fallback working
□ Neo4j graceful degradation verified
□ Redis cache beneficial
□ PII properly redacted
□ FHE privacy verified
□ ZK privacy verified
□ Policy veto overriding correctly
□ Audit logs complete
□ No critical errors in logs
```

---

## 🎯 PHASE 9 COMPLETION

When all success criteria are met:

1. **Generate Final Report**
   - Document test results
   - Record metrics
   - Note any issues found

2. **Create Deployment Plan**
   - Infrastructure requirements
   - Scaling considerations
   - Monitoring setup

3. **Prepare for Phase 10**
   - UI/UX refinements
   - Performance optimization
   - Security hardening

---

## 📞 TROUBLESHOOTING

### Common Issues & Solutions

**Issue**: `Backend port 8000 already in use`
```bash
# Solution: Kill existing process
lsof -i :8000 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

**Issue**: `Neo4j connection failed`
```bash
# Solution: Check URI and credentials in .env
# Verify network connectivity
nc -zv your-neo4j-uri 7687
```

**Issue**: `Redis connection refused`
```bash
# Solution: Start Redis
redis-server
```

**Issue**: `Ollama not responding`
```bash
# Solution: Start Ollama
ollama serve &
ollama pull gemma:2b  # if needed
```

**Issue**: `Contracts not found in artifacts`
```bash
# Solution: Ensure contracts built
cd contracts/
forge build
# Check contracts/out/ directory exists
```

---

## 📝 DOCUMENTATION

Created during this validation:

1. ✅ **PHASE_9_VALIDATION_REPORT.md** - Comprehensive technical audit
2. ✅ **PHASE_9_EXECUTIVE_SUMMARY.md** - High-level overview
3. ✅ **PHASE_9_DETAILED_CHECKLIST.md** - Item-by-item verification
4. ✅ **PHASE_9_DEPLOYMENT_GUIDE.md** - This document
5. ✅ **PHASE_9_VALIDATION_AUDIT.py** - Automated test script (ready to run)

---

## 🚀 NEXT STEPS

**Immediately**:
1. Review all validation documents
2. Start backend and frontend services
3. Run through Phase 9A health checks
4. Proceed with Phase 9B end-to-end test

**After Initial Testing**:
1. Run load tests (Phase 9E)
2. Validate failure scenarios (Phase 9F)
3. Audit security (Phase 9G)
4. Document findings

**Upon Completion**:
1. Create Phase 9 completion report
2. Plan Phase 10 activities
3. Schedule Phase 10 kick-off meeting
4. Archive validation artifacts

---

**Status**: ✅ READY TO BEGIN PHASE 9 TESTING

**Estimated Duration**: 1-2 weeks for comprehensive testing

**Resources Required**:
- Backend server (localhost:8000)
- Frontend dev server (localhost:5173)
- Database (local SQLite)
- External services (Ollama, Redis, Neo4j, Groq, Alchemy RPC)

**Success Metric**: All 35 validation checks remain PASS throughout Phase 9

---

**Document Generated**: 2026-04-29  
**Status**: READY FOR PHASE 9 OPERATIONS 🚀
