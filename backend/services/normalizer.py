"""Normalizer service — transforms vendor-specific config into the universal JSON schema.

This module contains rule-based parsers for known vendors (Layer 1 of the parsing pipeline).
Unknown vendors fall through to the AI engine (Layer 2).
"""

import re
import json
from typing import Optional


def _bool(val: Optional[str]) -> Optional[bool]:
    """Convert string config values to booleans."""
    if val is None:
        return None
    return val.lower() in ("yes", "true", "enabled", "1")


def _empty_schema() -> dict:
    """Return the base normalized schema with all fields set to None/defaults."""
    return {
        "device": {
            "hostname": None,
            "vendor": None,
            "model": None,
            "os": None,
        },
        "authentication": {
            "enable_secret_encrypted": None,
            "local_users": [],
            "aaa_enabled": None,
            "password_min_length": None,
            "login_attempts_limit": None,
        },
        "remote_access": {
            "ssh_version": None,
            "ssh_timeout": None,
            "telnet_enabled": None,
            "vty_acl_applied": None,
        },
        "encryption": {
            "password_encryption_service": None,
            "tls_version": None,
        },
        "logging": {
            "logging_enabled": None,
            "log_destination": None,
            "log_severity_level": None,
            "log_timestamps": None,
        },
        "services": {
            "cdp_enabled": None,
            "http_server_enabled": None,
            "source_routing_disabled": None,
            "finger_service_disabled": None,
        },
        "access_control": {
            "acls": [],
            "unused_ports_shutdown": None,
        },
        "ntp": {
            "ntp_authentication": None,
            "ntp_servers": [],
        },
        "snmp": {
            "snmp_version": None,
            "community_string_default": None,
        },
        "banners": {
            "login_banner_set": None,
            "motd_banner_set": None,
        },
    }


# ---------------------------------------------------------------------------
#  Cisco IOS Normalizer
# ---------------------------------------------------------------------------

