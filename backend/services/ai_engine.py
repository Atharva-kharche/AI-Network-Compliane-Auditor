"""AI Engine — Gemini API integration for config parsing (Layer 2 of the pipeline).

Uses structured prompting to extract security-relevant settings from unknown
or partially-recognized vendor configs into the normalized JSON schema.
"""

import json
import logging
from typing import Optional

import google.generativeai as genai
from config import settings

logger = logging.getLogger(__name__)

# The normalized schema that the LLM must output
NORMALIZED_SCHEMA_DESCRIPTION = """
{
  "device": { "hostname": str, "vendor": str, "model": str, "os": str },
  "authentication": {
    "enable_secret_encrypted": bool,
    "local_users": [{ "username": str, "privilege": int, "password_encrypted": bool }],
    "aaa_enabled": bool,
    "password_min_length": int or null,
    "login_attempts_limit": int or null
  },
  "remote_access": {
    "ssh_version": int or null,
    "ssh_timeout": int or null (seconds),
    "telnet_enabled": bool,
    "vty_acl_applied": bool
  },
  "encryption": {
    "password_encryption_service": bool,
    "tls_version": str or null
  },
  "logging": {
    "logging_enabled": bool,
    "log_destination": str or null (IP address),
    "log_severity_level": str or null,
    "log_timestamps": bool
  },
  "services": {
    "cdp_enabled": bool,
    "http_server_enabled": bool,
    "source_routing_disabled": bool,
    "finger_service_disabled": bool
  },
  "access_control": {
    "acls": [{ "name": str, "direction": str, "interface": str }],
    "unused_ports_shutdown": bool
  },
  "ntp": {
    "ntp_authentication": bool,
    "ntp_servers": [str]
  },
  "snmp": {
    "snmp_version": int or null,
    "community_string_default": bool
  },
  "banners": {
    "login_banner_set": bool,
    "motd_banner_set": bool
  }
}
"""

SYSTEM_PROMPT = f"""You are an expert network security configuration parser.
Given a raw network device configuration, extract ALL security-relevant settings
into the following JSON schema. Be thorough and precise.

TARGET SCHEMA:
{NORMALIZED_SCHEMA_DESCRIPTION}

RULES:
1. Output ONLY valid JSON matching the schema above. No markdown, no commentary.
2. Set fields to null if you cannot determine the value from the config.
3. For boolean fields, use true/false based on what the config indicates.
4. For "community_string_default", set to true if default community strings like
   "public" or "private" are found.
5. For "unused_ports_shutdown", check if there are administratively disabled interfaces.
6. If you encounter config lines you are uncertain about, add them to an "uncertain"
   array at the top level. Each entry should be:
   {{"raw_line": "the config line", "best_guess_key": "normalized.path", "best_guess_value": "value", "confidence": 0.0-1.0}}
7. Analyze the ENTIRE config — do not skip sections.
"""


def _get_few_shot_examples(vendor: str, training_mappings: list[dict] = None) -> str:
    """Build few-shot examples from verified training mappings for this vendor."""
    if not training_mappings:
        return ""

    examples = "\n\nHere are verified mappings for this vendor that you should apply:\n"
    for mapping in training_mappings:
        examples += (
            f'- Config line: "{mapping["raw_command"]}" → '
            f'{mapping["normalized_key"]} = {mapping["normalized_value"]} '
            f'(category: {mapping["security_category"]})\n'
        )
    return examples


async def parse_config_with_ai(
    raw_config: str,
    vendor: str = "unknown",
    training_mappings: list[dict] = None,
) -> tuple[dict, list[dict]]:
    """Send a raw config to Gemini for structured extraction.

    Args:
        raw_config: The full raw configuration text.
        vendor: Detected or suspected vendor name.
        training_mappings: Previously verified mappings to inject as few-shot context.

    Returns:
        (normalized_config_dict, uncertain_items_list)
    """
    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not set — returning empty schema with mock data")
        return _mock_ai_response(raw_config, vendor)

    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(settings.GEMINI_MODEL)

        few_shot = _get_few_shot_examples(vendor, training_mappings)

        user_prompt = f"""Vendor hint: {vendor}
{few_shot}

RAW CONFIGURATION:
{raw_config[:15000]}"""  # Truncate to stay within token limits

        response = model.generate_content(
            [
                {"role": "user", "parts": [{"text": SYSTEM_PROMPT}]},
                {"role": "model", "parts": [{"text": "Understood. I will parse the configuration and output only valid JSON matching the schema."}]},
                {"role": "user", "parts": [{"text": user_prompt}]},
            ],
            generation_config=genai.types.GenerationConfig(
                temperature=0.1,  # Low temperature for deterministic extraction
                max_output_tokens=4096,
            ),
        )

        # Parse the response
        response_text = response.text.strip()
        # Remove markdown code fences if present
        if response_text.startswith("```"):
            response_text = response_text.split("\n", 1)[1]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()

        parsed = json.loads(response_text)

        # Extract uncertain items
        uncertain = parsed.pop("uncertain", [])

        return parsed, uncertain

    except json.JSONDecodeError as e:
        logger.error(f"AI response was not valid JSON: {e}")
        return _mock_ai_response(raw_config, vendor)
    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        return _mock_ai_response(raw_config, vendor)


def _mock_ai_response(raw_config: str, vendor: str) -> tuple[dict, list[dict]]:
    """Fallback mock response when the AI API is unavailable.

    Attempts basic extraction from the raw config for demo purposes.
    """
    from services.normalizer import _empty_schema
    schema = _empty_schema()
    uncertain = []

    # Basic extraction attempts
    config_lower = raw_config.lower()

    # Try to find hostname
    import re
    if m := re.search(r'"hostname"[:\s]+"([^"]+)"', raw_config):
        schema["device"]["hostname"] = m.group(1)
    elif m := re.search(r"hostname\s+(\S+)", raw_config):
        schema["device"]["hostname"] = m.group(1)

    schema["device"]["vendor"] = vendor

    # Logging
    if "syslog" in config_lower or "logging" in config_lower or "SYSLOG_SERVER" in raw_config:
        schema["logging"]["logging_enabled"] = True
        if m := re.search(r'"SYSLOG_SERVER"[^}]*"([\d.]+)"', raw_config):
            schema["logging"]["log_destination"] = m.group(1)
        elif m := re.search(r"logging host\s+([\d.]+)", raw_config):
            schema["logging"]["log_destination"] = m.group(1)

    # NTP
    ntp_servers = []
    for m in re.finditer(r'"NTP_SERVER"[^}]*"([\d.]+)"', raw_config):
        ntp_servers.append(m.group(1))
    if not ntp_servers:
        for m in re.finditer(r"ntp server\s+([\d.]+)", raw_config):
            ntp_servers.append(m.group(1))
    schema["ntp"]["ntp_servers"] = ntp_servers

    # SNMP
    if "public" in config_lower and "snmp" in config_lower:
        schema["snmp"]["community_string_default"] = True

    # Banners
    if "banner" in config_lower or "BANNER" in raw_config:
        schema["banners"]["login_banner_set"] = True
        schema["banners"]["motd_banner_set"] = True

    # SSH
    if "ssh" in config_lower or "SSH_SERVER" in raw_config:
        schema["remote_access"]["ssh_version"] = 2

    return schema, uncertain
