"""Vercel Serverless Function entry point.

This module wraps the FastAPI application so Vercel's Python runtime
can invoke it as a serverless function. All /api/* requests are routed
here via vercel.json rewrites.
"""

import sys
from pathlib import Path

# Add the backend directory to Python's module search path so that
# imports like `from config import settings` resolve correctly.
_backend_dir = str(Path(__file__).resolve().parent.parent / "backend")
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

# Import the FastAPI app — this is what Vercel's ASGI adapter invokes.
from main import app  # noqa: E402, F401

# Vercel's Python runtime automatically detects the `app` ASGI object.
