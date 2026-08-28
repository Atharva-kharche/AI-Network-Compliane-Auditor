# 🛡️ AI Network Compliance Auditor

**AI-driven multi-vendor network security compliance auditor** — upload device configs, run CIS/NIST/STIG audits, train the AI on unknown vendors, and generate professional PDF reports.

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_AI-4285F4?logo=google&logoColor=white)

---

## ✨ Features

- **Multi-Vendor Support** — Cisco IOS, Palo Alto PAN-OS, Juniper JunOS, Arista EOS, SONiC, and any unknown vendor via AI
- **3-Layer Parsing Pipeline**
  - **Layer 1**: Rule-based regex parsers for known vendors (fast, deterministic)
  - **Layer 2**: Google Gemini API for unknown/partially-recognized configs (AI-powered)
  - **Layer 3**: Human-in-the-loop training interface for continuous learning
- **Compliance Frameworks** — 35+ rules across CIS Benchmarks, NIST SP 800-53, and STIG
- **Vendor-Neutral Normalization** — All configs mapped to a universal JSON schema
- **Professional PDF Reports** — Auto-generated with cover page, findings, and remediation
- **Interactive Dashboard** — Charts, stats, risk distribution, recent activity
- **Dark Mode UI** — Premium glassmorphism design with smooth animations

---

## 🏗️ Architecture

```
┌─────────────────────────────────┐
│     Frontend — React (Vite)     │
│  Dashboard │ Upload │ Training  │
│  Audit     │ Reports│ Devices   │
└────────────┬────────────────────┘
             │ REST API
┌────────────▼────────────────────┐
│     Backend — FastAPI (Python)  │
│  Upload │ Compliance │ Reports  │
│  Training │ Dashboard │ AI      │
├─────────────────────────────────┤
│         Services Layer          │
│  Ingestion → Normalizer → AI   │
│  Compliance Engine → PDF Gen   │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│          Data Layer             │
│  SQLite │ File Storage │ Rules  │
└─────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- (Optional) Google Gemini API key for AI-powered parsing

### 1. Clone & Setup Backend

```bash
git clone https://github.com/your-username/AI-Network-Compliance-Auditor.git
cd AI-Network-Compliance-Auditor

# Install Python dependencies
cd backend
pip install -r requirements.txt

# (Optional) Configure Gemini API key
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

### 2. Setup Frontend

```bash
cd ../frontend
npm install
```

### 3. Run

**Terminal 1 — Backend:**
```bash
cd backend
python -m uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## 📖 Usage

1. **Upload** — Drag & drop a network device config file (`.txt`, `.conf`, `.cfg`, `.json`)
2. **Auto-Detection** — System detects the vendor, hostname, OS version automatically
3. **Run Audit** — Select CIS, NIST, or STIG framework and run compliance checks
4. **Review Results** — See pass/fail for each rule, with actual vs expected values
5. **Generate PDF** — Download a professional compliance report
6. **Train AI** — Map unknown config commands to teach the system new vendors

### Sample Configs Included

| File | Vendor | Type |
|---|---|---|
| `cisco_ios_router.txt` | Cisco IOS | Router |
| `paloalto_fw.txt` | Palo Alto PAN-OS | Firewall |
| `juniper_srx.txt` | Juniper JunOS | Firewall |
| `arista_eos.txt` | Arista EOS | Switch |
| `sonic_switch.txt` | SONiC | Switch |

---

## 🛠️ Tech Stack

### Backend
| Component | Technology |
|---|---|
| Web Framework | FastAPI + Uvicorn |
| Database | SQLite (via SQLModel) |
| AI/NLP | Google Gemini API |
| PDF Reports | ReportLab |
| Validation | Pydantic |

### Frontend
| Component | Technology |
|---|---|
| Framework | React 19 (Vite 8) |
| HTTP Client | Axios |
| Routing | React Router DOM |
| Charts | Recharts |
| Icons | Lucide React |
| Notifications | React Hot Toast |

---

## 📡 API Endpoints

All endpoints prefixed with `/api/v1`. Full Swagger docs available at `http://localhost:8000/docs`.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/upload` | Upload config file |
| `POST` | `/upload/bulk` | Bulk upload multiple files |
| `GET` | `/devices` | List all devices |
| `GET` | `/devices/{id}` | Get device details |
| `DELETE` | `/devices/{id}` | Delete a device |
| `POST` | `/audit` | Trigger compliance audit |
| `POST` | `/audit/bulk` | Bulk audit |
| `GET` | `/audit/results/{device_id}` | Get audit results |
| `GET` | `/audit/summary/{device_id}` | Get audit summary |
| `GET` | `/training/pending` | Pending training items |
| `POST` | `/training/map` | Submit mapping |
| `GET` | `/training/mappings` | All mappings |
| `POST` | `/reports/generate/{device_id}` | Generate PDF |
| `GET` | `/reports/download/{report_id}` | Download PDF |
| `GET` | `/dashboard/stats` | Dashboard stats |
| `GET` | `/dashboard/risk-distribution` | Risk breakdown |

---

## 📁 Project Structure

```
AI-Network-Compliance-Auditor/
├── backend/
│   ├── main.py                  # FastAPI entry point
│   ├── config.py                # Settings & env vars
│   ├── database.py              # SQLite setup
│   ├── models/                  # SQLModel ORM models
│   ├── schemas/                 # Pydantic request/response schemas
│   ├── api/                     # Route handlers
│   ├── services/                # Business logic
│   │   ├── __init__.py          # Vendor detection & ingestion
│   │   ├── normalizer.py        # Config → vendor-neutral JSON
│   │   ├── ai_engine.py         # Gemini API integration
│   │   ├── compliance_engine.py # Rule evaluator
│   │   └── pdf_generator.py     # ReportLab PDF builder
│   ├── compliance_rules/        # CIS, NIST, STIG rule sets (JSON)
│   ├── sample_configs/          # 5 demo config files
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/          # Sidebar, ScoreGauge, FileUploader, etc.
│   │   ├── pages/               # Dashboard, Upload, Audit, Training, etc.
│   │   ├── services/api.js      # Axios API layer
│   │   └── index.css            # Design system
│   └── package.json
├── docs/
│   └── architecture.md          # Architecture documentation
└── README.md
```

---

## 🤖 AI Strategy

The system uses a **3-layer parsing pipeline**:

1. **Rule-Based (Layer 1)** — Regex parsers for Cisco, Palo Alto, Juniper — fast and deterministic
2. **LLM-Powered (Layer 2)** — Gemini API with structured prompts for unknown vendors — truly vendor-agnostic
3. **Human Feedback (Layer 3)** — Admin maps uncertain commands → saved as few-shot examples for future runs

> The AI works **without a Gemini API key** — a mock fallback mode provides basic extraction for demo purposes.

---

## 📄 License

MIT
