import sys
import os

# Add the backend dir to sys.path so app modules can be found
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal
from app.models.alerts import Alert
from app.models.approvals import Approval
from app.models.audit_records import AuditRecord
from app.models.compliance_decisions import ComplianceDecision
from app.models.payment_intents import PaymentIntent
from app.models.revalidation_records import RevalidationRecord

def wipe_db():
    db = SessionLocal()
    try:
        db.query(Alert).delete()
        db.query(Approval).delete()
        db.query(AuditRecord).delete()
        db.query(ComplianceDecision).delete()
        db.query(RevalidationRecord).delete()
        db.query(PaymentIntent).delete()
        db.commit()
        print("Successfully wiped all transactional data (Alerts, Approvals, Audits, Decisions, Revalidations, Payments). Users and Policy Rules were kept.")
    except Exception as e:
        print("Error wiping db:", e)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    wipe_db()
