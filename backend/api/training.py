from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from database import get_session
from models.training import TrainingMapping
from models.device import Device, ConfigFile
from schemas.training import TrainingMappingRead, TrainingMapRequest, PendingTrainingItem
from api.compliance import _run_device_audit

router = APIRouter(prefix="/api/v1", tags=["AI Training"])


@router.get("/training/pending", response_model=list[PendingTrainingItem])
def get_pending_training(session: Session = Depends(get_session)):
    """Get unrecognized config lines that need admin mapping."""
    stmt = (
        select(TrainingMapping)
        .where(TrainingMapping.is_verified == False)
        .order_by(TrainingMapping.created_at.desc())
    )
    pending = session.exec(stmt).all()
    return pending


@router.post("/training/map", response_model=TrainingMappingRead)
def submit_mapping(request: TrainingMapRequest, session: Session = Depends(get_session)):
    """Submit an admin mapping for an unrecognized config command."""
    mapping = session.get(TrainingMapping, request.mapping_id)
    if not mapping:
        raise HTTPException(status_code=404, detail="Training mapping not found")

    mapping.security_category = request.security_category
    mapping.normalized_key = request.normalized_key
    mapping.normalized_value = request.normalized_value
    mapping.is_verified = True

    session.add(mapping)
    session.commit()
    session.refresh(mapping)

    # Check if all mappings for this config are now verified
    if mapping.config_id:
        pending_count = len(
            session.exec(
                select(TrainingMapping).where(
                    TrainingMapping.config_id == mapping.config_id,
                    TrainingMapping.is_verified == False,
                )
            ).all()
        )
        if pending_count == 0:
            config_file = session.get(ConfigFile, mapping.config_id)
            if config_file:
                config_file.parse_status = "parsed"
                session.add(config_file)
                session.commit()

    return mapping


@router.post("/training/demo/load")
async def load_demo_unknown_config(session: Session = Depends(get_session)):
    """Load the demo unknown vendor configuration to demonstrate the AI Training loop."""
    import json
    from pathlib import Path
    from config import settings
    from services import extract_device_info
    from services.normalizer import normalize_config, apply_verified_mappings
    from services.ai_engine import parse_config_with_ai

    demo_file = Path(__file__).resolve().parent.parent / "sample_configs" / "unknown_vendor_demo.txt"
    if not demo_file.exists():
        raise HTTPException(status_code=404, detail="Demo configuration file not found")

    with open(demo_file, "r", encoding="utf-8") as f:
        raw_content = f.read()

    # Extract device info
    device_info = extract_device_info(raw_content)

    # Check if this demo device already exists; if so, find or recreate
    existing_device = session.exec(
        select(Device).where(Device.hostname == device_info["hostname"])
    ).first()

    if existing_device:
        device = existing_device
    else:
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

    queued_items = 0
    if parse_status == "needs_ai":
        verified_stmt = select(TrainingMapping).where(
            TrainingMapping.vendor == device_info["vendor"],
            TrainingMapping.is_verified == True,
        )
        verified_mappings = [
            m.model_dump() for m in session.exec(verified_stmt).all()
        ]

        ai_result, uncertain = await parse_config_with_ai(
            raw_content, device_info["vendor"], verified_mappings
        )
        if ai_result:
            for section_key, section_val in ai_result.items():
                if isinstance(section_val, dict) and section_key in normalized:
                    for k, v in section_val.items():
                        if v is not None:
                            normalized[section_key][k] = v
                elif section_key not in ("uncertain", "device"):
                    normalized[section_key] = section_val

        if uncertain:
            for item in uncertain:
                raw_cmd = item.get("raw_line", "").strip()
                if not raw_cmd:
                    continue

                # Check if already verified
                existing_verified = session.exec(
                    select(TrainingMapping).where(
                        TrainingMapping.vendor == device_info["vendor"],
                        TrainingMapping.raw_command == raw_cmd,
                        TrainingMapping.is_verified == True,
                    )
                ).first()

                if existing_verified:
                    continue

                # Check if already pending
                existing_pending = session.exec(
                    select(TrainingMapping).where(
                        TrainingMapping.vendor == device_info["vendor"],
                        TrainingMapping.raw_command == raw_cmd,
                        TrainingMapping.is_verified == False,
                    )
                ).first()

                if not existing_pending:
                    mapping = TrainingMapping(
                        vendor=device_info["vendor"],
                        config_id=None,
                        raw_command=raw_cmd,
                        context_lines=item.get("context", ""),
                        security_category=item.get("category"),
                        normalized_key=item.get("best_guess_key"),
                        normalized_value=str(item.get("best_guess_value", "")) if item.get("best_guess_value") is not None else None,
                        ai_suggestion=json.dumps(item),
                        is_verified=False,
                    )
                    session.add(mapping)
                    queued_items += 1
                else:
                    queued_items += 1

    normalized = apply_verified_mappings(normalized, device_info["vendor"], session, raw_content)
    parse_status = "needs_training" if queued_items > 0 else "parsed"

    # Check for existing ConfigFile
    config_file = session.exec(
        select(ConfigFile).where(ConfigFile.device_id == device.id)
    ).first()

    if not config_file:
        config_file = ConfigFile(
            device_id=device.id,
            filename="unknown_vendor_demo.txt",
            file_path=str(demo_file),
            raw_content=raw_content,
            normalized_config=json.dumps(normalized),
            parse_status=parse_status,
        )
        session.add(config_file)
        session.commit()
        session.refresh(config_file)
    else:
        config_file.normalized_config = json.dumps(normalized)
        config_file.parse_status = parse_status
        session.add(config_file)
        session.commit()

    # Assign unassociated pending items
    stmt = select(TrainingMapping).where(
        TrainingMapping.config_id == None,
        TrainingMapping.vendor == device_info["vendor"],
    )
    for mapping in session.exec(stmt):
        mapping.config_id = config_file.id
    session.commit()

    # Get all pending items for this device
    pending_items = session.exec(
        select(TrainingMapping).where(
            TrainingMapping.vendor == device_info["vendor"],
            TrainingMapping.is_verified == False,
        )
    ).all()

    return {
        "message": f"Demo unknown configuration loaded! Ingested {len(pending_items)} unrecognized commands for '{device.hostname}' ({device.vendor}).",
        "device_id": device.id,
        "hostname": device.hostname,
        "vendor": device.vendor,
        "pending_count": len(pending_items),
        "pending_commands": [p.raw_command for p in pending_items],
    }


