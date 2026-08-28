"""Ingestion service — detects vendor and extracts device metadata from raw config text."""

import re
from typing import Tuple


# Vendor detection patterns — order matters, first match wins
VENDOR_SIGNATURES = [
    {
        "vendor": "arista",
        "patterns": [
            r"^!\s*Arista",
            r"^management api http-commands",
            r"^management ssh",
            r"^spanning-tree mode mstp",
            r"interface Ethernet\d+",
        ],
        "min_matches": 2,
    },
    {
        "vendor": "paloalto",
        "patterns": [
            r"^set deviceconfig",
            r"^set network",
            r"^set rulebase",
            r"^set shared",
            r"^set mgt-config",
            r"^set password-complexity",
        ],
        "min_matches": 2,
    },
    {
        "vendor": "juniper",
        "patterns": [
            r"^system\s*\{",
            r"^\s*host-name\s+",
            r"^security\s*\{",
            r"^interfaces\s*\{",
            r"^snmp\s*\{",
            r"version \d+\.\d+R",
        ],
        "min_matches": 2,
    },
    {
        "vendor": "sonic",
        "patterns": [
            r'"DEVICE_METADATA"',
            r'"sonic_version"',
            r'"NTP_SERVER"',
            r'"ACL_RULE"',
            r'"PORT"',
        ],
        "min_matches": 2,
    },
    {
        "vendor": "cisco",
        "patterns": [
            r"^!\s*$",  # Cisco uses ! as section separator
            r"^version \d+\.\d+",
            r"^hostname \S+",
            r"^ip ssh version",
            r"^interface (GigabitEthernet|FastEthernet|Loopback|Vlan)",
            r"^line vty",
            r"^enable secret",
            r"^service password-encryption",
        ],
        "min_matches": 3,
    },
]


def detect_vendor(raw_config: str) -> str:
    """Detect the vendor of a config file by matching known patterns."""
    lines = raw_config.splitlines()
    for sig in VENDOR_SIGNATURES:
        matches = 0
        for pattern in sig["patterns"]:
            for line in lines:
                if re.search(pattern, line.strip(), re.IGNORECASE):
                    matches += 1
                    break
        if matches >= sig["min_matches"]:
            return sig["vendor"]
    return "unknown"


def extract_cisco_metadata(raw_config: str) -> dict:
    """Extract hostname, model hints, and OS version from Cisco IOS config."""
    meta = {"hostname": "unknown", "os_version": "unknown", "model": "unknown"}
    for line in raw_config.splitlines():
        line = line.strip()
        if m := re.match(r"^hostname\s+(\S+)", line):
            meta["hostname"] = m.group(1)
        elif m := re.match(r"^version\s+(.+)", line):
            meta["os_version"] = f"IOS {m.group(1)}"
        elif m := re.match(r"^!\s*Model:\s*(.+)", line, re.IGNORECASE):
            meta["model"] = m.group(1).strip()
        elif m := re.match(r"^!\s*IOS Version:\s*(.+)", line, re.IGNORECASE):
            meta["os_version"] = m.group(1).strip()
        elif m := re.match(r"^!\s*Serial:\s*(.+)", line, re.IGNORECASE):
            meta["serial_number"] = m.group(1).strip()
    return meta


def extract_paloalto_metadata(raw_config: str) -> dict:
    """Extract metadata from Palo Alto PAN-OS set-style config."""
    meta = {"hostname": "unknown", "os_version": "PAN-OS", "model": "PA-Series"}
    for line in raw_config.splitlines():
        line = line.strip()
        if m := re.match(r"^set deviceconfig system hostname\s+(\S+)", line):
            meta["hostname"] = m.group(1)
    return meta


def extract_juniper_metadata(raw_config: str) -> dict:
    """Extract metadata from Juniper JunOS hierarchical config."""
    meta = {"hostname": "unknown", "os_version": "unknown", "model": "SRX-Series"}
    for line in raw_config.splitlines():
        line = line.strip()
        if m := re.match(r"host-name\s+(\S+);", line):
            meta["hostname"] = m.group(1)
        elif m := re.match(r"^version\s+(.+);", line):
            meta["os_version"] = f"JunOS {m.group(1)}"
    return meta


def extract_arista_metadata(raw_config: str) -> dict:
    """Extract metadata from Arista EOS config."""
    meta = {"hostname": "unknown", "os_version": "EOS", "model": "unknown"}
    for line in raw_config.splitlines():
        line = line.strip()
        if m := re.match(r"^hostname\s+(\S+)", line):
            meta["hostname"] = m.group(1)
        elif m := re.match(r"^!\s*EOS Version:\s*(.+)", line, re.IGNORECASE):
            meta["os_version"] = m.group(1).strip()
        elif m := re.match(r"^!\s*Model:\s*(.+)", line, re.IGNORECASE):
            meta["model"] = m.group(1).strip()
        elif m := re.match(r"^!\s*Serial:\s*(.+)", line, re.IGNORECASE):
            meta["serial_number"] = m.group(1).strip()
    return meta


def extract_sonic_metadata(raw_config: str) -> dict:
    """Extract metadata from SONiC JSON config."""
    import json
    meta = {"hostname": "unknown", "os_version": "SONiC", "model": "unknown"}
    try:
        data = json.loads(raw_config)
        dm = data.get("DEVICE_METADATA", {}).get("localhost", {})
        meta["hostname"] = dm.get("hostname", "unknown")
        meta["os_version"] = dm.get("sonic_version", "SONiC")
        meta["model"] = dm.get("hwsku", dm.get("platform", "unknown"))
        if serial := dm.get("mac"):
            meta["serial_number"] = serial
    except json.JSONDecodeError:
        pass
    return meta


METADATA_EXTRACTORS = {
    "cisco": extract_cisco_metadata,
    "paloalto": extract_paloalto_metadata,
    "juniper": extract_juniper_metadata,
    "arista": extract_arista_metadata,
    "sonic": extract_sonic_metadata,
}


def detect_device_type(vendor: str, raw_config: str) -> str:
    """Infer whether the device is a router, switch, or firewall."""
    config_lower = raw_config.lower()
    if vendor == "paloalto":
        return "firewall"
    if vendor == "juniper" and "security" in config_lower:
        return "firewall"
    if "router" in config_lower or "ip route" in config_lower:
        return "router"
    if "switchport" in config_lower or "vlan" in config_lower or "spanning-tree" in config_lower:
        return "switch"
    return "unknown"


def extract_device_info(raw_config: str) -> dict:
    """Full extraction pipeline: detect vendor → extract metadata → detect device type.

    Returns a dict with keys: hostname, vendor, model, os_version, serial_number, device_type
    """
    vendor = detect_vendor(raw_config)
    extractor = METADATA_EXTRACTORS.get(vendor)

    if extractor:
        meta = extractor(raw_config)
    else:
        meta = {"hostname": "unknown", "os_version": "unknown", "model": "unknown"}

    device_type = detect_device_type(vendor, raw_config)

    return {
        "hostname": meta.get("hostname", "unknown"),
        "vendor": vendor,
        "model": meta.get("model", "unknown"),
        "os_version": meta.get("os_version", "unknown"),
        "serial_number": meta.get("serial_number", "unknown"),
        "device_type": device_type,
    }