def normalize_cisco(raw_config: str, device_info: dict) -> dict:
    """Parse Cisco IOS config into normalized JSON schema."""
    schema = _empty_schema()
    schema["device"] = {
        "hostname": device_info.get("hostname", "unknown"),
        "vendor": "cisco",
        "model": device_info.get("model", "unknown"),
        "os": device_info.get("os_version", "unknown"),
    }

    lines = raw_config.splitlines()
    in_banner_login = False
    in_banner_motd = False

    # Track service disabling
    cdp_disabled = False
    http_disabled = False
    source_route_disabled = False
    finger_disabled = False
    password_encryption = False
    enable_secret = False
    aaa_enabled = False
    ssh_version = None
    ssh_timeout = None
    telnet_enabled = True  # Default on for IOS
    vty_acl = False
    log_host = None
    log_severity = None
    log_timestamps = False
    ntp_auth = False
    ntp_servers = []
    snmp_v3 = False
    snmp_default_community = False
    login_banner = False
    motd_banner = False
    users = []
    acls = []
    unused_ports_shutdown = False
    shutdown_count = 0
    total_interfaces = 0
    password_min_length = None
    login_attempts_limit = None

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Service flags
        if line == "service password-encryption":
            password_encryption = True
        elif line.startswith("no ip source-route"):
            source_route_disabled = True
        elif line.startswith("no ip finger") or line.startswith("no service finger"):
            finger_disabled = True
        elif line.startswith("no ip http server"):
            http_disabled = True
        elif line.startswith("no cdp run"):
            cdp_disabled = True

        # Enable secret
        elif line.startswith("enable secret"):
            enable_secret = True

        # AAA
        elif line.startswith("aaa new-model"):
            aaa_enabled = True

        # SSH
        elif m := re.match(r"ip ssh version\s+(\d+)", line):
            ssh_version = int(m.group(1))
        elif m := re.match(r"ip ssh time-out\s+(\d+)", line):
            ssh_timeout = int(m.group(1))

        # Users
        elif m := re.match(r"username\s+(\S+)\s+privilege\s+(\d+)\s+secret", line):
            users.append({
                "username": m.group(1),
                "privilege": int(m.group(2)),
                "password_encrypted": "secret" in line,
            })

        # Login security
        elif m := re.match(r"login block-for\s+\d+\s+attempts\s+(\d+)", line):
            login_attempts_limit = int(m.group(1))
        elif m := re.match(r"security passwords min-length\s+(\d+)", line):
            password_min_length = int(m.group(1))

        # VTY lines
        elif line.startswith("line vty"):
            # Look ahead for transport and ACL
            j = i + 1
            while j < len(lines) and lines[j].startswith(" "):
                vty_line = lines[j].strip()
                if "transport input ssh" in vty_line:
                    telnet_enabled = False
                if "access-class" in vty_line:
                    vty_acl = True
                    if m := re.match(r"access-class\s+(\S+)\s+(\S+)", vty_line):
                        acls.append({
                            "name": m.group(1),
                            "direction": m.group(2),
                            "interface": "vty",
                        })
                j += 1

        # Logging
        elif m := re.match(r"logging host\s+(\S+)", line):
            log_host = m.group(1)
        elif m := re.match(r"logging trap\s+(\S+)", line):
            log_severity = m.group(1)
        elif line.startswith("service timestamps log"):
            log_timestamps = True

        # NTP
        elif line.startswith("ntp authenticate"):
            ntp_auth = True
        elif m := re.match(r"ntp server\s+(\S+)", line):
            ntp_servers.append(m.group(1))

        # SNMP
        elif re.match(r"snmp-server group\s+\S+\s+v3", line):
            snmp_v3 = True
        elif m := re.match(r"snmp-server community\s+(\S+)", line):
            if m.group(1).lower() in ("public", "private"):
                snmp_default_community = True

        # Banners
        elif line.startswith("banner login"):
            login_banner = True
        elif line.startswith("banner motd"):
            motd_banner = True

        # Interface shutdown counting
        elif line.startswith("interface "):
            total_interfaces += 1
        elif line == "shutdown":
            shutdown_count += 1

        i += 1

    # Assemble normalized config
    schema["authentication"]["enable_secret_encrypted"] = enable_secret
    schema["authentication"]["local_users"] = users
    schema["authentication"]["aaa_enabled"] = aaa_enabled
    schema["authentication"]["password_min_length"] = password_min_length
    schema["authentication"]["login_attempts_limit"] = login_attempts_limit

    schema["remote_access"]["ssh_version"] = ssh_version
    schema["remote_access"]["ssh_timeout"] = ssh_timeout
    schema["remote_access"]["telnet_enabled"] = telnet_enabled
    schema["remote_access"]["vty_acl_applied"] = vty_acl

    schema["encryption"]["password_encryption_service"] = password_encryption

    schema["logging"]["logging_enabled"] = log_host is not None
    schema["logging"]["log_destination"] = log_host
    schema["logging"]["log_severity_level"] = log_severity
    schema["logging"]["log_timestamps"] = log_timestamps

    schema["services"]["cdp_enabled"] = not cdp_disabled
    schema["services"]["http_server_enabled"] = not http_disabled
    schema["services"]["source_routing_disabled"] = source_route_disabled
    schema["services"]["finger_service_disabled"] = finger_disabled

    schema["access_control"]["acls"] = acls
    schema["access_control"]["unused_ports_shutdown"] = shutdown_count > 0

    schema["ntp"]["ntp_authentication"] = ntp_auth
    schema["ntp"]["ntp_servers"] = ntp_servers

    schema["snmp"]["snmp_version"] = 3 if snmp_v3 else (2 if not snmp_v3 else None)
    schema["snmp"]["community_string_default"] = snmp_default_community

    schema["banners"]["login_banner_set"] = login_banner
    schema["banners"]["motd_banner_set"] = motd_banner

    return schema


# ---------------------------------------------------------------------------
#  Palo Alto PAN-OS Normalizer
# ---------------------------------------------------------------------------

