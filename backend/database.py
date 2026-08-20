from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Boolean,
    create_engine, UniqueConstraint,
    text, Date,
    Enum as SAEnum,
    JSON,
)
from datetime import datetime, date
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from enum import Enum

DATABASE_URL = "sqlite:///wordguess.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)

Base = declarative_base()



class GameMode(str, Enum):
    daily = "daily"
    practice = "practice"
    time = "timed"

class GameStatus(str, Enum):
    in_progess = "inprogess"
    won = "won"
    lost = "lost"



class RegisterDb(Base):
    __tablename__ = "users_table"
    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(100), nullable=False, unique=True)
    username = Column(String(60), nullable=False, unique=True)
    password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    profile_image = Column(String(255))


    game_session = relationship("GameSessionDb", back_populates="user", cascade="all,delete-orphan")
    user_stats = relationship("UserStats", back_populates="user", cascade="all,delete-orphan")
    timed_session = relationship("TimedSessionDb", back_populates="user", cascade="all,delete-orphan")

class TimedSessionStatus(str, Enum):
    active = "active"
    ended = "ended"


class WordDb(Base):
    __tablename__ = "words_table"
    id = Column(Integer, primary_key=True, index=True)
    word = Column(String(6), unique=True, nullable=False, index=True)
    length = Column(Integer, nullable=False, index=True)
    is_active = Column(Boolean, nullable=False, default=True)  # secret-word candidate pool; guesses stay valid regardless

class DailyWord(Base):
    __tablename__ = "daily_word_table"
    id = Column(Integer, primary_key=True, index=True)

    word = relationship("WordDb")
    word_id = Column(Integer, ForeignKey("words_table.id"), nullable=False)

    word_length = Column(Integer, nullable=False, index=True)
    date = Column(Date, nullable=False, default=date.today, index=True)

    __table_args__ = (
        UniqueConstraint("date", "word_length", name="uq_date_length"),
    )


class TimedSessionDb(Base):
    __tablename__ = "timed_session_table"
    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users_table.id"), nullable=False)
    word_length = Column(Integer, nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    ends_at = Column(DateTime, nullable=False)  # mutable: extended on bonus-time guesses
    words_solved = Column(Integer, default=0)
    status = Column(SAEnum(TimedSessionStatus), default=TimedSessionStatus.active, nullable=False)

    user = relationship("RegisterDb", back_populates="timed_session")
    game_sessions = relationship("GameSessionDb", back_populates="timed_session")


class GameSessionDb(Base):
    __tablename__ = "game_session_table"
    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users_table.id"), nullable=False)
    mode = Column(SAEnum(GameMode), nullable=False)
    word_length = Column(Integer, nullable=False)
    secret_word_id = Column(Integer, ForeignKey("words_table.id"), nullable=False)
    status = Column(SAEnum(GameStatus), default=GameStatus.in_progess, nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    timed_session_id = Column(Integer, ForeignKey("timed_session_table.id"), nullable=True)

    secret_word = relationship("WordDb")

    user = relationship("RegisterDb", back_populates="game_session")

    guess = relationship("GuessesDb", back_populates="session", cascade="all,delete-orphan", order_by="GuessesDb.guess_number")

    timed_session = relationship("TimedSessionDb", back_populates="game_sessions")

class GuessesDb(Base):
    __tablename__ = "guess_table"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("game_session_table.id"), nullable=False)
    guess_word = Column(String(6), nullable=False)
    result = Column(JSON, nullable=False)

    guess_number = Column(Integer, nullable=False)


    session = relationship("GameSessionDb", back_populates="guess")

class UserStats(Base):
    __tablename__ = "users_stats_table"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users_table.id"), nullable=False)
    mode = Column(SAEnum(GameMode), nullable=False)

    word_length = Column(Integer, nullable=False)
    game_played = Column(Integer, default=0)
    game_won = Column(Integer, default=0)
    game_lost = Column(Integer, default=0)
    current_streak = Column(Integer, default=0)
    best_streak = Column(Integer, default=0)
    total_guesses = Column(Integer, default=0)  # sum of guesses used across WON games (daily/practice avg)
    total_score = Column(Integer, default=0)    # sum of words solved across timed runs (timed avg)
    best_score = Column(Integer, default=0)     # daily/practice: fewest guesses to win. timed: most words solved
    last_played_date = Column(Date, nullable=True)
    score_distribution = Column(JSON, nullable=True)  # {"1": 0, ..., "6": 0} count of wins by guesses used


    user = relationship("RegisterDb", back_populates="user_stats")


    __table_args__ = (
        UniqueConstraint("user_id", "mode", "word_length", name="uq_user_mode_length"),
    )

def _run_lightweight_migrations():
    """This project doesn't use Alembic. `create_all` only creates tables that
    don't exist yet -- it never alters an existing table -- so when a Column
    is added to a model that already has a live table (e.g. new fields added
    to words_table / game_session_table / users_stats_table), that column
    has to be added by hand here or existing rows would 500 on read/write.
    Safe to run every startup: each ALTER is guarded by a table_info check.
    """
    inspector_columns = {}
    with engine.connect() as conn:
        for table in ("words_table", "game_session_table", "users_stats_table"):
            rows = conn.exec_driver_sql(f"PRAGMA table_info({table})").fetchall()
            inspector_columns[table] = {row[1] for row in rows}  # row[1] = column name

        statements = []
        if "is_active" not in inspector_columns["words_table"]:
            statements.append("ALTER TABLE words_table ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1")
        if "timed_session_id" not in inspector_columns["game_session_table"]:
            statements.append("ALTER TABLE game_session_table ADD COLUMN timed_session_id INTEGER")
        if "score_distribution" not in inspector_columns["users_stats_table"]:
            statements.append("ALTER TABLE users_stats_table ADD COLUMN score_distribution JSON")

        for stmt in statements:
            conn.exec_driver_sql(stmt)
        if statements:
            conn.commit()


Base.metadata.create_all(bind=engine)
_run_lightweight_migrations()