@router.post("/training/re-audit/{device_id}")
def re_audit_device(
    device_id: int,
    framework: str = Query("CIS", description="Compliance framework"),
    session: Session = Depends(get_session),
):
    """Re-audit a device after learning new training mappings."""
    from models.compliance import AuditReport, ComplianceResult

    device = session.get(Device, device_id)
    if not device:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")

    # Get previous report score if any
    old_report = session.exec(
        select(AuditReport).where(
            AuditReport.device_id == device_id,
            AuditReport.framework == framework,
        )
    ).first()
    previous_score = old_report.compliance_score if old_report else 0.0

    # Run the audit with verified mappings applied
    report = _run_device_audit(device_id, framework, session)

    # Fetch newly passed rules and applied mappings
    results = session.exec(
        select(ComplianceResult).where(
            ComplianceResult.config_id == report.config_id,
            ComplianceResult.framework == framework,
        )
    ).all()

    passed_rules = [
        {"rule_id": r.rule_id, "rule_name": r.rule_name, "severity": r.severity}
        for r in results if r.status == "pass"
    ]
    failed_rules = [
        {"rule_id": r.rule_id, "rule_name": r.rule_name, "severity": r.severity}
        for r in results if r.status == "fail"
    ]

    applied_mappings = session.exec(
        select(TrainingMapping).where(
            TrainingMapping.vendor == device.vendor,
            TrainingMapping.is_verified == True,
        )
    ).all()

    return {
        "device_id": device_id,
        "hostname": device.hostname,
        "vendor": device.vendor,
        "framework": framework,
        "compliance_score": report.compliance_score,
        "previous_score": previous_score,
        "score_improvement": round(report.compliance_score - previous_score, 1),
        "passed": report.passed,
        "failed": report.failed,
        "warnings": report.warnings,
        "total_rules": report.total_rules,
        "report_id": report.id,
        "passed_rules": passed_rules,
        "failed_rules": failed_rules,
        "applied_mappings_count": len(applied_mappings),
        "message": f"Device '{device.hostname}' re-audited successfully! Compliance score: {report.compliance_score}%",
    }


@router.get("/training/mappings", response_model=list[TrainingMappingRead])
def get_all_mappings(
    vendor: str = None,
    verified_only: bool = False,
    session: Session = Depends(get_session),
):
    """View all training mappings, optionally filtered by vendor or verification status."""
    stmt = select(TrainingMapping)
    if vendor:
        stmt = stmt.where(TrainingMapping.vendor == vendor)
    if verified_only:
        stmt = stmt.where(TrainingMapping.is_verified == True)
    stmt = stmt.order_by(TrainingMapping.created_at.desc())

    mappings = session.exec(stmt).all()
    return mappings


@router.delete("/training/mappings/{mapping_id}")
def delete_mapping(mapping_id: int, session: Session = Depends(get_session)):
    """Delete a faulty training mapping."""
    mapping = session.get(TrainingMapping, mapping_id)
    if not mapping:
        raise HTTPException(status_code=404, detail="Training mapping not found")

    session.delete(mapping)
    session.commit()

    return {"message": f"Training mapping {mapping_id} deleted."}
