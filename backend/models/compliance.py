"""Compliance result and audit report ORM models."""

from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field, Column
import sqlalchemy as sa


class ComplianceResult(SQLModel, table=True):
    """Individual rule evaluation result for a config file."""

    __tablename__ = "compliance_results"

    id: Optional[int] = Field(default=None, primary_key=True)
    config_id: int = Field(foreign_key="config_files.id", index=True)
    framework: str              # CIS, NIST, STIG
    rule_id: str                # e.g. CIS-2.1.1
    rule_name: str
    category: str               # authentication, encryption, logging, etc.
    status: str                 # pass, fail, warning, not_applicable
    severity: str               # critical, high, medium, low, info
    actual_value: Optional[str] = Field(default=None, sa_column=Column(sa.Text))
    expected_value: Optional[str] = Field(default=None, sa_column=Column(sa.Text))
    remediation: Optional[str] = Field(default=None, sa_column=Column(sa.Text))
    audited_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(sa.DateTime, default=sa.func.now()),
    )


class AuditReport(SQLModel, table=True):
    """Summary report for a device audit run."""

    __tablename__ = "audit_reports"

    id: Optional[int] = Field(default=None, primary_key=True)
    device_id: int = Field(foreign_key="devices.id", index=True)
    config_id: int = Field(foreign_key="config_files.id")
    framework: str
    total_rules: int = 0
    passed: int = 0
    failed: int = 0
    warnings: int = 0
    not_applicable: int = 0
    compliance_score: float = 0.0
    pdf_path: Optional[str] = None
    generated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(sa.DateTime, default=sa.func.now()),
    )
