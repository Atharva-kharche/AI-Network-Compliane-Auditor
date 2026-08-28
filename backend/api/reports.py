"""Reports API — PDF generation and download endpoints."""

import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlmodel import Session, select

from database import get_session
from models.device import Device, ConfigFile
from models.compliance import ComplianceResult, AuditReport
from schemas.compliance import AuditReportRead
from services.compliance_engine import run_audit, calculate_score
from services.pdf_generator import generate_pdf_report

router = APIRouter(prefix="/api/v1", tags=["Reports"])


@router.post("/reports/generate/{device_id}", response_model=AuditReportRead)
def generate_report(
    device_id: int,
    framework: str = "CIS",
    session: Session = Depends(get_session),
):
    """Generate a PDF compliance report for a device."""
    device = session.get(Device, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # Get audit report
    report = session.exec(
        select(AuditReport)
        .where(AuditReport.device_id == device_id, AuditReport.framework == framework)
    ).first()

    if not report:
        raise HTTPException(
            status_code=404,
            detail="No audit report found. Run an audit first.",
        )

    # Get compliance results
    results = session.exec(
        select(ComplianceResult)
        .where(
            ComplianceResult.config_id == report.config_id,
            ComplianceResult.framework == framework,
        )
    ).all()

    # Build result dicts for PDF generator
    result_dicts = [
        {
            "rule_id": r.rule_id,
            "rule_name": r.rule_name,
            "category": r.category,
            "status": r.status,
            "severity": r.severity,
            "actual_value": r.actual_value,
            "expected_value": r.expected_value,
            "remediation": r.remediation,
        }
        for r in results
    ]

    score_summary = {
        "total_rules": report.total_rules,
        "passed": report.passed,
        "failed": report.failed,
        "warnings": report.warnings,
        "not_applicable": report.not_applicable,
        "compliance_score": report.compliance_score,
    }

    device_dict = {
        "hostname": device.hostname,
        "vendor": device.vendor,
        "model": device.model,
        "os_version": device.os_version,
        "serial_number": device.serial_number,
        "device_type": device.device_type,
    }

    # Generate PDF
    pdf_path = generate_pdf_report(
        device_info=device_dict,
        audit_results=result_dicts,
        score_summary=score_summary,
        framework=framework,
        report_id=report.id,
    )

    # Update report with PDF path
    report.pdf_path = pdf_path
    session.add(report)
    session.commit()
    session.refresh(report)

    return report


@router.get("/reports/download/{report_id}")
def download_report(report_id: int, session: Session = Depends(get_session)):
    """Download a generated PDF report."""
    report = session.get(AuditReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if not report.pdf_path or not Path(report.pdf_path).exists():
        raise HTTPException(
            status_code=404,
            detail="PDF not generated yet. Call /reports/generate first.",
        )

    return FileResponse(
        report.pdf_path,
        media_type="application/pdf",
        filename=Path(report.pdf_path).name,
    )


@router.get("/reports", response_model=list[AuditReportRead])
def list_reports(session: Session = Depends(get_session)):
    """List all generated audit reports."""
    reports = session.exec(
        select(AuditReport).order_by(AuditReport.generated_at.desc())
    ).all()
    return reports
