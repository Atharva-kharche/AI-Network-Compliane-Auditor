"""Pydantic schemas for device & config endpoints."""

from datetime import datetime, timezone
from typing import Optional, Any
from pydantic import BaseModel, model_validator


class DeviceRead(BaseModel):
    """Response schema when returning device info."""
    id: int
    hostname: str
    vendor: str
    model: str
    os_version: str
    serial_number: str
    device_type: str
    uploaded_at: datetime

    class Config:
        from_attributes = True

    @model_validator(mode='after')
    def _ensure_utc(self):
        if self.uploaded_at and self.uploaded_at.tzinfo is None:
            self.uploaded_at = self.uploaded_at.replace(tzinfo=timezone.utc)
        return self


class ConfigFileRead(BaseModel):
    """Response schema for a config file record."""
    id: int
    device_id: int
    filename: str
    file_path: str
    raw_content: str
    normalized_config: Optional[Any] = None  # Will be parsed JSON when available
    parse_status: str
    created_at: datetime

    class Config:
        from_attributes = True

    @model_validator(mode='after')
    def _ensure_utc(self):
        if self.created_at and self.created_at.tzinfo is None:
            self.created_at = self.created_at.replace(tzinfo=timezone.utc)
        return self


class DeviceDetailRead(BaseModel):
    """Device with its associated config files."""
    id: int
    hostname: str
    vendor: str
    model: str
    os_version: str
    serial_number: str
    device_type: str
    uploaded_at: datetime
    config_files: list[ConfigFileRead] = []

    class Config:
        from_attributes = True

    @model_validator(mode='after')
    def _ensure_utc(self):
        if self.uploaded_at and self.uploaded_at.tzinfo is None:
            self.uploaded_at = self.uploaded_at.replace(tzinfo=timezone.utc)
        return self


class UploadResponse(BaseModel):
    """Response after a successful file upload."""
    message: str
    device: DeviceRead
    config_file: ConfigFileRead
