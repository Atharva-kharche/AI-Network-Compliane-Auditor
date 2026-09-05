# NetAudit AI Deployment Architecture

This document outlines the final production deployment architecture for the NetAudit AI system.

## 1. GitHub Repository
- **URL**: https://github.com/Atharva-kharche/AI-Network-Compliane-Auditor
- **Branch**: `main`

## 2. Render Backend
- **Service Name**: netaudit-ai-backend
- **Runtime**: Python 3
- **Python Version**: 3.12.8
- **Root Directory**: `backend`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Health Check**: `/health` (or `/`)
- **Environment Variables**:
  - `PYTHON_VERSION`: 3.12.8
  - `FRONTEND_URL`: https://frontend-liard-omega-93.vercel.app
  - `GEMINI_API_KEY`: <secret>

## 3. Vercel Frontend
- **Project Name**: frontend
- **Framework**: Vite
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**:
  - `VITE_API_URL`: https://ai-network-compliane-auditor.onrender.com
- **CORS Configured**: Yes, Vercel frontend is securely connected to the Render backend.
- **Gemini Configuration**: Key is kept safely in the Render backend environments. Frontend does not expose the key.

## Testing Performed
- **Python Runtime Fix**: Enforced Python 3.12 using `.python-version` and environment variables.
- **Dependency Clean**: Verified `requirements.txt` to contain strictly used dependencies compatible with Python 3.12.
- **Health Check endpoints**: Added and tested `/health`.
- **CORS**: Tested end-to-end between Render API and Vercel UI.
- **Report Generation**: Tested PDF capabilities.
- **AI Integration**: Functional on Render using Gemini securely.

## Known Limitations
- The Render Free tier spins down after inactivity. The first request after a period of inactivity may experience a cold-start delay of up to 50 seconds.
- Storage on Render Free tier is ephemeral. Data saved to SQLite or the local filesystem (such as uploaded PDFs and device configs) will be lost on service restart. For persistent storage in a full production setting, a managed PostgreSQL database and cloud storage bucket (like AWS S3) must be configured.
