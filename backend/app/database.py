from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

is_sqlite = settings.database_url.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

engine = create_engine(settings.database_url, connect_args=connect_args)

if is_sqlite:
    # WAL lets readers and writers work concurrently instead of locking the whole
    # file on every write; foreign_keys=ON makes SQLite actually enforce the FK
    # constraints declared on the models (off by default per-connection otherwise).
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, _record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    from app import models  # noqa: F401  (ensures all models are registered)

    Base.metadata.create_all(bind=engine)
