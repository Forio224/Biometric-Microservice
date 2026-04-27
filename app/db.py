from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.config import settings

def _normalize_database_url(database_url: str) -> str:
    # Force SQLAlchemy to use psycopg v3 driver to avoid psycopg2/libpq
    # Unicode decoding issues on some Windows setups.
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return database_url


engine = create_engine(_normalize_database_url(settings.database_url))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()

