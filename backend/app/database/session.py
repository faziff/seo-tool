import sqlite3
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.core.config import settings

# SQLite configuration
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def run_migrations():
    """
    Safely adds any missing columns to existing SQLite tables.
    """
    if not settings.DATABASE_URL.startswith("sqlite"):
        return

    with engine.connect() as conn:
        # Check websites table columns
        try:
            res = conn.execute(text("PRAGMA table_info(websites)")).fetchall()
            col_names = [r[1] for r in res]
            if "user_id" not in col_names:
                conn.execute(text("ALTER TABLE websites ADD COLUMN user_id INTEGER;"))
                conn.commit()
        except Exception:
            pass

        # Check scans table columns
        try:
            res = conn.execute(text("PRAGMA table_info(scans)")).fetchall()
            col_names = [r[1] for r in res]
            if "user_id" not in col_names:
                conn.execute(text("ALTER TABLE scans ADD COLUMN user_id INTEGER;"))
            if "passed_checks_count" not in col_names:
                conn.execute(text("ALTER TABLE scans ADD COLUMN passed_checks_count INTEGER DEFAULT 0;"))
            if "warning_checks_count" not in col_names:
                conn.execute(text("ALTER TABLE scans ADD COLUMN warning_checks_count INTEGER DEFAULT 0;"))
            if "critical_checks_count" not in col_names:
                conn.execute(text("ALTER TABLE scans ADD COLUMN critical_checks_count INTEGER DEFAULT 0;"))
            if "total_checks_count" not in col_names:
                conn.execute(text("ALTER TABLE scans ADD COLUMN total_checks_count INTEGER DEFAULT 0;"))
            conn.commit()
        except Exception:
            pass

        # Check scanned_pages table columns
        try:
            res = conn.execute(text("PRAGMA table_info(scanned_pages)")).fetchall()
            col_names = [r[1] for r in res]
            if "og_title" not in col_names:
                conn.execute(text("ALTER TABLE scanned_pages ADD COLUMN og_title VARCHAR(512);"))
            if "og_image" not in col_names:
                conn.execute(text("ALTER TABLE scanned_pages ADD COLUMN og_image VARCHAR(1024);"))
            if "twitter_card" not in col_names:
                conn.execute(text("ALTER TABLE scanned_pages ADD COLUMN twitter_card VARCHAR(64);"))
            conn.commit()
        except Exception:
            pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