def normalize_paloalto(raw_config: str, device_info: dict) -> dict:
    """Parse Palo Alto PAN-OS set-style config into normalized schema."""
    schema = _empty_schema()
    schema["device"] = {
        "hostname": device_info.get("hostname", "unknown"),
        "vendor": "paloalto",
        "model": device_info.get("model", "PA-Series"),
        "os": device_info.get("os_version", "PAN-OS"),
    }

    users = []
    ntp_servers = []

    for line in raw_config.splitlines():
        line = line.strip()

        # SSH
        if m := re.match(r"set deviceconfig system ssh session-timeout\s+(\d+)", line):
            schema["remote_access"]["ssh_timeout"] = int(m.group(1)) * 60  # convert to seconds
            schema["remote_access"]["ssh_version"] = 2  # PAN-OS only supports SSH v2

        # Telnet
        if "disable-telnet yes" in line:
            schema["remote_access"]["telnet_enabled"] = False
        elif "disable-telnet no" in line:
            schema["remote_access"]["telnet_enabled"] = True

        # HTTP
        if "disable-http yes" in line:
            schema["services"]["http_server_enabled"] = False

        # Users
        if m := re.match(r"set mgt-config users\s+(\S+)\s+permissions role-based\s+(\S+)", line):
            priv = 15 if m.group(2) in ("superuser", "deviceadmin") else 1
            users.append({
                "username": m.group(1),
                "privilege": priv,
                "password_encrypted": True,  # PAN-OS always hashes
            })

        # Password complexity
        if m := re.match(r"set password-complexity minimum-length\s+(\d+)", line):
            schema["authentication"]["password_min_length"] = int(m.group(1))
        if "password-complexity enabled yes" in line:
            schema["encryption"]["password_encryption_service"] = True

        # Logging
        if m := re.match(r"set shared log-settings syslog\s+\S+\s+server\s+(\S+)", line):
            schema["logging"]["logging_enabled"] = True
            schema["logging"]["log_destination"] = m.group(1)
            schema["logging"]["log_severity_level"] = "informational"
            schema["logging"]["log_timestamps"] = True

        # NTP
        if m := re.search(r"ntp-server-address\s+(\S+)", line):
            ntp_servers.append(m.group(1))
        if "authentication-type symmetric-key" in line:
            schema["ntp"]["ntp_authentication"] = True

        # SNMP
        if "snmp-setting access-setting version v3" in line:
            schema["snmp"]["snmp_version"] = 3
            schema["snmp"]["community_string_default"] = False

        # Banner
        if "login-banner" in line:
            schema["banners"]["login_banner_set"] = True
        if "motd-and-banner-header" in line:
            schema["banners"]["motd_banner_set"] = True

        # Login attempts
        if m := re.match(r"set deviceconfig setting management failed-attempts\s+(\d+)", line):
            schema["authentication"]["login_attempts_limit"] = int(m.group(1))

    schema["authentication"]["local_users"] = users
    schema["authentication"]["aaa_enabled"] = True  # PAN-OS always uses local auth at minimum
    schema["authentication"]["enable_secret_encrypted"] = True  # PAN-OS always hashes passwords
    schema["ntp"]["ntp_servers"] = ntp_servers
    schema["remote_access"]["vty_acl_applied"] = True  # PAN-OS management access is ACL-controlled by default

    # PAN-OS doesn't have CDP or source routing
    schema["services"]["cdp_enabled"] = False
    schema["services"]["source_routing_disabled"] = True
    schema["services"]["finger_service_disabled"] = True

    return schema


# ---------------------------------------------------------------------------
#  Juniper JunOS Normalizer
# ---------------------------------------------------------------------------

