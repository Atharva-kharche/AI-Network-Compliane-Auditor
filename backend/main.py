"""FastAPI application entry point — AI Network Compliance Auditor."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import init_db

# Import all models so SQLModel registers them before create_all
import models  # noqa: F401

from api.upload import router as upload_router
from api.compliance import router as compliance_router
from api.training import router as training_router
from api.reports import router as reports_router
from api.dashboard import router as dashboard_router

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle hooks."""
    logger.info("Starting %s v%s", settings.APP_NAME, settings.APP_VERSION)
    init_db()
    settings.ensure_dirs()
    logger.info("Database initialized, directories ensured")
    yield
    logger.info("Shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "AI-driven multi-vendor network security compliance auditor. "
        "Upload device configs, run CIS/NIST/STIG audits, train the AI, "
        "and generate professional PDF reports."
    ),
    lifespan=lifespan,
)

# CORS — allow the React frontend in dev + deployed origins
_default_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]
# Add any extra origins from the CORS_ORIGINS env var (comma-separated)
if settings.CORS_ORIGINS:
    _default_origins.extend(
        origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=_default_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",  # All Vercel preview deployments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(upload_router)
app.include_router(compliance_router)
app.include_router(training_router)
app.include_router(reports_router)
app.include_router(dashboard_router)


@app.get("/", tags=["Health"])
def health_check():
    """Root health check endpoint."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


@app.get("/api/v1/health", tags=["Health"])
def api_health():
    """API health check with configuration status."""
    return {
        "status": "healthy",
        "gemini_configured": bool(settings.GEMINI_API_KEY),
        "database": "sqlite",
        "rules_dir_exists": settings.RULES_DIR.exists(),
    }
