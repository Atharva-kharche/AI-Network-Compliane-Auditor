"""Pydantic schemas for compliance and audit endpoints."""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, model_validator


class AuditRequest(BaseModel):
    """Request body to trigger a compliance audit."""
    device_id: int
    framework: str = "CIS"  # CIS, NIST, STIG


class BulkAuditRequest(BaseModel):
    """Request body to trigger audits on multiple devices."""
    device_ids: list[int]
    framework: str = "CIS"


class ComplianceResultRead(BaseModel):
    """Single compliance rule evaluation result."""
    id: int
    config_id: int
    framework: str
    rule_id: str
    rule_name: str
    category: str
    status: str
    severity: str
    actual_value: Optional[str] = None
    expected_value: Optional[str] = None
    remediation: Optional[str] = None
    audited_at: datetime

    class Config:
        from_attributes = True


class AuditReportRead(BaseModel):
    """Audit report summary for a device."""
    id: int
    device_id: int
    config_id: int
    framework: str
    total_rules: int
    passed: int
    failed: int
    warnings: int
    not_applicable: int
    compliance_score: float
    pdf_path: Optional[str] = None
    generated_at: datetime
    device_hostname: Optional[str] = None

    class Config:
        from_attributes = True

    @model_validator(mode='after')
    def _ensure_utc(self):
        if self.generated_at and self.generated_at.tzinfo is None:
            self.generated_at = self.generated_at.replace(tzinfo=timezone.utc)
        return self


class AuditSummary(BaseModel):
    """Quick summary of audit results for a device."""
    device_id: int
    hostname: str
    vendor: str
    framework: str
    compliance_score: float
    total_rules: int
    passed: int
    failed: int
    warnings: int
    critical_findings: int


class DashboardStats(BaseModel):
    """Aggregate stats for the dashboard."""
    total_devices: int
    total_audits: int
    average_compliance_score: float
    critical_findings: int
    high_findings: int
    devices_audited: int
    recent_audits: list[dict] = []
    recent_activity: list[dict] = []


class RiskDistribution(BaseModel):
    """Severity breakdown across all devices."""
    critical: int
    high: int
    medium: int
    low: int
    info: int