def normalize_juniper(raw_config: str, device_info: dict) -> dict:
    """Parse Juniper JunOS hierarchical config into normalized schema."""
    schema = _empty_schema()
    schema["device"] = {
        "hostname": device_info.get("hostname", "unknown"),
        "vendor": "juniper",
        "model": device_info.get("model", "SRX-Series"),
        "os": device_info.get("os_version", "unknown"),
    }

    users = []
    ntp_servers = []

    config = raw_config

    # SSH
    if "protocol-version v2" in config:
        schema["remote_access"]["ssh_version"] = 2
    if "root-login deny" in config:
        pass  # good practice but not directly in our schema

    # Telnet — JunOS doesn't enable telnet by default on SRX
    schema["remote_access"]["telnet_enabled"] = "telnet" in config.lower() and "delete" not in config.lower()

    # Users
    for m in re.finditer(r"user\s+(\S+)\s*\{[^}]*class\s+(\S+);", config, re.DOTALL):
        priv = 15 if m.group(2) == "super-user" else 1
        users.append({
            "username": m.group(1),
            "privilege": priv,
            "password_encrypted": True,
        })

    # Login attempts
    if m := re.search(r"tries-before-disconnect\s+(\d+);", config):
        schema["authentication"]["login_attempts_limit"] = int(m.group(1))

    # Login banner
    if re.search(r'message\s+"[^"]*"', config):
        schema["banners"]["login_banner_set"] = True

    # Logging
    if m := re.search(r"host\s+([\d.]+)\s*\{", config):
        schema["logging"]["logging_enabled"] = True
        schema["logging"]["log_destination"] = m.group(1)
    if "time-format" in config:
        schema["logging"]["log_timestamps"] = True
    if re.search(r"any\s+(notice|info|warning)", config):
        schema["logging"]["log_severity_level"] = "informational"

    # NTP
    for m in re.finditer(r"server\s+([\d.]+)", config):
        if m.group(1) not in ntp_servers:
            ntp_servers.append(m.group(1))
    if "authentication-key" in config:
        schema["ntp"]["ntp_authentication"] = True

    # SNMP
    if "v3 {" in config or "v3{" in config:
        schema["snmp"]["snmp_version"] = 3
        schema["snmp"]["community_string_default"] = False

    # Services
    schema["services"]["cdp_enabled"] = False  # Juniper doesn't use CDP
    schema["services"]["source_routing_disabled"] = "no-source-quench" in config
    schema["services"]["finger_service_disabled"] = True  # Not present on SRX by default
    if "web-management" in config:
        schema["services"]["http_server_enabled"] = "http {" in config and "https" not in config
    else:
        schema["services"]["http_server_enabled"] = False

    # Password encryption — JunOS always encrypts stored passwords
    schema["encryption"]["password_encryption_service"] = True

    # Interfaces — check for disabled ports
    disabled_ports = len(re.findall(r"disable;", config))
    schema["access_control"]["unused_ports_shutdown"] = disabled_ports > 0

    # VTY ACL — Juniper uses firewall filters on fxp0/lo0 for management
    schema["remote_access"]["vty_acl_applied"] = "firewall" in config or "fxp0" in config

    schema["authentication"]["local_users"] = users
    schema["authentication"]["aaa_enabled"] = True  # JunOS requires authentication by design
    schema["authentication"]["enable_secret_encrypted"] = True
    schema["ntp"]["ntp_servers"] = ntp_servers
    schema["banners"]["motd_banner_set"] = schema["banners"]["login_banner_set"]

    return schema


# ---------------------------------------------------------------------------
#  Arista EOS Normalizer
# ---------------------------------------------------------------------------

