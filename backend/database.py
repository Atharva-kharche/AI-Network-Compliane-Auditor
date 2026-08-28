"""SQLite database engine and session management."""

from sqlmodel import SQLModel, create_engine, Session
from config import settings

engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    connect_args={"check_same_thread": False},  # Required for SQLite + FastAPI
)


def init_db():
    """Create all tables on startup."""
    SQLModel.metadata.create_all(engine)


def get_session():
    """Dependency: yields a DB session per request."""
    with Session(engine) as session:
        yield session
