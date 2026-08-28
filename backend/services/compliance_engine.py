"""Compliance Engine — evaluates normalized configs against compliance rule sets.

Supports operators: equals, not_equals, greater_than, less_than, exists, not_exists, in, contains.
"""

import json
import logging
from pathlib import Path
from typing import Any, Optional

from config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
#  Rule evaluation operators
# ---------------------------------------------------------------------------

def _resolve_path(data: dict, path: str) -> Any:
    """Resolve a dotted path like 'remote_access.ssh_version' in a nested dict."""
    keys = path.split(".")
    current = data
    for key in keys:
        if isinstance(current, dict):
            current = current.get(key)
        else:
            return None
        if current is None:
            return None
    return current


def _evaluate_rule(normalized_config: dict, rule: dict) -> dict:
    """Evaluate a single compliance rule against the normalized config.

    Returns a result dict with status, actual_value, expected_value, etc.
    """
    check = rule["check"]
    path = check["path"]
    operator = check["operator"]
    expected = check.get("expected")

    actual = _resolve_path(normalized_config, path)

    result = {
        "rule_id": rule["id"],
        "rule_name": rule["name"],
        "category": rule["category"],
        "severity": rule["severity"],
        "actual_value": str(actual) if actual is not None else "not configured",
        "expected_value": str(expected) if expected is not None else "N/A",
    }

    # If the field is None/missing, it's not_applicable (unless we're checking not_exists)
    if actual is None and operator != "not_exists":
        if operator == "exists":
            result["status"] = "fail"
        else:
            result["status"] = "not_applicable"
        return result

    # Evaluate based on operator
    try:
        if operator == "equals":
            result["status"] = "pass" if actual == expected else "fail"
        elif operator == "not_equals":
            result["status"] = "pass" if actual != expected else "fail"
        elif operator == "greater_than":
            result["status"] = "pass" if actual is not None and actual > expected else "fail"
        elif operator == "less_than":
            result["status"] = "pass" if actual is not None and actual < expected else "fail"
        elif operator == "exists":
            result["status"] = "pass" if actual else "fail"
        elif operator == "not_exists":
            result["status"] = "pass" if not actual else "fail"
        elif operator == "in":
            result["status"] = "pass" if actual in expected else "fail"
        elif operator == "contains":
            result["status"] = "pass" if expected in actual else "fail"
        else:
            logger.warning(f"Unknown operator: {operator}")
            result["status"] = "warning"
    except (TypeError, ValueError) as e:
        logger.warning(f"Evaluation error for {rule['id']}: {e}")
        result["status"] = "warning"

    return result


# ---------------------------------------------------------------------------
#  Rule loading
# ---------------------------------------------------------------------------

def load_rules(framework: str) -> list[dict]:
    """Load compliance rules for a given framework from JSON files."""
    filename_map = {
        "CIS": "cis_benchmarks.json",
        "NIST": "nist_sp800_53.json",
        "STIG": "stig_rules.json",
    }

    filename = filename_map.get(framework.upper())
    if not filename:
        logger.error(f"Unknown framework: {framework}")
        return []

    rules_path = settings.RULES_DIR / filename
    if not rules_path.exists():
        logger.error(f"Rules file not found: {rules_path}")
        return []

    try:
        with open(rules_path, "r") as f:
            data = json.load(f)
        return data.get("rules", [])
    except (json.JSONDecodeError, IOError) as e:
        logger.error(f"Error loading rules from {rules_path}: {e}")
        return []


# ---------------------------------------------------------------------------
#  Public API
# ---------------------------------------------------------------------------

def run_audit(
    normalized_config: dict,
    framework: str,
    vendor: str = "unknown",
) -> list[dict]:
    """Run a full compliance audit against the normalized config.

    Args:
        normalized_config: The vendor-neutral JSON config.
        framework: Compliance framework to audit against (CIS, NIST, STIG).
        vendor: Device vendor for vendor-specific remediation.

    Returns:
        List of result dicts, one per rule.
    """
    rules = load_rules(framework)
    if not rules:
        return []

    results = []
    for rule in rules:
        result = _evaluate_rule(normalized_config, rule)
        result["framework"] = framework

        # Attach vendor-specific or generic remediation
        remediation = rule.get("remediation", {})
        result["remediation"] = remediation.get(vendor, remediation.get("generic", ""))

        results.append(result)

    return results


def calculate_score(results: list[dict]) -> dict:
    """Calculate compliance score from audit results.

    Returns a summary dict with counts and percentage.
    """
    total = len(results)
    if total == 0:
        return {
            "total_rules": 0,
            "passed": 0,
            "failed": 0,
            "warnings": 0,
            "not_applicable": 0,
            "compliance_score": 0.0,
        }

    passed = sum(1 for r in results if r["status"] == "pass")
    failed = sum(1 for r in results if r["status"] == "fail")
    warnings = sum(1 for r in results if r["status"] == "warning")
    not_applicable = sum(1 for r in results if r["status"] == "not_applicable")

    # Score = passed / (total - not_applicable) * 100
    applicable = total - not_applicable
    score = (passed / applicable * 100) if applicable > 0 else 0.0

    return {
        "total_rules": total,
        "passed": passed,
        "failed": failed,
        "warnings": warnings,
        "not_applicable": not_applicable,
        "compliance_score": round(score, 1),
    }
