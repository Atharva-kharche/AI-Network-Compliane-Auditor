import json
import logging
from pathlib import Path
from sqlmodel import Session, select
from database import engine
from models.device import Device, ConfigFile
from models.compliance import ComplianceResult, AuditReport
from models.training import TrainingMapping
from config import settings, BASE_DIR
from services import extract_device_info
from services.normalizer import normalize_config
from services.compliance_engine import run_audit, calculate_score

logger = logging.getLogger(__name__)

def seed_demo_data(session: Session):
    # Check if we already have devices
    if session.exec(select(Device)).first():
        logger.info("Database already contains data, skipping seed.")
        return

    logger.info("Empty database detected. Seeding demo data...")
    
    sample_dir = BASE_DIR / "sample_configs"
    if not sample_dir.exists():
        logger.warning("Sample configs directory not found.")
        return
        
    demo_files = ["cisco_ios_router.txt", "paloalto_fw.txt", "unknown_vendor_demo.txt"]
    
    for filename in demo_files:
        filepath = sample_dir / filename
        if not filepath.exists():
            continue
            
        with open(filepath, "r", encoding="utf-8") as f:
            raw_content = f.read()
            
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
        
        normalized, parse_status = normalize_config(raw_content, device_info["vendor"], device_info)
        
        # for unknown vendor, fake the parse status
        if device_info["vendor"] == "unknown":
            parse_status = "needs_training"
            mapping = TrainingMapping(
                vendor="unknown",
                raw_command="quantum-guard enable",
                context_lines="interface Quantum1\n quantum-guard enable",
                security_category="encryption",
                normalized_key=None,
                normalized_value=None,
                ai_suggestion=json.dumps({"best_guess_key": "quantum_encryption", "best_guess_value": True}),
                is_verified=False
            )
            session.add(mapping)
            session.commit()
            session.refresh(mapping)
        else:
            parse_status = "parsed"
            
        config_file = ConfigFile(
            device_id=device.id,
            filename=filename,
            file_path=str(filepath),
            raw_content=raw_content,
            normalized_config=json.dumps(normalized),
            parse_status=parse_status,
        )
        session.add(config_file)
        session.commit()
        session.refresh(config_file)
        
        if parse_status == "needs_training" and device_info["vendor"] == "unknown":
            mapping.config_id = config_file.id
            session.add(mapping)
            session.commit()
        
        # run audit
        results = run_audit(normalized, "CIS", device_info["vendor"])
        score_summary = calculate_score(results)
        
        report = AuditReport(
            device_id=device.id,
            config_id=config_file.id,
            framework="CIS",
            total_rules=score_summary["total_rules"],
            passed=score_summary["passed"],
            failed=score_summary["failed"],
            warnings=score_summary["warnings"],
            not_applicable=score_summary["not_applicable"],
            compliance_score=score_summary["compliance_score"],
        )
        session.add(report)
        session.commit()
        
        for r in results:
            cr = ComplianceResult(
                config_id=config_file.id,
                framework="CIS",
                rule_id=r["rule_id"],
                rule_name=r["rule_name"],
                category=r["category"],
                status=r["status"],
                severity=r["severity"],
                actual_value=str(r["actual_value"]) if r["actual_value"] is not None else None,
                expected_value=str(r["expected_value"]) if r["expected_value"] is not None else None,
                remediation=r.get("remediation", ""),
            )
            session.add(cr)
        session.commit()

    logger.info("Demo data seeded successfully.")
