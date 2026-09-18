"""
Report service module - proxy to full implementation.
PDF report generation uses ReportLab.
"""

import logging
import io
from typing import Optional
from datetime import datetime, timezone
from uuid import UUID

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak,
)
from reportlab.lib.enums import TA_CENTER

from sqlalchemy.orm import Session

from app.models.payment_intents import PaymentIntent
from app.models.compliance_decisions import ComplianceDecision
from app.models.audit_records import AuditRecord
from app.models.approvals import Approval

logger = logging.getLogger(__name__)


def _enum_val(val) -> str:
    """Safely extract string value from enum or return string directly."""
    if val is None:
        return "N/A"
    if hasattr(val, "value"):
        return str(val.value)
    return str(val)


class AuditReportService:
    """Service for generating PDF audit reports."""

    PAGE_SIZE = letter
    MARGIN = 0.5 * inch

    @staticmethod
    def generate_audit_report(db: Session, payment_id: UUID) -> Optional[bytes]:
        """Generate a comprehensive PDF audit report for a payment."""
        try:
            payment = db.query(PaymentIntent).filter(
                PaymentIntent.id == payment_id
            ).first()
            
            if not payment:
                logger.error(f"Payment not found: {payment_id}")
                return None

            decision = db.query(ComplianceDecision).filter(
                ComplianceDecision.payment_id == payment_id
            ).first()

            audit_record = db.query(AuditRecord).filter(
                AuditRecord.payment_id == payment_id
            ).first()

            approvals = db.query(Approval).filter(
                Approval.payment_id == payment_id
            ).order_by(Approval.created_at).all()

            # Generate PDF
            pdf_bytes = AuditReportService._generate_pdf(
                payment=payment,
                decision=decision,
                audit_record=audit_record,
                approvals=approvals,
            )

            return pdf_bytes

        except Exception as e:
            logger.error(f"Error generating audit report: {str(e)}")
            return None

    @staticmethod
    def _generate_pdf(payment, decision, audit_record, approvals) -> bytes:
        """Generate PDF document."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=AuditReportService.PAGE_SIZE,
            rightMargin=AuditReportService.MARGIN,
            leftMargin=AuditReportService.MARGIN,
            topMargin=AuditReportService.MARGIN,
            bottomMargin=AuditReportService.MARGIN,
        )

        story = []
        styles = getSampleStyleSheet()

        # Page 1: Cover
        story.extend(AuditReportService._create_cover_page(styles))
        story.append(PageBreak())

        # Page 2: Payment Summary
        story.extend(AuditReportService._create_payment_summary(payment, styles))
        story.append(PageBreak())

        # Page 3: Compliance Decision
        if decision:
            story.extend(AuditReportService._create_compliance_decision(decision, styles))
            story.append(PageBreak())

        # Page 4: AI Decision Detail
        if decision:
            story.extend(AuditReportService._create_ai_decision(decision, styles))
            story.append(PageBreak())

        # Page 5: Privacy Proofs
        if decision:
            story.extend(AuditReportService._create_privacy_proofs(decision, styles))
            story.append(PageBreak())

        # Page 6: Approval Chain
        story.extend(AuditReportService._create_approval_chain(approvals, styles))
        story.append(PageBreak())

        # Page 7: On-Chain Evidence
        if audit_record:
            story.extend(AuditReportService._create_on_chain_evidence(audit_record, payment, styles))
            story.append(PageBreak())

        # Page 8: Certification
        if decision:
            story.extend(AuditReportService._create_certification(decision, styles))

        # Build PDF
        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()

        return pdf_bytes

    @staticmethod
    def _create_cover_page(styles) -> list:
        """Create cover page."""
        elements = []
        
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=28,
            textColor=colors.HexColor('#1f2937'),
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold',
        )

        subtitle_style = ParagraphStyle(
            'CustomSubtitle',
            parent=styles['Normal'],
            fontSize=16,
            textColor=colors.HexColor('#4b5563'),
            spaceAfter=60,
            alignment=TA_CENTER,
        )

        # Logo placeholder
        logo_table = Table([["SettleGuard"]], colWidths=[2 * inch])
        logo_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 20),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#0066cc')),
        ]))
        elements.append(logo_table)
        elements.append(Spacer(1, 0.5 * inch))

        elements.append(Paragraph("Compliance Audit Report", title_style))
        elements.append(Paragraph("Stablecoin Settlement Orchestration", subtitle_style))
        elements.append(Spacer(1, 0.3 * inch))

        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        details = [
            ["Report ID:", f"RPT-{int(datetime.now(timezone.utc).timestamp())}"],
            ["Generated:", timestamp],
            ["Classification:", "CONFIDENTIAL"],
        ]

        details_table = Table(details, colWidths=[1.5 * inch, 3 * inch])
        details_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
        ]))
        elements.append(details_table)

        return elements

    @staticmethod
    def _create_payment_summary(payment, styles) -> list:
        """Create payment summary page."""
        elements = []

        title_style = ParagraphStyle(
            'PageTitle',
            parent=styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#1f2937'),
            spaceAfter=12,
            fontName='Helvetica-Bold',
        )

        elements.append(Paragraph("Payment Summary", title_style))
        elements.append(Spacer(1, 0.2 * inch))

        payment_details = [
            ["Field", "Value"],
            ["Sender", str(payment.sender_company)],
            ["Receiver", str(payment.receiver_company)],
            ["Corridor", f"{payment.source_country} → {payment.destination_country}"],
            ["Amount", f"{payment.amount} {payment.token}"],
            ["Purpose", _enum_val(payment.purpose)],
            ["Urgency", _enum_val(payment.urgency)],
            ["Status", _enum_val(payment.status)],
            ["Created", payment.created_at.strftime("%Y-%m-%d %H:%M:%S UTC")],
        ]

        table = Table(payment_details, colWidths=[1.5 * inch, 3.5 * inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e5e7eb')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9fafb')]),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d1d5db')),
        ]))
        elements.append(table)

        return elements

    @staticmethod
    def _create_compliance_decision(decision, styles) -> list:
        """Create compliance decision page."""
        import json

        def parse_result(field_value):
            """Parse JSON field safely, return dict or empty dict."""
            if field_value is None:
                return {}
            if isinstance(field_value, dict):
                return field_value
            try:
                return json.loads(field_value)
            except Exception:
                return {}

        def get_status(result_dict, pass_keys, fail_keys=None):
            """
            Determine PASS/FAIL from result dict.
            pass_keys: list of keys where True means pass
            fail_keys: list of keys where True means fail
            """
            if not result_dict:
                return "⚠ NO DATA"

            if fail_keys:
                for key in fail_keys:
                    if result_dict.get(key) is True:
                        return "✗ FAIL"

            for key in pass_keys:
                val = result_dict.get(key)
                if val is False:
                    return "✗ FAIL"
                if val == "fail" or val == "missing" or val == "expired":
                    return "✗ FAIL"

            overall = result_dict.get("overall", result_dict.get("status", ""))
            if overall in ("fail", "blocked", "missing", "expired"):
                return "✗ FAIL"
            if overall in ("pass", "verified", "approved"):
                return "✓ PASS"

            return "✓ PASS"

        country = parse_result(decision.country_policy_result)
        treasury = parse_result(decision.treasury_controls_result)  # FIXED: C4
        compliance = parse_result(decision.compliance_result)  # FIXED: C4
        wallet = parse_result(decision.wallet_risk_result)
        issuer = parse_result(decision.issuer_risk_result)
        chain = parse_result(decision.chain_governance_result)
        liquidity = parse_result(decision.liquidity_result)
        fhe = parse_result(decision.fhe_check_result)
        zk = parse_result(decision.zk_proof_reference)
        ai_decision = _enum_val(decision.ai_decision)
        final_decision = _enum_val(decision.final_decision)

        elements = []

        title_style = ParagraphStyle(
            'PageTitle',
            parent=styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#1f2937'),
            spaceAfter=12,
            fontName='Helvetica-Bold',
        )

        elements.append(Paragraph("Compliance Engine Results", title_style))
        elements.append(Spacer(1, 0.2 * inch))

        results = [
            ["Engine", "Result", "Status", "Notes"],
            [
                "Country Policy Governance",
                "✓" if get_status(country, ["is_allowed"], ["sanctions_restricted"]).startswith("✓") else "✗",
                get_status(country, ["is_allowed"], ["sanctions_restricted"]),
                (
                    f"Corridor: {'Allowed' if country.get('is_allowed') else 'Blocked'} | "
                    f"KYC: {'Required' if country.get('requires_kyc') else 'Not required'}"
                    if country else "No data"
                ),
            ],
            [
                "Corporate Treasury Controls",
                "✓" if get_status(treasury, ["daily_limit_ok", "vendor_approved", "department_budget_ok"], []).startswith("✓") else "✗",
                get_status(treasury, ["daily_limit_ok", "vendor_approved", "department_budget_ok"], []),
                (
                    f"Daily limit: {'OK' if treasury.get('daily_limit_ok') else 'EXCEEDED'} | "
                    f"Dual approval: {'Required' if treasury.get('dual_approval_required') else 'Not required'}"
                    if treasury else "No data"
                ),
            ],
            [
                "KYC/KYB Compliance",
                "✓" if get_status(compliance, [], ["sanctions_hit", "internal_blacklist_hit", "expired_docs"]).startswith("✓") else "✗",
                get_status(compliance, [], ["sanctions_hit", "internal_blacklist_hit", "expired_docs"]),
                (
                    f"KYC: {compliance.get('kyc_status', 'N/A')} | "
                    f"Sanctions: {'HIT' if compliance.get('sanctions_hit') else 'Clear'}"
                    if compliance else "No data"
                ),
            ],
            [
                "Wallet Graph Intelligence",
                "✗" if (wallet.get("overall_risk") in ("high", "critical") or wallet.get("mixer_adjacent") or wallet.get("laundering_cluster")) else "✓",
                "✗ FAIL" if (wallet.get("overall_risk") in ("high", "critical") or wallet.get("mixer_adjacent") or wallet.get("laundering_cluster")) else "✓ PASS",
                (
                    f"Risk: {wallet.get('overall_risk', 'N/A').upper()} | "
                    f"Score: {wallet.get('risk_score', 'N/A')} | "
                    f"Mixer: {'Yes' if wallet.get('mixer_adjacent') else 'No'}"
                    if wallet else "No data"
                ),
            ],
            [
                "Stablecoin Issuer Risk",
                "✓" if issuer.get("recommendation") in ("preferred", "acceptable") else "✗",
                "✓ PASS" if issuer.get("recommendation") in ("preferred", "acceptable") else "✗ FAIL",
                (
                    f"Token: {issuer.get('token', 'N/A')} | "
                    f"Freeze risk: {issuer.get('issuer_freeze_risk', 'N/A')} | "
                    f"Score: {issuer.get('score', 'N/A')}"
                    if issuer else "No data"
                ),
            ],
            [
                "Cross-Chain Governance",
                "✓" if get_status(chain, ["is_allowed"]).startswith("✓") else "✗",
                get_status(chain, ["is_allowed"]),
                (
                    f"Chain allowed: {'Yes' if chain.get('is_allowed') else 'No'} | "
                    f"Bridge trust: {chain.get('bridge_trust_score', 'N/A')} | "
                    f"Regulator comfort: {chain.get('regulator_comfort', 'N/A')}"
                    if chain else "No data"
                ),
            ],
            [
                "Liquidity Analysis",
                "✓" if liquidity.get("recommended_route") else "⚠",
                "✓ PASS" if liquidity.get("recommended_route") else "⚠ PARTIAL",
                (
                    f"Route: {liquidity.get('recommended_route', 'N/A')} | "
                    f"Cost: ${liquidity.get('estimated_cost_usd', 'N/A')} | "
                    f"ETA: {liquidity.get('eta_minutes', 'N/A')} min"
                    if liquidity else "No data"
                ),
            ],
            [
                "AI Decision Engine",
                "✓" if ai_decision not in ("block", "N/A") else "✗",
                "✓ PASS" if ai_decision not in ("block", "N/A") else "✗ FAIL",
                f"Decision: {ai_decision} | Confidence: {round(float(decision.ai_confidence or 0) * 100, 1)}%",
            ],
            [
                "Policy Final Veto",
                "✓" if final_decision in ("approved",) else "✗",
                "✓ PASS" if final_decision in ("approved",) else "✗ BLOCKED",
                f"Final: {final_decision.upper()} | Policy version: {decision.policy_version or 'N/A'}",
            ],
            [
                "FHE Private Checks",
                "✓" if all(c.get("result") is not False for c in (fhe.get("checks", []) if isinstance(fhe.get("checks"), list) else [])) else "⚠",
                "✓ PASS" if all(c.get("result") is not False for c in (fhe.get("checks", []) if isinstance(fhe.get("checks"), list) else [])) else "⚠ CHECK RESULTS",
                (
                    f"Checks run: {len(fhe.get('checks', []))} | "
                    f"Method: {fhe.get('method', 'simulated')}"
                    if fhe else "No FHE data"
                ),
            ],
            [
                "ZK Proof Generation",
                "✓" if zk.get("is_valid") or zk.get("kyc_proof") else "⚠",
                "✓ PASS" if zk.get("is_valid") or zk.get("kyc_proof") else "⚠ NO PROOF",
                (
                    f"Proof hash: {str(zk.get('proof_hash', zk.get('combined_hash', 'N/A')))[:24]}..."
                    if zk else "No ZK data"
                ),
            ],
        ]

        table = Table(results, colWidths=[1.8 * inch, 0.8 * inch, 0.8 * inch, 1.6 * inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e5e7eb')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9fafb')]),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d1d5db')),
        ]))
        elements.append(table)

        return elements

    @staticmethod
    def _create_ai_decision(decision, styles) -> list:
        """Create AI decision detail page."""
        elements = []

        title_style = ParagraphStyle(
            'PageTitle',
            parent=styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#1f2937'),
            spaceAfter=12,
            fontName='Helvetica-Bold',
        )

        elements.append(Paragraph("AI Decision Analysis", title_style))
        elements.append(Spacer(1, 0.2 * inch))

        ai_details = [
            ["AI Engine", decision.ai_engine_used or "ollama"],
            ["Decision", _enum_val(decision.ai_decision)],
            ["Confidence", f"{decision.ai_confidence}%" if decision.ai_confidence else "N/A"],
        ]

        table = Table(ai_details, colWidths=[1.5 * inch, 3.5 * inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e5e7eb')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9fafb')]),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d1d5db')),
        ]))
        elements.append(table)

        elements.append(Spacer(1, 0.2 * inch))
        elements.append(Paragraph("<b>Decision Reasoning:</b>", styles['Normal']))
        elements.append(Spacer(1, 0.1 * inch))
        reasoning_text = decision.ai_reasoning or "No reasoning provided"
        elements.append(Paragraph(reasoning_text, styles['Normal']))

        return elements

    @staticmethod
    def _create_privacy_proofs(decision, styles) -> list:
        """Create privacy proofs page."""
        elements = []

        title_style = ParagraphStyle(
            'PageTitle',
            parent=styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#1f2937'),
            spaceAfter=12,
            fontName='Helvetica-Bold',
        )

        elements.append(Paragraph("Privacy & Security Proofs", title_style))
        elements.append(Spacer(1, 0.2 * inch))

        elements.append(Paragraph("<b>FHE Threshold Checks:</b>", styles['Normal']))
        fhe_checks = AuditReportService._create_fhe_table(decision)

        fhe_table = Table(fhe_checks, colWidths=[1.5 * inch, 1.2 * inch, 1.2 * inch, 1.1 * inch])
        fhe_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e5e7eb')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d1d5db')),
        ]))
        elements.append(fhe_table)

        elements.append(Spacer(1, 0.2 * inch))

        elements.append(Paragraph("<b>ZK Proofs:</b>", styles['Normal']))
        zk_proofs = AuditReportService._create_zk_proof_table(decision)

        zk_table = Table(zk_proofs, colWidths=[1.6 * inch, 1.1 * inch, 1.8 * inch])
        zk_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e5e7eb')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d1d5db')),
        ]))
        elements.append(zk_table)

        return elements

    @staticmethod
    def _create_fhe_table(decision) -> list:
        import json

        fhe_raw = decision.fhe_check_result
        if not fhe_raw:
            return [
                ["Check", "Threshold", "Result", "Method"],
                ["FHE Data", "N/A", "⚠ Not run", "N/A"],
            ]

        try:
            fhe = json.loads(fhe_raw) if isinstance(fhe_raw, str) else fhe_raw
        except Exception:
            return [
                ["Check", "Threshold", "Result", "Method"],
                ["FHE Data", "N/A", "⚠ Parse error", "N/A"],
            ]

        checks = fhe.get("checks", [])
        rows = [["Check", "Threshold", "Result", "Method"]]

        if not checks:
            for key, value in fhe.items():
                if key == "method":
                    continue
                rows.append([
                    key.replace("_", " ").title(),
                    "N/A",
                    "✓ PASS" if value is True or value == "pass"
                    else "✗ FAIL" if value is False or value == "fail"
                    else str(value),
                    fhe.get("method", "simulated"),
                ])
        else:
            for check in checks:
                result_bool = check.get("result")
                if result_bool is True:
                    result_str = "✓ PASS"
                elif result_bool is False:
                    result_str = "✗ FAIL"
                else:
                    result_str = "⚠ UNKNOWN"

                threshold = check.get("threshold", "N/A")
                if isinstance(threshold, (int, float)):
                    threshold = f"${threshold:,.0f}"

                rows.append([
                    check.get("check_label", check.get("label", "Unknown check")),
                    threshold,
                    result_str,
                    check.get("method", fhe.get("method", "simulated")),
                ])

        if len(rows) == 1:
            rows.append(["No FHE checks recorded", "N/A", "N/A", "N/A"])

        return rows

    @staticmethod
    def _create_zk_proof_table(decision) -> list:
        import json

        zk_raw = decision.zk_proof_reference
        if not zk_raw:
            return [
                ["Proof Type", "Status", "Proof Hash"],
                ["KYC Verified Proof", "⚠ Not generated", "N/A"],
                ["Amount Range Proof", "⚠ Not generated", "N/A"],
                ["Approval Proof", "⚠ Not generated", "N/A"],
            ]

        try:
            zk = json.loads(zk_raw) if isinstance(zk_raw, str) else zk_raw
        except Exception:
            return [
                ["Proof Type", "Status", "Proof Hash"],
                ["ZK Data", "⚠ Parse error", str(zk_raw)[:40]],
            ]

        def format_hash(h):
            if not h:
                return "N/A"
            h = "".join(ch for ch in str(h).lower() if ch in "0123456789abcdef")
            if not h:
                return "N/A"
            return h[:24] + "..." if len(h) > 24 else h

        def proof_status(proof_dict):
            if not proof_dict:
                return "⚠ Missing"
            if proof_dict.get("is_valid") is False:
                return "✗ Invalid"
            if proof_dict.get("proof_hash") or proof_dict.get("hash"):
                return "✓ Valid"
            return "⚠ Unknown"

        kyc_proof = zk.get("kyc_proof", {})
        amount_proof = zk.get("amount_range_proof", {})
        approval_proof = zk.get("approval_proof", {})
        combined_hash = zk.get("combined_hash", zk.get("proof_hash", ""))

        rows = [
            ["Proof Type", "Status", "Proof Hash"],
            [
                "KYC Verified Proof",
                proof_status(kyc_proof),
                format_hash(kyc_proof.get("proof_hash") if kyc_proof else None),
            ],
            [
                "Amount Range Proof",
                proof_status(amount_proof),
                format_hash(amount_proof.get("proof_hash") if amount_proof else None),
            ],
            [
                "Approval Proof",
                proof_status(approval_proof),
                format_hash(approval_proof.get("proof_hash") if approval_proof else None),
            ],
            [
                "Combined Proof Bundle",
                "✓ Valid" if combined_hash else "⚠ Missing",
                format_hash(combined_hash),
            ],
        ]
        return rows

    @staticmethod
    def _create_approval_chain(approvals, styles) -> list:
        """Create approval chain page."""
        elements = []

        title_style = ParagraphStyle(
            'PageTitle',
            parent=styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#1f2937'),
            spaceAfter=12,
            fontName='Helvetica-Bold',
        )

        elements.append(Paragraph("Approval Chain", title_style))
        elements.append(Spacer(1, 0.2 * inch))

        if not approvals:
            elements.append(Paragraph("No approvals recorded.", styles['Normal']))
        else:
            approval_data = [["Reviewer", "Action", "Timestamp", "Notes"]]

            for approval in approvals:
                approval_data.append([
                    f"{approval.reviewer_id}",
                    _enum_val(approval.action),
                    approval.created_at.strftime("%Y-%m-%d %H:%M:%S UTC"),
                    approval.notes or "-",
                ])

            table = Table(approval_data, colWidths=[1.2 * inch, 1 * inch, 1.5 * inch, 1.3 * inch])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e5e7eb')),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d1d5db')),
            ]))
            elements.append(table)

        return elements

    @staticmethod
    def _create_on_chain_evidence(audit_record, payment, styles) -> list:
        """Create on-chain evidence page."""
        elements = []

        title_style = ParagraphStyle(
            'PageTitle',
            parent=styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#1f2937'),
            spaceAfter=12,
            fontName='Helvetica-Bold',
        )

        elements.append(Paragraph("On-Chain Settlement Evidence", title_style))
        elements.append(Spacer(1, 0.2 * inch))

        evidence = [
            ["Field", "Value"],
            ["TX Hash", audit_record.tx_hash or "Pending"],
            ["Chain", payment.destination_chain],
            ["Proof Hash", audit_record.on_chain_proof_hash or "N/A"],
            ["Explorer", f"https://sepolia.basescan.org/tx/{audit_record.tx_hash[:10]}..." if audit_record.tx_hash else "N/A"],
        ]

        table = Table(evidence, colWidths=[1.5 * inch, 3.5 * inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e5e7eb')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d1d5db')),
        ]))
        elements.append(table)

        return elements

    @staticmethod
    def _create_certification(decision, styles) -> list:
        """Create certification page."""
        elements = []

        title_style = ParagraphStyle(
            'PageTitle',
            parent=styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#1f2937'),
            spaceAfter=12,
            fontName='Helvetica-Bold',
        )

        elements.append(Paragraph("Certification", title_style))
        elements.append(Spacer(1, 0.3 * inch))

        cert_text = (
            "This report certifies that the above payment was processed in compliance "
            "with all applicable regulatory policies and internal controls."
        )
        elements.append(Paragraph(cert_text, styles['Normal']))

        elements.append(Spacer(1, 0.2 * inch))

        cert_details = [
            ["Policy Version", decision.policy_version or "1.0.0"],
            ["Report Generated", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")],
            ["System Version", "1.0.0"],
            ["Status", _enum_val(decision.final_decision)],
        ]

        table = Table(cert_details, colWidths=[1.5 * inch, 3.5 * inch])
        table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d1d5db')),
        ]))
        elements.append(table)

        return elements
