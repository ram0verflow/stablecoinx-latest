#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

echo "==> Resetting demo data"

# FIXED: L3
if [ "${APP_ENV:-}" != "demo" ]; then
  echo "ERROR: reset_demo.sh only runs when APP_ENV=demo"
  exit 1
fi
cd "$BACKEND_DIR"

python - <<'PY'
from app.db.database import SessionLocal
from app.models.approvals import Approval
from app.models.alerts import Alert
from app.models.audit_records import AuditRecord
from app.models.compliance_decisions import ComplianceDecision
from app.models.payment_intents import PaymentIntent
from app.models.revalidation_records import RevalidationRecord

db = SessionLocal()
try:
    db.query(Approval).delete()
    db.query(Alert).delete()
    db.query(AuditRecord).delete()
    db.query(RevalidationRecord).delete()
    db.query(ComplianceDecision).delete()
    db.query(PaymentIntent).delete()
    db.commit()
finally:
    db.close()
PY

if command -v redis-cli >/dev/null 2>&1; then
  redis-cli FLUSHALL >/dev/null 2>&1 || true
fi

python -m app.db.seed

echo "Demo reset complete"
