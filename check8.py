import sys, os, inspect
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend'))
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend'))
from dotenv import load_dotenv
load_dotenv('../.env')
from app.services.reports.report_service import AuditReportService

src = inspect.getsource(AuditReportService._create_compliance_decision)

reads_country = 'country_policy_result' in src or 'country' in src
reads_wallet  = 'wallet_risk_result' in src or 'wallet' in src
reads_fhe     = 'fhe_check_result' in src or 'fhe' in src
reads_zk      = 'zk_proof_reference' in src or 'zk' in src

# Check no hardcoded all-PASS rows
hardcoded_pass = ('Corridor allowed' in src and 'country' not in src.lower())

print('Reads country_policy_result:', reads_country)
print('Reads wallet_risk_result:', reads_wallet)
print('Reads fhe_check_result:', reads_fhe)
print('Reads zk_proof_reference:', reads_zk)
print('Hardcoded PASS (bad):', hardcoded_pass)

if all([reads_country, reads_wallet, reads_fhe, reads_zk]) and not hardcoded_pass:
    print('CHECK 8: PASS')
else:
    print('CHECK 8: FAIL')