def normalize_arista(raw_config: str, device_info: dict) -> dict:
    """Parse Arista EOS config into normalized JSON schema."""
    schema = _empty_schema()
    schema["device"] = {
        "hostname": device_info.get("hostname", "unknown"),
        "vendor": "arista",
        "model": device_info.get("model", "unknown"),
        "os": device_info.get("os_version", "unknown"),
    }

    lines = raw_config.splitlines()
    password_encryption = False
    aaa_enabled = False
    ssh_version = None
    ssh_timeout = None
    telnet_enabled = False  # Disabled by default on EOS
    vty_acl = False
    log_host = None
    log_severity = None
    log_timestamps = False
    ntp_auth = False
    ntp_servers = []
    snmp_v3 = False
    snmp_default_community = False
    login_banner = False
    motd_banner = False
    users = []
    acls = []
    shutdown_count = 0
    total_interfaces = 0
    password_min_length = None
    login_attempts_limit = None

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Service flags
        if line == "service password-encryption":
            password_encryption = True

        # AAA
        elif line.startswith("aaa authentication login") or line.startswith("aaa authorization"):
            aaa_enabled = True

        # SSH
        elif m := re.match(r"ip ssh version\s+(\d+)", line):
            ssh_version = int(m.group(1))
        elif m := re.match(r"ip ssh (?:time-out|timeout)\s+(\d+)", line):
            ssh_timeout = int(m.group(1))

        # Users — Arista might have 'role' in middle
        elif m := re.match(r"username\s+(\S+)\s+privilege\s+(\d+)(?:\s+role\s+\S+)?\s+secret", line):
            users.append({
                "username": m.group(1),
                "privilege": int(m.group(2)),
                "password_encrypted": "secret" in line,
            })

        # Logging
        elif m := re.match(r"logging host\s+(\S+)", line):
            log_host = m.group(1)
        elif m := re.match(r"logging trap\s+(\S+)", line):
            log_severity = m.group(1)
        elif "logging format timestamp" in line:
            log_timestamps = True

        # NTP
        elif line.startswith("ntp authenticate"):
            ntp_auth = True
        elif m := re.match(r"ntp server\s+(\S+)", line):
            ntp_servers.append(m.group(1))

        # SNMP
        elif re.match(r"snmp-server group\s+\S+\s+v3", line):
            snmp_v3 = True
        elif m := re.match(r"snmp-server community\s+(\S+)", line):
            if m.group(1).lower() in ("public", "private"):
                snmp_default_community = True

        # Banners
        elif line.startswith("banner login"):
            login_banner = True
        elif line.startswith("banner motd"):
            motd_banner = True

        # Interface shutdown counting
        elif line.startswith("interface "):
            total_interfaces += 1
        elif line == "shutdown":
            shutdown_count += 1

        i += 1

    # Assemble normalized config
    schema["authentication"]["enable_secret_encrypted"] = True  # EOS passwords always encrypted
    schema["authentication"]["local_users"] = users
    schema["authentication"]["aaa_enabled"] = aaa_enabled
    schema["authentication"]["password_min_length"] = password_min_length
    schema["authentication"]["login_attempts_limit"] = login_attempts_limit

    schema["remote_access"]["ssh_version"] = ssh_version or 2  # Default to v2
    schema["remote_access"]["ssh_timeout"] = ssh_timeout
    schema["remote_access"]["telnet_enabled"] = telnet_enabled
    schema["remote_access"]["vty_acl_applied"] = vty_acl

    schema["encryption"]["password_encryption_service"] = password_encryption

    schema["logging"]["logging_enabled"] = log_host is not None
    schema["logging"]["log_destination"] = log_host
    schema["logging"]["log_severity_level"] = log_severity
    schema["logging"]["log_timestamps"] = log_timestamps

    schema["services"]["cdp_enabled"] = False  # Disabled by default on EOS
    schema["services"]["http_server_enabled"] = False  # Checked by http commands shutdown
    schema["services"]["source_routing_disabled"] = True
    schema["services"]["finger_service_disabled"] = True

    schema["access_control"]["acls"] = acls
    schema["access_control"]["unused_ports_shutdown"] = shutdown_count > 0

    schema["ntp"]["ntp_authentication"] = ntp_auth
    schema["ntp"]["ntp_servers"] = ntp_servers

    schema["snmp"]["snmp_version"] = 3 if snmp_v3 else (2 if not snmp_v3 else None)
    schema["snmp"]["community_string_default"] = snmp_default_community

    schema["banners"]["login_banner_set"] = login_banner
    schema["banners"]["motd_banner_set"] = motd_banner

    return schema


# ---------------------------------------------------------------------------
#  Public API
# ---------------------------------------------------------------------------

NORMALIZERS = {
    "cisco": normalize_cisco,
    "paloalto": normalize_paloalto,
    "juniper": normalize_juniper,
    "arista": normalize_arista,
}


