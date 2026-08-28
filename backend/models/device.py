"""Device and ConfigFile ORM models."""

from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field, Column
import sqlalchemy as sa


class Device(SQLModel, table=True):
    """Represents a network device whose config was uploaded."""

    __tablename__ = "devices"

    id: Optional[int] = Field(default=None, primary_key=True)
    hostname: str = Field(index=True)
    vendor: str = Field(default="unknown")          # cisco, paloalto, juniper, arista, sonic, unknown
    model: str = Field(default="unknown")
    os_version: str = Field(default="unknown")
    serial_number: str = Field(default="unknown")
    device_type: str = Field(default="unknown")      # router, switch, firewall
    uploaded_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(sa.DateTime, default=sa.func.now()),
    )


class ConfigFile(SQLModel, table=True):
    """Raw and normalized configuration for a device."""

    __tablename__ = "config_files"

    id: Optional[int] = Field(default=None, primary_key=True)
    device_id: int = Field(foreign_key="devices.id", index=True)
    filename: str
    file_path: str
    raw_content: str = Field(sa_column=Column(sa.Text))
    normalized_config: Optional[str] = Field(
        default=None, sa_column=Column(sa.Text)
    )  # JSON string of the vendor-neutral schema
    parse_status: str = Field(default="pending")  # pending, parsed, needs_training, failed
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(sa.DateTime, default=sa.func.now()),
    )
