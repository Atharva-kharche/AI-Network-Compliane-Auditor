"""Upload API — config file upload and device management endpoints."""

import json
import shutil
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from models.device import Device, ConfigFile
from schemas.device import DeviceRead, ConfigFileRead, UploadResponse, DeviceDetailRead
from services import extract_device_info
from services.normalizer import normalize_config
from services.ai_engine import parse_config_with_ai
from config import settings

router = APIRouter(prefix="/api/v1", tags=["Upload & Devices"])


@router.post("/upload", response_model=UploadResponse)
async def upload_config(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    """Upload a single network device configuration file.

    Accepts .txt, .conf, .cfg, .json files. Automatically detects the vendor,
    extracts device metadata, and normalizes the config.
    """
    # Validate file extension
    allowed_extensions = {".txt", ".conf", ".cfg", ".json"}
    suffix = Path(file.filename).suffix.lower()
    if suffix not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(allowed_extensions)}",
        )

    # Read file content
    raw_content = (await file.read()).decode("utf-8", errors="replace")

    # Save the file to disk
    settings.ensure_dirs()
    save_path = settings.UPLOAD_DIR / file.filename
    with open(save_path, "w", encoding="utf-8") as f:
        f.write(raw_content)

    # Extract device info
    device_info = extract_device_info(raw_content)

    # Create Device record
    device = Device(
        hostname=device_info["hostname"],
        vendor=device_info["vendor"],
        model=device_info["model"],
        os_version=device_info["os_version"],
        serial_number=device_info["serial_number"],
        device_type=device_info["device_type"],
    )
    session.add(device)
    session.commit()
    session.refresh(device)

    # Normalize config
    normalized, parse_status = normalize_config(
        raw_content, device_info["vendor"], device_info
    )

    # If the vendor is unknown, try AI parsing
    if parse_status == "needs_ai":
        ai_result, uncertain = await parse_config_with_ai(
            raw_content, device_info["vendor"]
        )
        if ai_result:
            # Merge AI results (they may have filled in fields)
            for section_key, section_val in ai_result.items():
                if isinstance(section_val, dict) and section_key in normalized:
                    for k, v in section_val.items():
                        if v is not None:
                            normalized[section_key][k] = v
                elif section_key not in ("uncertain", "device"):
                    normalized[section_key] = section_val

            parse_status = "parsed" if not uncertain else "needs_training"

            # Store uncertain items in training queue
            if uncertain:
                from models.training import TrainingMapping
                for item in uncertain:
                    mapping = TrainingMapping(
                        vendor=device_info["vendor"],
                        config_id=None,  # Will be set after config is saved
                        raw_command=item.get("raw_line", ""),
                        ai_suggestion=json.dumps(item),
                    )
                    session.add(mapping)

    # Create ConfigFile record
    config_file = ConfigFile(
        device_id=device.id,
        filename=file.filename,
        file_path=str(save_path),
        raw_content=raw_content,
        normalized_config=json.dumps(normalized),
        parse_status=parse_status,
    )
    session.add(config_file)
    session.commit()
    session.refresh(config_file)

    # Update training mappings with config_id if any were created
    if parse_status == "needs_training":
        from models.training import TrainingMapping
        stmt = select(TrainingMapping).where(
            TrainingMapping.config_id == None,
            TrainingMapping.vendor == device_info["vendor"],
        )
        for mapping in session.exec(stmt):
            mapping.config_id = config_file.id
        session.commit()

    return UploadResponse(
        message=f"Config uploaded successfully. Vendor: {device_info['vendor']}, Status: {parse_status}",
        device=DeviceRead.model_validate(device),
        config_file=ConfigFileRead.model_validate(config_file),
    )


@router.post("/upload/bulk", response_model=list[UploadResponse])
async def upload_bulk(
    files: list[UploadFile] = File(...),
    session: Session = Depends(get_session),
):
    """Upload multiple config files at once.

    Processes each file through the same pipeline as single upload.
    Returns a list of results for each file.
    """
    results = []
    allowed_extensions = {".txt", ".conf", ".cfg", ".json"}

    for file in files:
        suffix = Path(file.filename).suffix.lower()
        if suffix not in allowed_extensions:
            continue  # Skip unsupported files silently in bulk mode

        raw_content = (await file.read()).decode("utf-8", errors="replace")

        settings.ensure_dirs()
        save_path = settings.UPLOAD_DIR / file.filename
        with open(save_path, "w", encoding="utf-8") as f:
            f.write(raw_content)

        device_info = extract_device_info(raw_content)

        device = Device(
            hostname=device_info["hostname"],
            vendor=device_info["vendor"],
            model=device_info["model"],
            os_version=device_info["os_version"],
            serial_number=device_info["serial_number"],
            device_type=device_info["device_type"],
        )
        session.add(device)
        session.commit()
        session.refresh(device)

        normalized, parse_status = normalize_config(
            raw_content, device_info["vendor"], device_info
        )

        if parse_status == "needs_ai":
            ai_result, uncertain = await parse_config_with_ai(
                raw_content, device_info["vendor"]
            )
            if ai_result:
                for section_key, section_val in ai_result.items():
                    if isinstance(section_val, dict) and section_key in normalized:
                        for k, v in section_val.items():
                            if v is not None:
                                normalized[section_key][k] = v
                parse_status = "parsed" if not uncertain else "needs_training"

        config_file = ConfigFile(
            device_id=device.id,
            filename=file.filename,
            file_path=str(save_path),
            raw_content=raw_content,
            normalized_config=json.dumps(normalized),
            parse_status=parse_status,
        )
        session.add(config_file)
        session.commit()
        session.refresh(config_file)

        results.append(UploadResponse(
            message=f"Uploaded {file.filename}: {device_info['vendor']}, {parse_status}",
            device=DeviceRead.model_validate(device),
            config_file=ConfigFileRead.model_validate(config_file),
        ))

    return results


@router.get("/devices", response_model=list[DeviceRead])
def list_devices(session: Session = Depends(get_session)):
    """List all ingested devices."""
    devices = session.exec(select(Device).order_by(Device.uploaded_at.desc())).all()
    return devices


@router.get("/devices/{device_id}", response_model=DeviceDetailRead)
def get_device(device_id: int, session: Session = Depends(get_session)):
    """Get device details including its config files."""
    device = session.get(Device, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    configs = session.exec(
        select(ConfigFile).where(ConfigFile.device_id == device_id)
    ).all()

    return DeviceDetailRead(
        **device.model_dump(),
        config_files=[ConfigFileRead.model_validate(c) for c in configs],
    )


@router.delete("/devices/{device_id}")
def delete_device(device_id: int, session: Session = Depends(get_session)):
    """Delete a device and all its associated data."""
    device = session.get(Device, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # Delete config files
    configs = session.exec(
        select(ConfigFile).where(ConfigFile.device_id == device_id)
    ).all()
    for cfg in configs:
        # Delete compliance results
        from models.compliance import ComplianceResult
        results = session.exec(
            select(ComplianceResult).where(ComplianceResult.config_id == cfg.id)
        ).all()
        for r in results:
            session.delete(r)
        session.delete(cfg)

    # Delete audit reports
    from models.compliance import AuditReport
    reports = session.exec(
        select(AuditReport).where(AuditReport.device_id == device_id)
    ).all()
    for r in reports:
        session.delete(r)

    session.delete(device)
    session.commit()

    return {"message": f"Device {device_id} and all associated data deleted."}