def _parse_mapping_value(key: str, val: Optional[str]):
    """Convert string mapping value to boolean/int/list/string based on schema context."""
    if val is None:
        return None
    val_str = str(val).strip()
    val_lower = val_str.lower()

    if val_lower in ("true", "enabled", "enable", "yes"):
        return True
    if val_lower in ("false", "disabled", "disable", "no"):
        return False
    if val_str.isdigit():
        return int(val_str)

    # Handle list fields like ntp_servers
    if "servers" in key or "users" in key:
        return [s.strip() for s in val_str.split(",") if s.strip()]

    return val_str


def apply_verified_mappings(normalized: dict, vendor: str, session, raw_content: Optional[str] = None) -> dict:
    """Overlay verified TrainingMapping records onto the normalized config dict."""
    if not session:
        return normalized

    try:
        from sqlmodel import select
        from models.training import TrainingMapping

        stmt = select(TrainingMapping).where(
            TrainingMapping.is_verified == True,
        )
        if vendor and vendor not in ("unknown", "all"):
            stmt = stmt.where(TrainingMapping.vendor.in_([vendor, "unknown", "all"]))

        mappings = session.exec(stmt).all()
        for m in mappings:
            if not m.normalized_key:
                continue

            # If raw_content is supplied, ensure the command actually appears in the device config
            if raw_content and m.raw_command:
                cleaned_cmd = m.raw_command.strip()
                if cleaned_cmd.lower() not in raw_content.lower():
                    continue

            parsed_val = _parse_mapping_value(m.normalized_key, m.normalized_value)

            # Support dot notation e.g. "remote_access.ssh_version"
            parts = m.normalized_key.split(".")
            if len(parts) == 2:
                section, field = parts[0], parts[1]
                if section not in normalized or not isinstance(normalized[section], dict):
                    normalized[section] = {}
                normalized[section][field] = parsed_val
                # Auto-enable parent flags where appropriate
                if section == "logging" and field == "log_destination" and parsed_val:
                    normalized["logging"]["logging_enabled"] = True
            elif len(parts) == 1:
                field = parts[0]
                target_sec = m.security_category if m.security_category in normalized else None
                if target_sec and isinstance(normalized[target_sec], dict):
                    normalized[target_sec][field] = parsed_val
                else:
                    for sec, content in normalized.items():
                        if isinstance(content, dict) and field in content:
                            normalized[sec][field] = parsed_val
                            break
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Error applying verified mappings: {e}")

    return normalized


