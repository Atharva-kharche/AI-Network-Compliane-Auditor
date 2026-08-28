"""Dashboard API — aggregate statistics and risk distribution endpoints."""

from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func

from database import get_session
from models.device import Device, ConfigFile
from models.compliance import ComplianceResult, AuditReport
from schemas.compliance import DashboardStats, RiskDistribution

router = APIRouter(prefix="/api/v1", tags=["Dashboard"])


@router.get("/dashboard/stats", response_model=DashboardStats)
def get_dashboard_stats(session: Session = Depends(get_session)):
    """Get overall dashboard statistics."""
    total_devices = session.exec(select(func.count(Device.id))).one()
    total_audits = session.exec(select(func.count(AuditReport.id))).one()

    # Average compliance score
    avg_score_result = session.exec(
        select(func.avg(AuditReport.compliance_score))
    ).one()
    avg_score = round(avg_score_result or 0, 1)

    # Devices that have been audited
    audited_device_ids = session.exec(
        select(AuditReport.device_id).distinct()
    ).all()
    devices_audited = len(audited_device_ids)

    # Critical and high findings
    critical_findings = session.exec(
        select(func.count(ComplianceResult.id)).where(
            ComplianceResult.severity == "critical",
            ComplianceResult.status == "fail",
        )
    ).one()

    high_findings = session.exec(
        select(func.count(ComplianceResult.id)).where(
            ComplianceResult.severity == "high",
            ComplianceResult.status == "fail",
        )
    ).one()

    # Recent activity — last 10 items
    recent_devices = session.exec(
        select(Device).order_by(Device.uploaded_at.desc()).limit(5)
    ).all()
    recent_reports = session.exec(
        select(AuditReport).order_by(AuditReport.generated_at.desc()).limit(5)
    ).all()

    activity = []
    for d in recent_devices:
        activity.append({
            "type": "upload",
            "description": f"Uploaded {d.hostname} ({d.vendor})",
            "timestamp": d.uploaded_at.isoformat(),
            "device_id": d.id,
        })
    for r in recent_reports:
        device = session.get(Device, r.device_id)
        hostname = device.hostname if device else "Unknown"
        activity.append({
            "type": "audit",
            "description": f"Audited {hostname} — {r.framework} ({r.compliance_score}%)",
            "timestamp": r.generated_at.isoformat(),
            "device_id": r.device_id,
        })

    # Sort by timestamp descending
    activity.sort(key=lambda x: x["timestamp"], reverse=True)

    return DashboardStats(
        total_devices=total_devices,
        total_audits=total_audits,
        average_compliance_score=avg_score,
        critical_findings=critical_findings,
        high_findings=high_findings,
        devices_audited=devices_audited,
        recent_activity=activity[:10],
    )


@router.get("/dashboard/risk-distribution", response_model=RiskDistribution)
def get_risk_distribution(session: Session = Depends(get_session)):
    """Get severity breakdown of failed compliance checks across all devices."""
    def count_severity(severity: str) -> int:
        return session.exec(
            select(func.count(ComplianceResult.id)).where(
                ComplianceResult.severity == severity,
                ComplianceResult.status == "fail",
            )
        ).one()

    return RiskDistribution(
        critical=count_severity("critical"),
        high=count_severity("high"),
        medium=count_severity("medium"),
        low=count_severity("low"),
        info=count_severity("info"),
    )
