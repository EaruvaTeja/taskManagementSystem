
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, sessionmaker


# Store the SQLite database inside the backend folder.
DATABASE_PATH = Path(__file__).resolve().parent.parent / "tasks.db"

DATABASE_URL = URL.create(
    drivername="sqlite",
    database=str(DATABASE_PATH),
)

# Create the database engine.
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

# Create database sessions for application operations.
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


# Base class for all SQLAlchemy database models.
class Base(DeclarativeBase):
    pass

# Database Session
def get_db():
    """Provide a database session for a request."""
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()
