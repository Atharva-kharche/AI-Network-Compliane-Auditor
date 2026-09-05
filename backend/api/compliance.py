"""Compliance API — audit trigger and results endpoints."""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from database import get_session
from models.device import Device, ConfigFile
from models.compliance import ComplianceResult, AuditReport
from schemas.compliance import (
    AuditRequest,
    BulkAuditRequest,
    ComplianceResultRead,
    AuditReportRead,
    AuditSummary,
)
from services.compliance_engine import run_audit, calculate_score
from services.pdf_generator import generate_pdf_report

router = APIRouter(prefix="/api/v1", tags=["Compliance Audit"])


def _run_device_audit(device_id: int, framework: str, session: Session) -> AuditReport:
    """Internal helper to run an audit on a single device."""
    device = session.get(Device, device_id)
    if not device:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")

    # Get the latest config file for this device
    config = session.exec(
        select(ConfigFile)
        .where(ConfigFile.device_id == device_id)
        .order_by(ConfigFile.created_at.desc())
    ).first()

    if not config:
        raise HTTPException(status_code=404, detail=f"No config found for device {device_id}")

    if not config.normalized_config:
        raise HTTPException(
            status_code=400,
            detail="Config has not been normalized yet. Upload may still be processing.",
        )

    # Parse normalized config
    normalized = json.loads(config.normalized_config)

    # Apply verified training mappings
    from services.normalizer import apply_verified_mappings
    normalized = apply_verified_mappings(normalized, device.vendor, session)
    config.normalized_config = json.dumps(normalized)
    session.add(config)
    session.commit()

    # Run the compliance engine
    results = run_audit(normalized, framework, device.vendor)
    score = calculate_score(results)

    # Delete existing results for this config+framework (re-run support)
    old_results = session.exec(
        select(ComplianceResult)
        .where(ComplianceResult.config_id == config.id, ComplianceResult.framework == framework)
    ).all()
    for old in old_results:
        session.delete(old)

    # Store new results
    for r in results:
        cr = ComplianceResult(
            config_id=config.id,
            framework=framework,
            rule_id=r["rule_id"],
            rule_name=r["rule_name"],
            category=r["category"],
            status=r["status"],
            severity=r["severity"],
            actual_value=r.get("actual_value"),
            expected_value=r.get("expected_value"),
            remediation=r.get("remediation"),
        )
        session.add(cr)

    # Create/update audit report
    old_report = session.exec(
        select(AuditReport)
        .where(AuditReport.device_id == device_id, AuditReport.framework == framework)
    ).first()
    if old_report:
        session.delete(old_report)

    report = AuditReport(
        device_id=device_id,
        config_id=config.id,
        framework=framework,
        total_rules=score["total_rules"],
        passed=score["passed"],
        failed=score["failed"],
        warnings=score["warnings"],
        not_applicable=score["not_applicable"],
        compliance_score=score["compliance_score"],
    )
    session.add(report)
    session.commit()
    session.refresh(report)

    # Auto-generate PDF report so every audit has a downloadable PDF
    try:
        device_dict = {
            "hostname": device.hostname,
            "vendor": device.vendor,
            "model": device.model,
            "os_version": device.os_version,
            "serial_number": device.serial_number,
            "device_type": device.device_type,
        }
        result_dicts = [
            {
                "rule_id": r["rule_id"],
                "rule_name": r["rule_name"],
                "category": r["category"],
                "status": r["status"],
                "severity": r["severity"],
                "actual_value": r.get("actual_value"),
                "expected_value": r.get("expected_value"),
                "remediation": r.get("remediation"),
            }
            for r in results
        ]
        pdf_path = generate_pdf_report(
            device_info=device_dict,
            audit_results=result_dicts,
            score_summary=score,
            framework=framework,
            report_id=report.id,
            audit_timestamp=report.generated_at,
        )
        report.pdf_path = pdf_path
        session.add(report)
        session.commit()
        session.refresh(report)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Auto PDF generation failed for report {report.id}: {e}")

    return report


@router.post("/audit", response_model=AuditReportRead)
def trigger_audit(request: AuditRequest, session: Session = Depends(get_session)):
    """Trigger a compliance audit on a single device."""
    report = _run_device_audit(request.device_id, request.framework, session)
    return report


@router.post("/audit/bulk", response_model=list[AuditReportRead])
def trigger_bulk_audit(request: BulkAuditRequest, session: Session = Depends(get_session)):
    """Trigger compliance audits on multiple devices."""
    reports = []
    for device_id in request.device_ids:
        try:
            report = _run_device_audit(device_id, request.framework, session)
            reports.append(report)
        except HTTPException:
            continue
    return reports


@router.get("/audit/results/{device_id}", response_model=list[ComplianceResultRead])
def get_audit_results(
    device_id: int,
    framework: str = Query(None, description="Filter by framework (CIS, NIST, STIG)"),
    session: Session = Depends(get_session),
):
    """Get compliance results for a device, optionally filtered by framework."""
    # Get config IDs for this device
    configs = session.exec(
        select(ConfigFile).where(ConfigFile.device_id == device_id)
    ).all()
    config_ids = [c.id for c in configs]

    if not config_ids:
        return []

    stmt = select(ComplianceResult).where(ComplianceResult.config_id.in_(config_ids))
    if framework:
        stmt = stmt.where(ComplianceResult.framework == framework.upper())
    stmt = stmt.order_by(ComplianceResult.severity, ComplianceResult.rule_id)

    results = session.exec(stmt).all()
    return results


@router.get("/audit/summary/{device_id}", response_model=AuditSummary)
def get_audit_summary(
    device_id: int,
    framework: str = "CIS",
    session: Session = Depends(get_session),
):
    """Get audit summary for a specific device and framework."""
    device = session.get(Device, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    report = session.exec(
        select(AuditReport)
        .where(AuditReport.device_id == device_id, AuditReport.framework == framework)
    ).first()

    if not report:
        raise HTTPException(status_code=404, detail="No audit report found for this device/framework")

    # Count critical findings
    configs = session.exec(
        select(ConfigFile).where(ConfigFile.device_id == device_id)
    ).all()
    config_ids = [c.id for c in configs]

    critical_count = 0
    if config_ids:
        critical_results = session.exec(
            select(ComplianceResult).where(
                ComplianceResult.config_id.in_(config_ids),
                ComplianceResult.framework == framework,
                ComplianceResult.severity == "critical",
                ComplianceResult.status == "fail",
            )
        ).all()
        critical_count = len(critical_results)

    return AuditSummary(
        device_id=device_id,
        hostname=device.hostname,
        vendor=device.vendor,
        framework=framework,
        compliance_score=report.compliance_score,
        total_rules=report.total_rules,
        passed=report.passed,
        failed=report.failed,
        warnings=report.warnings,
        critical_findings=critical_count,
    )
