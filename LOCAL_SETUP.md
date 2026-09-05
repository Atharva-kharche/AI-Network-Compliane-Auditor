# NetAudit AI - Local Development Guide

This guide explains how to run the NetAudit AI project completely locally, acting as a backup in case Vercel or Render is down.

## Prerequisites
- Node.js (v18+)
- Python 3.12+

## 1. Backend Setup (FastAPI)

1. Open a terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. (Optional but recommended) Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows: venv\Scripts\activate
   # On Mac/Linux: source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up your local environment variables:
   - Create a file named `.env` in the `backend` directory (you can copy `.env.example`).
   - Add your Gemini API key:
     ```env
     GEMINI_API_KEY=your_actual_key_here
     ```
   *(Note: The `.env` file is ignored by Git, so your secret is safe).*

5. Start the backend server:
   ```bash
   python -m uvicorn main:app --reload --port 8000
   ```
   The backend will be available at `http://localhost:8000`.

## 2. Frontend Setup (React/Vite)

1. Open a *new* terminal and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. The frontend is already configured to read `.env.local` which points to your local backend.
   *(We have created `frontend/.env.local` with `VITE_API_URL=http://localhost:8000`).*
4. Start the frontend development server:
   ```bash
   npm run dev
   ```
   The frontend will be available at `http://localhost:5173`.

## 3. Verify Local Functionality
- Open `http://localhost:5173` in your browser.
- Try uploading a sample configuration from `backend/sample_configs`.
- The dashboard, PDF generation, and AI features (if GEMINI_API_KEY is set) will all communicate with your local backend (`http://localhost:8000`) instead of the production Render server.

## Note on Production
Your local setup will not interfere with production. When pushing to GitHub, Vercel will still use the production URL (`https://ai-network-compliane-auditor.onrender.com`) defined in `frontend/vercel.json`, and Render will continue to use its own environment variables.
