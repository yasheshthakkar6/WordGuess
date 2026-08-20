from pydantic import BaseModel, ConfigDict, EmailStr, field_validator
from datetime import datetime, date as date_type
from typing import Optional, List, Dict
from database import GameMode, GameStatus, TimedSessionStatus


# ---------- Auth ----------

class RegisterSchema(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    username: str
    password: str
    password2: str
    profile_image: Optional[str] = None

    @field_validator("password2")
    @classmethod
    def passwords_match(cls, v, info):
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match")
        return v


class LoginSchema(BaseModel):
    username: str
    password: str


# ---------- Game: start ----------

class GameStartRequest(BaseModel):
    mode: GameMode
    word_length: int

    @field_validator("word_length")
    @classmethod
    def valid_length(cls, v):
        if v not in (4, 5, 6):
            raise ValueError("word_length must be 4, 5, or 6")
        return v


class GameStartResponse(BaseModel):
    session_id: int
    mode: GameMode
    word_length: int
    status: GameStatus

    model_config = ConfigDict(from_attributes=True)


# ---------- Game: guess ----------

class GuessRequest(BaseModel):
    guess: str

    @field_validator("guess")
    @classmethod
    def normalize(cls, v):
        v = v.strip().lower()
        if not v.isalpha():
            raise ValueError("guess must contain only letters")
        return v


class GuessResponse(BaseModel):
    guess_word: str
    result: List[str]
    guess_number: int
    status: GameStatus
    secret_word: Optional[str] = None  # only populated once the game ends
    letter_counts: Optional[Dict[str, int]] = None  # total occurrences in the secret, for letters guessed so far

    model_config = ConfigDict(from_attributes=True)


class SessionStateResponse(BaseModel):
    session_id: int
    mode: GameMode
    word_length: int
    status: GameStatus
    guesses: List[GuessResponse]

    model_config = ConfigDict(from_attributes=True)


class ForfeitResponse(BaseModel):
    session_id: int
    status: GameStatus  # always 'lost'
    secret_word: str
    guesses_used: int


# ---------- Game: timed mode ----------

class TimedStartRequest(BaseModel):
    word_length: int

    @field_validator("word_length")
    @classmethod
    def valid_length(cls, v):
        if v not in (4, 5, 6):
            raise ValueError("word_length must be 4, 5, or 6")
        return v


class TimedStartResponse(BaseModel):
    timed_session_id: int
    game_session_id: int
    word_length: int
    words_solved: int
    ends_at: datetime
    status: TimedSessionStatus

    model_config = ConfigDict(from_attributes=True)


class TimedGuessRequest(BaseModel):
    guess: str

    @field_validator("guess")
    @classmethod
    def normalize(cls, v):
        v = v.strip().lower()
        if not v.isalpha():
            raise ValueError("guess must contain only letters")
        return v


class TimedGuessResponse(BaseModel):
    time_up: bool
    words_solved: int
    ends_at: datetime
    guess_word: Optional[str] = None
    result: Optional[List[str]] = None
    letter_counts: Optional[Dict[str, int]] = None
    word_won: bool = False
    bonus_seconds: int = 0
    next_game_session_id: Optional[int] = None
    secret_word: Optional[str] = None  # revealed for the in-progress word once time_up


class TimedForfeitResponse(BaseModel):
    timed_session_id: int
    words_solved: int
    secret_word: Optional[str] = None  # the word that was in progress when the run was forfeited


class TimedStatusResponse(BaseModel):
    timed_session_id: int
    word_length: int
    words_solved: int
    ends_at: datetime
    status: TimedSessionStatus
    current_game_session_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


# ---------- Game: daily / calendar ----------

class DailyLengthStatus(BaseModel):
    word_length: int
    played: bool
    status: Optional[GameStatus] = None
    guesses_used: Optional[int] = None
    session_id: Optional[int] = None


class DailyTodayResponse(BaseModel):
    date: date_type
    next_reset_at: datetime  # UTC instant the next daily word becomes available
    lengths: List[DailyLengthStatus]


class CalendarDayEntry(BaseModel):
    date: date_type
    word_length: int
    status: str  # "not_played" | "in_progress" | "won" | "lost"


class CalendarResponse(BaseModel):
    month: str  # "YYYY-MM"
    days: List[CalendarDayEntry]


# ---------- Stats ----------

class StatsResponse(BaseModel):
    mode: GameMode
    word_length: int
    games_played: int
    games_won: int
    win_percentage: float
    current_streak: int
    best_streak: int
    average_guesses: float
    best_score: int

    model_config = ConfigDict(from_attributes=True)


class DistributionResponse(BaseModel):
    mode: GameMode
    word_length: int
    distribution: List[int]  # counts of wins that took 1..6 guesses