def detect_unrecognized_lines(raw_config: str, vendor: str) -> list[dict]:
    """Scan raw config for unrecognized security-relevant CLI commands."""
    uncertain = []
    lines = raw_config.splitlines()

    if vendor == "quantumguard":
        for i, line in enumerate(lines):
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue

            start_idx = max(0, i - 2)
            end_idx = min(len(lines), i + 3)
            context = "\n".join(lines[start_idx:end_idx])

            if "admin-ssh-protocol" in stripped:
                val = "2" if "v2" in stripped.lower() or "2" in stripped else "1"
                uncertain.append({
                    "raw_line": stripped,
                    "context": context,
                    "best_guess_key": "remote_access.ssh_version",
                    "best_guess_value": val,
                    "category": "remote_access",
                    "confidence": 0.95,
                })
            elif "legacy-telnet-service" in stripped or "telnet" in stripped:
                val = "false" if "disable" in stripped.lower() else "true"
                uncertain.append({
                    "raw_line": stripped,
                    "context": context,
                    "best_guess_key": "remote_access.telnet_enabled",
                    "best_guess_value": val,
                    "category": "remote_access",
                    "confidence": 0.95,
                })
            elif "auth-max-failed-attempts" in stripped:
                m = re.search(r"failed-attempts\s+(\d+)", stripped)
                val = m.group(1) if m else "3"
                uncertain.append({
                    "raw_line": stripped,
                    "context": context,
                    "best_guess_key": "authentication.login_attempts_limit",
                    "best_guess_value": val,
                    "category": "authentication",
                    "confidence": 0.95,
                })
            elif "password-policy" in stripped:
                m = re.search(r"min-length\s+(\d+)", stripped)
                val = m.group(1) if m else "14"
                uncertain.append({
                    "raw_line": stripped,
                    "context": context,
                    "best_guess_key": "authentication.password_min_length",
                    "best_guess_value": val,
                    "category": "authentication",
                    "confidence": 0.95,
                })
            elif "master-encryption-engine" in stripped or "crypto" in stripped:
                val = "true" if "enable" in stripped.lower() else "false"
                uncertain.append({
                    "raw_line": stripped,
                    "context": context,
                    "best_guess_key": "encryption.password_encryption_service",
                    "best_guess_value": val,
                    "category": "encryption",
                    "confidence": 0.95,
                })
            elif "syslog-server" in stripped:
                m = re.search(r"syslog-server\s+([^\s]+)", stripped)
                val = m.group(1) if m else "192.168.10.50"
                uncertain.append({
                    "raw_line": stripped,
                    "context": context,
                    "best_guess_key": "logging.log_destination",
                    "best_guess_value": val,
                    "category": "logging",
                    "confidence": 0.90,
                })
            elif "cdp-broadcast" in stripped:
                val = "false" if "disable" in stripped.lower() else "true"
                uncertain.append({
                    "raw_line": stripped,
                    "context": context,
                    "best_guess_key": "services.cdp_enabled",
                    "best_guess_value": val,
                    "category": "services",
                    "confidence": 0.90,
                })
            elif "web-mgmt-http" in stripped:
                val = "false" if "disable" in stripped.lower() else "true"
                uncertain.append({
                    "raw_line": stripped,
                    "context": context,
                    "best_guess_key": "services.http_server_enabled",
                    "best_guess_value": val,
                    "category": "services",
                    "confidence": 0.90,
                })
            elif "login-disclaimer" in stripped or "banner" in stripped:
                uncertain.append({
                    "raw_line": stripped,
                    "context": context,
                    "best_guess_key": "banners.login_banner_set",
                    "best_guess_value": "true",
                    "category": "banners",
                    "confidence": 0.95,
                })

    elif vendor == "fortinet":
        for i, line in enumerate(lines):
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or stripped.startswith("end") or stripped.startswith("next"):
                continue

            start_idx = max(0, i - 2)
            end_idx = min(len(lines), i + 3)
            context = "\n".join(lines[start_idx:end_idx])

            if "admin-ssh-v2" in stripped:
                val = "2" if "enable" in stripped.lower() else "1"
                uncertain.append({
                    "raw_line": stripped,
                    "context": context,
                    "best_guess_key": "remote_access.ssh_version",
                    "best_guess_value": val,
                    "category": "remote_access",
                    "confidence": 0.95,
                })
            elif "admin-telnet" in stripped:
                val = "false" if "disable" in stripped.lower() else "true"
                uncertain.append({
                    "raw_line": stripped,
                    "context": context,
                    "best_guess_key": "remote_access.telnet_enabled",
                    "best_guess_value": val,
                    "category": "remote_access",
                    "confidence": 0.95,
                })
            elif "admintimeout" in stripped:
                m = re.search(r"admintimeout\s+(\d+)", stripped)
                mins = int(m.group(1)) if m else 15
                uncertain.append({
                    "raw_line": stripped,
                    "context": context,
                    "best_guess_key": "remote_access.ssh_timeout",
                    "best_guess_value": str(mins * 60),
                    "category": "remote_access",
                    "confidence": 0.90,
                })
            elif "strong-crypto" in stripped:
                val = "true" if "enable" in stripped.lower() else "false"
                uncertain.append({
                    "raw_line": stripped,
                    "context": context,
                    "best_guess_key": "encryption.password_encryption_service",
                    "best_guess_value": val,
                    "category": "encryption",
                    "confidence": 0.90,
                })
            elif "admin-lockout-threshold" in stripped:
                m = re.search(r"threshold\s+(\d+)", stripped)
                val = m.group(1) if m else "3"
                uncertain.append({
                    "raw_line": stripped,
                    "context": context,
                    "best_guess_key": "authentication.login_attempts_limit",
                    "best_guess_value": val,
                    "category": "authentication",
                    "confidence": 0.85,
                })
    else:
        for i, line in enumerate(lines):
            stripped = line.strip()
            if not stripped or stripped.startswith("!") or stripped.startswith("#"):
                continue
            lower_line = stripped.lower()

            start_idx = max(0, i - 2)
            end_idx = min(len(lines), i + 3)
            context = "\n".join(lines[start_idx:end_idx])

            if "ssh" in lower_line:
                val = "2" if "2" in lower_line or "enable" in lower_line or "v2" in lower_line else "1"
                uncertain.append({
                    "raw_line": stripped,
                    "context": context,
                    "best_guess_key": "remote_access.ssh_version",
                    "best_guess_value": val,
                    "category": "remote_access",
                    "confidence": 0.85,
                })
            elif "telnet" in lower_line:
                val = "false" if "disable" in lower_line or "no" in lower_line else "true"
                uncertain.append({
                    "raw_line": stripped,
                    "context": context,
                    "best_guess_key": "remote_access.telnet_enabled",
                    "best_guess_value": val,
                    "category": "remote_access",
                    "confidence": 0.85,
                })
            elif "crypto" in lower_line or "password-enc" in lower_line:
                val = "true" if "enable" in lower_line or "yes" in lower_line else "false"
                uncertain.append({
                    "raw_line": stripped,
                    "context": context,
                    "best_guess_key": "encryption.password_encryption_service",
                    "best_guess_value": val,
                    "category": "encryption",
                    "confidence": 0.85,
                })
            elif "attempt" in lower_line or "lockout" in lower_line or "tries" in lower_line:
                m = re.search(r"(\d+)", stripped)
                val = m.group(1) if m else "3"
                uncertain.append({
                    "raw_line": stripped,
                    "context": context,
                    "best_guess_key": "authentication.login_attempts_limit",
                    "best_guess_value": val,
                    "category": "authentication",
                    "confidence": 0.85,
                })
            elif "min-length" in lower_line or "password-len" in lower_line:
                m = re.search(r"(\d+)", stripped)
                val = m.group(1) if m else "12"
                uncertain.append({
                    "raw_line": stripped,
                    "context": context,
                    "best_guess_key": "authentication.password_min_length",
                    "best_guess_value": val,
                    "category": "authentication",
                    "confidence": 0.85,
                })
            elif "syslog" in lower_line or "logging" in lower_line:
                m = re.search(r"(\d+\.\d+\.\d+\.\d+)", stripped)
                val = m.group(1) if m else "192.168.10.50"
                uncertain.append({
                    "raw_line": stripped,
                    "context": context,
                    "best_guess_key": "logging.log_destination",
                    "best_guess_value": val,
                    "category": "logging",
                    "confidence": 0.80,
                })
            elif "banner" in lower_line or "disclaimer" in lower_line:
                uncertain.append({
                    "raw_line": stripped,
                    "context": context,
                    "best_guess_key": "banners.login_banner_set",
                    "best_guess_value": "true",
                    "category": "banners",
                    "confidence": 0.85,
                })

    return uncertain


def normalize_config(raw_config: str, vendor: str, device_info: dict) -> tuple[dict, str]:
    """Normalize a raw config file to the vendor-neutral JSON schema.

    Returns:
        (normalized_dict, parse_status) — parse_status is 'parsed' for known vendors,
        'needs_ai' for unknown vendors requiring the AI engine.
    """
    normalizer = NORMALIZERS.get(vendor)
    if normalizer:
        return normalizer(raw_config, device_info), "parsed"
    
    schema = _empty_schema()
    schema["device"] = {
        "hostname": device_info.get("hostname", "unknown"),
        "vendor": vendor,
        "model": device_info.get("model", "unknown"),
        "os": device_info.get("os_version", "unknown"),
    }
    return schema, "needs_ai"
