from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from typing import Generator

from app.core.config import settings

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False
    engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
else:
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
