"""PDF Report Generator — creates professional compliance audit reports using ReportLab."""

import os
from datetime import datetime, timezone
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    HRFlowable,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

from config import settings


def _severity_color(severity: str) -> colors.Color:
    """Map severity to a display color."""
    return {
        "critical": colors.HexColor("#dc2626"),
        "high": colors.HexColor("#ea580c"),
        "medium": colors.HexColor("#ca8a04"),
        "low": colors.HexColor("#2563eb"),
        "info": colors.HexColor("#6b7280"),
    }.get(severity, colors.black)


def _status_text(status: str) -> str:
    """Map status to display text."""
    return {
        "pass": "✓ PASS",
        "fail": "✗ FAIL",
        "warning": "⚠ WARNING",
        "not_applicable": "— N/A",
    }.get(status, status.upper())


def generate_pdf_report(
    device_info: dict,
    audit_results: list[dict],
    score_summary: dict,
    framework: str,
    report_id: int,
) -> str:
    """Generate a PDF compliance audit report.

    Args:
        device_info: Device metadata dict (hostname, vendor, model, etc.)
        audit_results: List of compliance result dicts from the engine.
        score_summary: Score summary dict with pass/fail/score counts.
        framework: Compliance framework name (CIS, NIST, STIG).
        report_id: Unique report ID for filename.

    Returns:
        Absolute file path of the generated PDF.
    """
    settings.ensure_dirs()

    filename = f"compliance_report_{report_id}_{framework}_{device_info.get('hostname', 'device')}.pdf"
    filepath = settings.REPORTS_DIR / filename

    doc = SimpleDocTemplate(
        str(filepath),
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    styles.add(ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        fontSize=24,
        textColor=colors.HexColor("#1e293b"),
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontSize=14,
        textColor=colors.HexColor("#64748b"),
        alignment=TA_CENTER,
        spaceAfter=20,
    ))
    styles.add(ParagraphStyle(
        "SectionHeader",
        parent=styles["Heading2"],
        fontSize=16,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=16,
        spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        "SmallText",
        parent=styles["Normal"],
        fontSize=8,
        textColor=colors.HexColor("#94a3b8"),
    ))

    elements = []

    # ---- Cover Page ----
    elements.append(Spacer(1, 60))
    elements.append(Paragraph("Network Security", styles["ReportTitle"]))
    elements.append(Paragraph("Compliance Audit Report", styles["ReportTitle"]))
    elements.append(Spacer(1, 10))
    elements.append(HRFlowable(width="80%", thickness=2, color=colors.HexColor("#3b82f6")))
    elements.append(Spacer(1, 20))
    elements.append(Paragraph(f"Framework: {framework}", styles["ReportSubtitle"]))
    elements.append(Paragraph(
        f"Device: {device_info.get('hostname', 'Unknown')} ({device_info.get('vendor', 'Unknown')})",
        styles["ReportSubtitle"],
    ))
    elements.append(Paragraph(
        f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        styles["ReportSubtitle"],
    ))
    elements.append(Spacer(1, 40))

    # Score summary box
    score = score_summary.get("compliance_score", 0)
    score_color = (
        colors.HexColor("#16a34a") if score >= 80
        else colors.HexColor("#ca8a04") if score >= 50
        else colors.HexColor("#dc2626")
    )

    score_data = [
        ["Compliance Score", f"{score}%"],
        ["Total Rules", str(score_summary.get("total_rules", 0))],
        ["Passed", str(score_summary.get("passed", 0))],
        ["Failed", str(score_summary.get("failed", 0))],
        ["Warnings", str(score_summary.get("warnings", 0))],
        ["Not Applicable", str(score_summary.get("not_applicable", 0))],
    ]

    score_table = Table(score_data, colWidths=[200, 100])
    score_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("TEXTCOLOR", (1, 0), (1, 0), score_color),
        ("FONTSIZE", (0, 0), (-1, 0), 14),
        ("FONTSIZE", (0, 1), (-1, -1), 11),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(score_table)

    elements.append(PageBreak())

    # ---- Device Information ----
    elements.append(Paragraph("Device Information", styles["SectionHeader"]))

    device_data = [
        ["Property", "Value"],
        ["Hostname", device_info.get("hostname", "Unknown")],
        ["Vendor", device_info.get("vendor", "Unknown").title()],
        ["Model", device_info.get("model", "Unknown")],
        ["OS Version", device_info.get("os_version", "Unknown")],
        ["Serial Number", device_info.get("serial_number", "Unknown")],
        ["Device Type", device_info.get("device_type", "Unknown").title()],
    ]

    device_table = Table(device_data, colWidths=[150, 350])
    device_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334155")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(device_table)
    elements.append(Spacer(1, 20))

    # ---- Findings by Severity ----
    elements.append(Paragraph("Findings Summary", styles["SectionHeader"]))

    for severity in ["critical", "high", "medium", "low"]:
        sev_results = [r for r in audit_results if r.get("severity") == severity and r.get("status") == "fail"]
        if sev_results:
            sev_color = _severity_color(severity)
            elements.append(Paragraph(
                f"<font color='{sev_color.hexval()}'>{severity.upper()}</font> — {len(sev_results)} finding(s)",
                styles["Heading3"],
            ))

            findings_data = [["Rule ID", "Rule Name", "Status", "Category"]]
            for r in sev_results:
                findings_data.append([
                    r.get("rule_id", ""),
                    Paragraph(r.get("rule_name", ""), styles["Normal"]),
                    _status_text(r.get("status", "")),
                    r.get("category", ""),
                ])

            findings_table = Table(findings_data, colWidths=[80, 230, 70, 100])
            findings_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#475569")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fff1f2")]),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]))
            elements.append(findings_table)
            elements.append(Spacer(1, 10))

    elements.append(PageBreak())

    # ---- Detailed Results ----
    elements.append(Paragraph("Detailed Compliance Results", styles["SectionHeader"]))

    all_data = [["Rule ID", "Rule Name", "Status", "Severity", "Actual", "Expected"]]
    for r in audit_results:
        status = r.get("status", "")
        status_text = _status_text(status)
        all_data.append([
            r.get("rule_id", ""),
            Paragraph(r.get("rule_name", ""), styles["Normal"]),
            status_text,
            r.get("severity", "").upper(),
            Paragraph(str(r.get("actual_value", "N/A"))[:50], styles["Normal"]),
            Paragraph(str(r.get("expected_value", "N/A"))[:50], styles["Normal"]),
        ])

    if len(all_data) > 1:
        all_table = Table(all_data, colWidths=[65, 155, 55, 55, 80, 80])
        all_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        elements.append(all_table)

    elements.append(Spacer(1, 20))

    # ---- Remediation Section ----
    failed_results = [r for r in audit_results if r.get("status") == "fail"]
    if failed_results:
        elements.append(PageBreak())
        elements.append(Paragraph("Remediation Recommendations", styles["SectionHeader"]))

        for r in failed_results:
            elements.append(Paragraph(
                f"<b>{r.get('rule_id', '')}</b> — {r.get('rule_name', '')}",
                styles["Normal"],
            ))
            if remediation := r.get("remediation"):
                elements.append(Paragraph(
                    f"<font face='Courier' size='9'>{remediation}</font>",
                    ParagraphStyle("Remediation", parent=styles["Normal"], leftIndent=20, spaceBefore=4, spaceAfter=8),
                ))
            elements.append(Spacer(1, 4))

    # ---- Footer ----
    elements.append(Spacer(1, 30))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cbd5e1")))
    elements.append(Paragraph(
        f"Report generated by AI Network Compliance Auditor | {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        styles["SmallText"],
    ))

    doc.build(elements)
    return str(filepath)
