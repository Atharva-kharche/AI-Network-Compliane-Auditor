# Architecture Document — AI Network Compliance Auditor

## System Overview

The AI Network Compliance Auditor is a 3-tier monolith application that automates network security compliance auditing across multiple vendors. It uses a unique 3-layer parsing pipeline combining rule-based parsers, LLM-powered extraction (Google Gemini), and human-in-the-loop training.

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    FRONTEND (React SPA)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │Dashboard │ │  Upload  │ │  Audit   │ │   AI Training  │  │
│  │ Charts   │ │ Drag&Drop│ │ Results  │ │   Interface    │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───────┬────────┘  │
└───────┼────────────┼────────────┼────────────────┼───────────┘
        │            │            │                │
        └────────────┴─────┬──────┴────────────────┘
                           │  REST API (Axios → Vite Proxy)
┌──────────────────────────▼───────────────────────────────────┐
│                   BACKEND (FastAPI + Python)                   │
│                                                               │
│  ┌─────────────────── API Layer ──────────────────────────┐  │
│  │ upload.py │ compliance.py │ training.py │ dashboard.py │  │
│  └──────┬────┴───────┬───────┴──────┬──────┴──────┬───────┘  │
│         │            │              │             │           │
│  ┌──────▼────────────▼──────────────▼─────────────▼───────┐  │
│  │              SERVICES (Business Logic)                  │  │
│  │                                                         │  │
│  │  ┌─────────┐   ┌────────────┐   ┌──────────────────┐  │  │
│  │  │Ingestion│──▶│ Normalizer │──▶│ Compliance Engine │  │  │
│  │  │ (vendor │   │ (Cisco,PA, │   │ (rule evaluator,  │  │  │
│  │  │  detect)│   │  Juniper)  │   │  8 operators)     │  │  │
│  │  └─────────┘   └──────┬─────┘   └────────┬──────────┘  │  │
│  │                       │                    │             │  │
│  │                 ┌─────▼─────┐       ┌─────▼──────┐     │  │
│  │                 │ AI Engine │       │ PDF Report  │     │  │
│  │                 │ (Gemini)  │       │ Generator   │     │  │
│  │                 └─────┬─────┘       └────────────┘     │  │
│  └───────────────────────┼─────────────────────────────────┘  │
└──────────────────────────┼────────────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │    Google Gemini API     │
              │  (structured prompting) │
              └─────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                      DATA LAYER                               │
│  ┌──────────┐  ┌────────────────┐  ┌──────────────────────┐ │
│  │  SQLite  │  │ File Storage   │  │  Compliance Rules    │ │
│  │ (5 tables│  │ uploads/       │  │  cis_benchmarks.json │ │
│  │  via     │  │ reports/       │  │  nist_sp800_53.json  │ │
│  │ SQLModel)│  │                │  │  stig_rules.json     │ │
│  └──────────┘  └────────────────┘  └──────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Core Data Flow

### Upload → Normalize → Audit → Report

1. **Upload**: User uploads a raw config file via drag-and-drop
2. **Ingestion**: System detects vendor using pattern matching (5 vendor signatures)
3. **Normalization**: 
   - Known vendors (Cisco/PA/Juniper) → regex-based rule parsers
   - Unknown vendors → Gemini API with structured prompts
   - Low-confidence results → queued for human review
4. **Storage**: Raw config and normalized JSON stored in SQLite
5. **Audit**: Compliance engine evaluates normalized JSON against rule sets
6. **Results**: Pass/fail per rule with actual vs expected values and remediation
7. **Report**: ReportLab generates a multi-page PDF

### Vendor-Neutral Schema

All vendor configs are normalized into a universal JSON format with 10 security categories:
- `authentication`, `remote_access`, `encryption`, `logging`, `services`
- `access_control`, `ntp`, `snmp`, `banners`, `device`

## Database Design

5 tables: `devices`, `config_files`, `compliance_results`, `audit_reports`, `training_mappings`

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Monolith over microservices | Simplicity | Single deployment, no orchestration needed |
| SQLite over PostgreSQL | Zero-config | No server setup, single file database |
| Gemini over custom NLP | Speed to deploy | No training data needed, works out-of-box |
| ReportLab over HTML-to-PDF | Control | Fine-grained layout control for professional reports |
| Mock AI fallback | Reliability | Demo works even without API key |

## Compliance Engine

Supports 8 operators: `equals`, `not_equals`, `greater_than`, `less_than`, `exists`, `not_exists`, `in`, `contains`

35+ rules across CIS Benchmarks (~15), NIST SP 800-53 (~10), and STIG (~10).
