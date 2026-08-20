from collections import Counter
from datetime import datetime, date, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import (
    SessionLocal,
    WordDb,
    DailyWord,
    GameSessionDb,
    GuessesDb,
    UserStats,
    RegisterDb,
    TimedSessionDb,
    GameMode,
    GameStatus,
    TimedSessionStatus,
)
from schemas import (
    GameStartRequest,
    GameStartResponse,
    GuessRequest,
    GuessResponse,
    SessionStateResponse,
    ForfeitResponse,
    TimedStartRequest,
    TimedStartResponse,
    TimedGuessRequest,
    TimedGuessResponse,
    TimedForfeitResponse,
    TimedStatusResponse,
    DailyLengthStatus,
    DailyTodayResponse,
    CalendarDayEntry,
    CalendarResponse,
    StatsResponse,
    DistributionResponse,
)
from auth import autenticat_curr_user

router = APIRouter(tags=["game"])

MAX_TRIES = 6
WORD_LENGTHS = (4, 5, 6)
TIMED_DURATION = timedelta(minutes=5)

# All "day" boundaries (daily word reset, streak accounting, calendar) are anchored
# to UTC rather than server-local time, so behavior doesn't depend on where the
# server happens to be hosted / its local clock's timezone.


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _utc_now() -> datetime:
    # Naive UTC on purpose: SQLite DateTime columns store naive values, and the
    # rest of this codebase's models already use naive datetime.utcnow() too.
    # Mixing naive and aware datetimes here would raise on comparison, so every
    # timestamp that touches the DB (started_at/ended_at/ends_at) goes through
    # this helper rather than datetime.now(timezone.utc) directly.
    return datetime.utcnow()


def _utc_today() -> date:
    return _utc_now().date()


def _aware(dt: datetime) -> datetime:
    """Stamp a naive UTC datetime with tzinfo before it goes into an API response.

    Storage stays naive (matches every DateTime column / _utc_now() in this
    codebase), but a naive value serializes with no 'Z'/offset suffix -- and a
    JS `new Date("...")` on the client parses a timezone-less ISO string as
    LOCAL time, not UTC. For any user not in UTC+0 that silently shifts the
    instant by their UTC offset, which is exactly why the timed-mode countdown
    could read as already-expired the moment a session started. Every absolute
    instant handed to the frontend for its own arithmetic (ends_at) needs to
    round-trip through this so it serializes with an explicit UTC marker.
    """
    return dt.replace(tzinfo=timezone.utc)


# ---------- scoring ----------

def score_guess(guess: str, secret: str) -> list[str]:
    """Standard wordle-style scoring that correctly handles repeated letters.

    Pass 1 marks exact position matches as 'correct' and removes them from the
    pool of letters still available to match. Pass 2 marks remaining letters as
    'present' or 'absent' against what's left in that pool, so a guess with two
    of the same letter only gets credit for as many as actually appear left in
    the secret word.
    """
    result = ["absent"] * len(guess)
    remaining = Counter(secret)

    for i, ch in enumerate(guess):
        if ch == secret[i]:
            result[i] = "correct"
            remaining[ch] -= 1

    for i, ch in enumerate(guess):
        if result[i] == "correct":
            continue
        if remaining[ch] > 0:
            result[i] = "present"
            remaining[ch] -= 1

    return result


def _letter_counts(guess: str, secret: str) -> dict[str, int]:
    """How many times each guessed letter actually occurs in the secret word.
    Only covers letters the player has already guessed -- never leaks letters
    they haven't tried -- so the frontend can badge "this letter repeats"
    once it's been found, without revealing the rest of the word."""
    secret_counts = Counter(secret)
    return {ch: secret_counts[ch] for ch in set(guess) if secret_counts[ch] > 0}


# ---------- helpers ----------

def _pick_random_word(db: Session, word_length: int, exclude_ids=None) -> WordDb:
    q = db.query(WordDb).filter(WordDb.length == word_length, WordDb.is_active.is_(True))
    if exclude_ids:
        q = q.filter(WordDb.id.notin_(exclude_ids))
    word = q.order_by(func.random()).first()
    if not word and exclude_ids:
        # exhausted the "unseen" pool (rare) -- allow repeats rather than dead-ending the run
        word = (
            db.query(WordDb)
            .filter(WordDb.length == word_length, WordDb.is_active.is_(True))
            .order_by(func.random())
            .first()
        )
    if not word:
        raise HTTPException(
            status_code=500,
            detail=f"No {word_length}-letter words seeded yet. Run the seed script.",
        )
    return word


def _get_or_create_daily_word(db: Session, word_length: int) -> DailyWord:
    today = _utc_today()
    daily = (
        db.query(DailyWord)
        .filter(DailyWord.date == today, DailyWord.word_length == word_length)
        .first()
    )
    if daily:
        return daily

    word = _pick_random_word(db, word_length)
    daily = DailyWord(word_id=word.id, word_length=word_length, date=today)
    db.add(daily)
    db.commit()
    db.refresh(daily)
    return daily


def _get_or_create_stats(db: Session, user_id: int, mode: GameMode, word_length: int) -> UserStats:
    stats = (
        db.query(UserStats)
        .filter(
            UserStats.user_id == user_id,
            UserStats.mode == mode,
            UserStats.word_length == word_length,
        )
        .first()
    )
    if not stats:
        stats = UserStats(
            user_id=user_id,
            mode=mode,
            word_length=word_length,
            score_distribution={str(n): 0 for n in range(1, MAX_TRIES + 1)},
        )
        db.add(stats)
        db.flush()
    if stats.score_distribution is None:
        stats.score_distribution = {str(n): 0 for n in range(1, MAX_TRIES + 1)}
    return stats


def _apply_win_loss_stats(db: Session, session: GameSessionDb, won: bool, guesses_used: int = 0):
    """Update UserStats after a daily/practice/timed game ends.

    guesses_used is taken as an explicit argument rather than len(session.guess):
    callers that compute a guess_number earlier in the same request (guess_number
    = len(session.guess) + 1, *before* the new GuessesDb row is added) leave that
    relationship cached and stale on the ORM object for the rest of the request --
    the new guess is added via a raw session_id= FK, not the relationship, so
    SQLAlchemy has no way to know the cached collection needs to grow. Re-deriving
    the count here would silently read that stale cache instead of the real value.
    """
    stats = _get_or_create_stats(db, session.user_id, session.mode, session.word_length)
    today = _utc_today()

    stats.game_played += 1
    if won:
        stats.game_won += 1
        stats.total_guesses += guesses_used
        if stats.best_score == 0 or guesses_used < stats.best_score:
            stats.best_score = guesses_used
        if 1 <= guesses_used <= MAX_TRIES:
            key = str(guesses_used)
            distribution = dict(stats.score_distribution or {})
            distribution[key] = distribution.get(key, 0) + 1
            stats.score_distribution = distribution  # reassign so SQLAlchemy detects the JSON change
    else:
        stats.game_lost += 1

    if session.mode == GameMode.daily:
        # calendar-day based streak: only continues if the previous play was yesterday (UTC)
        if won:
            if stats.last_played_date and (today - stats.last_played_date).days == 1:
                stats.current_streak += 1
            else:
                stats.current_streak = 1
        else:
            stats.current_streak = 0
        stats.last_played_date = today
    else:
        # practice: pure win-streak, not date gated
        stats.current_streak = stats.current_streak + 1 if won else 0
        stats.last_played_date = today

    stats.best_streak = max(stats.best_streak, stats.current_streak)
    db.commit()


def _finalize_timed_session(db: Session, timed: TimedSessionDb, won: bool = False, guesses_used: int = 0):
    """Ends a timed run and scores it. Since the redesign, timed mode is
    "solve this one word before time runs out" -- the same win/loss shape as
    practice -- so it's scored through the exact same _apply_win_loss_stats
    path practice uses (games played/won/lost, streak, avg guesses, guess
    distribution), rather than the old "words solved per run" tally."""
    if timed.status == TimedSessionStatus.ended:
        return
    timed.status = TimedSessionStatus.ended

    # the word that was in progress when the run ended never got a win/loss of its
    # own (timed guesses are unlimited) -- close it out rather than leaving it
    # dangling in 'inprogess' forever, which would otherwise look like an active
    # word to any future query that filters on that status for this timed session.
    # On a win the caller already flipped this same row to 'won' before calling in,
    # so it won't show up here -- that's expected, not a missed row.
    current_word = (
        db.query(GameSessionDb)
        .filter(GameSessionDb.timed_session_id == timed.id, GameSessionDb.status == GameStatus.in_progess)
        .first()
    )
    if current_word:
        current_word.status = GameStatus.lost
        current_word.ended_at = _utc_now()

    scored_session = current_word or (
        db.query(GameSessionDb)
        .filter(GameSessionDb.timed_session_id == timed.id)
        .order_by(GameSessionDb.id.desc())
        .first()
    )
    if scored_session:
        _apply_win_loss_stats(db, scored_session, won, guesses_used)

    db.commit()


def _to_start_response(session: GameSessionDb) -> GameStartResponse:
    return GameStartResponse(
        session_id=session.id,
        mode=session.mode,
        word_length=session.word_length,
        status=session.status,
    )


def _guess_to_response(g: GuessesDb, status: GameStatus, secret: str | None) -> GuessResponse:
    return GuessResponse(
        guess_word=g.guess_word,
        result=g.result,
        guess_number=g.guess_number,
        status=status,
        secret_word=secret,
        letter_counts=_letter_counts(g.guess_word, secret) if secret else None,
    )


# ---------- routes: core game ----------

@router.post("/game/start", response_model=GameStartResponse)
def start_game(
    body: GameStartRequest,
    db: Session = Depends(get_db),
    current_user: RegisterDb = Depends(autenticat_curr_user),
):
    if body.mode == GameMode.time:
        raise HTTPException(status_code=400, detail="Use /game/timed/start for timed mode")

    if body.mode == GameMode.daily:
        daily = _get_or_create_daily_word(db, body.word_length)
        existing = (
            db.query(GameSessionDb)
            .filter(
                GameSessionDb.user_id == current_user.id,
                GameSessionDb.mode == GameMode.daily,
                GameSessionDb.word_length == body.word_length,
                GameSessionDb.secret_word_id == daily.word_id,
            )
            .order_by(GameSessionDb.id.desc())
            .first()
        )
        if existing:
            return _to_start_response(existing)
        word_id = daily.word_id
    else:
        word_id = _pick_random_word(db, body.word_length).id

    session = GameSessionDb(
        user_id=current_user.id,
        mode=body.mode,
        word_length=body.word_length,
        secret_word_id=word_id,
        status=GameStatus.in_progess,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _to_start_response(session)


@router.post("/game/guess/{session_id}", response_model=GuessResponse)
def submit_guess(
    session_id: int,
    body: GuessRequest,
    db: Session = Depends(get_db),
    current_user: RegisterDb = Depends(autenticat_curr_user),
):
    session = db.query(GameSessionDb).filter(GameSessionDb.id == session_id).first()
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Game session not found")
    if session.mode == GameMode.time:
        raise HTTPException(status_code=400, detail="Use /game/timed/{timed_session_id}/guess for timed mode")
    if session.status != GameStatus.in_progess:
        raise HTTPException(status_code=400, detail="This game has already ended")

    guess = body.guess
    if len(guess) != session.word_length:
        raise HTTPException(
            status_code=400,
            detail=f"Guess must be {session.word_length} letters",
        )

    valid = db.query(WordDb).filter(WordDb.word == guess, WordDb.length == session.word_length).first()
    if not valid:
        raise HTTPException(status_code=400, detail="Not in word list")

    secret = session.secret_word.word
    result = score_guess(guess, secret)
    guess_number = len(session.guess) + 1

    won = guess == secret
    out_of_tries = guess_number >= MAX_TRIES

    if won:
        session.status = GameStatus.won
    elif out_of_tries:
        session.status = GameStatus.lost

    game_over = session.status != GameStatus.in_progess
    if game_over:
        session.ended_at = _utc_now()

    guess_row = GuessesDb(
        session_id=session.id,
        guess_word=guess,
        result=result,
        guess_number=guess_number,
    )
    db.add(guess_row)
    db.commit()
    db.refresh(session)

    if game_over:
        _apply_win_loss_stats(db, session, won, guess_number)

    return GuessResponse(
        guess_word=guess,
        result=result,
        guess_number=guess_number,
        status=session.status,
        secret_word=secret if game_over else None,
        letter_counts=_letter_counts(guess, secret),
    )


@router.get("/game/session/{session_id}", response_model=SessionStateResponse)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: RegisterDb = Depends(autenticat_curr_user),
):
    session = db.query(GameSessionDb).filter(GameSessionDb.id == session_id).first()
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Game session not found")

    game_over = session.status != GameStatus.in_progess
    secret = session.secret_word.word
    last_index = len(session.guess) - 1

    guesses = []
    for i, g in enumerate(session.guess):
        is_last = i == last_index
        resp = _guess_to_response(
            g,
            status=session.status if is_last else GameStatus.in_progess,
            secret=secret,  # letter_counts is safe for every past guess -- it only ever
        )  # reveals counts for letters that particular guess already contained
        if not (game_over and is_last):
            resp.secret_word = None  # full word stays hidden until the final, game-ending guess
        guesses.append(resp)

    return SessionStateResponse(
        session_id=session.id,
        mode=session.mode,
        word_length=session.word_length,
        status=session.status,
        guesses=guesses,
    )


@router.post("/game/forfeit/{session_id}", response_model=ForfeitResponse)
def forfeit_game(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: RegisterDb = Depends(autenticat_curr_user),
):
    session = db.query(GameSessionDb).filter(GameSessionDb.id == session_id).first()
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Game session not found")
    if session.mode == GameMode.time:
        raise HTTPException(status_code=400, detail="Use /game/timed/{timed_session_id}/forfeit for timed mode")
    if session.status != GameStatus.in_progess:
        raise HTTPException(status_code=400, detail="This game has already ended")

    session.status = GameStatus.lost
    session.ended_at = _utc_now()
    db.commit()
    db.refresh(session)

    _apply_win_loss_stats(db, session, won=False)

    return ForfeitResponse(
        session_id=session.id,
        status=session.status,
        secret_word=session.secret_word.word,
        guesses_used=len(session.guess),
    )


# ---------- routes: daily / calendar ----------

@router.get("/game/daily/today", response_model=DailyTodayResponse)
def daily_today(
    db: Session = Depends(get_db),
    current_user: RegisterDb = Depends(autenticat_curr_user),
):
    today = _utc_today()
    next_reset_at = datetime(today.year, today.month, today.day, tzinfo=timezone.utc) + timedelta(days=1)

    lengths = []
    for word_length in WORD_LENGTHS:
        daily = (
            db.query(DailyWord)
            .filter(DailyWord.date == today, DailyWord.word_length == word_length)
            .first()
        )
        if not daily:
            lengths.append(DailyLengthStatus(word_length=word_length, played=False))
            continue

        session = (
            db.query(GameSessionDb)
            .filter(
                GameSessionDb.user_id == current_user.id,
                GameSessionDb.mode == GameMode.daily,
                GameSessionDb.word_length == word_length,
                GameSessionDb.secret_word_id == daily.word_id,
            )
            .order_by(GameSessionDb.id.desc())
            .first()
        )
        if not session:
            lengths.append(DailyLengthStatus(word_length=word_length, played=False))
        else:
            lengths.append(
                DailyLengthStatus(
                    word_length=word_length,
                    played=True,
                    status=session.status,
                    guesses_used=len(session.guess),
                    session_id=session.id,
                )
            )

    return DailyTodayResponse(date=today, next_reset_at=next_reset_at, lengths=lengths)


@router.get("/game/calendar", response_model=CalendarResponse)
def calendar(
    month: str,
    db: Session = Depends(get_db),
    current_user: RegisterDb = Depends(autenticat_curr_user),
):
    try:
        month_start = datetime.strptime(month, "%Y-%m").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="month must be formatted YYYY-MM")

    next_month = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)

    daily_words = (
        db.query(DailyWord)
        .filter(DailyWord.date >= month_start, DailyWord.date < next_month)
        .all()
    )

    days = []
    for daily in daily_words:
        session = (
            db.query(GameSessionDb)
            .filter(
                GameSessionDb.user_id == current_user.id,
                GameSessionDb.mode == GameMode.daily,
                GameSessionDb.word_length == daily.word_length,
                GameSessionDb.secret_word_id == daily.word_id,
            )
            .order_by(GameSessionDb.id.desc())
            .first()
        )
        if not session:
            status = "not_played"
        elif session.status == GameStatus.in_progess:
            status = "in_progress"
        elif session.status == GameStatus.won:
            status = "won"
        else:
            status = "lost"

        days.append(CalendarDayEntry(date=daily.date, word_length=daily.word_length, status=status))

    return CalendarResponse(month=month, days=days)


# ---------- routes: timed mode ----------

@router.post("/game/timed/start", response_model=TimedStartResponse)
def start_timed(
    body: TimedStartRequest,
    db: Session = Depends(get_db),
    current_user: RegisterDb = Depends(autenticat_curr_user),
):
    now = _utc_now()

    active = (
        db.query(TimedSessionDb)
        .filter(
            TimedSessionDb.user_id == current_user.id,
            TimedSessionDb.word_length == body.word_length,
            TimedSessionDb.status == TimedSessionStatus.active,
        )
        .order_by(TimedSessionDb.id.desc())
        .first()
    )
    if active:
        current_word = (
            db.query(GameSessionDb)
            .filter(GameSessionDb.timed_session_id == active.id, GameSessionDb.status == GameStatus.in_progess)
            .first()
        )
        # current_word should always exist alongside an 'active' timed session; if it's
        # missing the row is in an inconsistent state (e.g. cleaned up out-of-band) rather
        # than a genuine resumable run, so treat it the same as an expired session below.
        if active.ends_at > now and current_word:
            return TimedStartResponse(
                timed_session_id=active.id,
                game_session_id=current_word.id,
                word_length=active.word_length,
                words_solved=active.words_solved,
                ends_at=_aware(active.ends_at),
                status=active.status,
            )
        _finalize_timed_session(db, active)

    timed = TimedSessionDb(
        user_id=current_user.id,
        word_length=body.word_length,
        started_at=now,
        ends_at=now + TIMED_DURATION,
        words_solved=0,
        status=TimedSessionStatus.active,
    )
    db.add(timed)
    db.flush()

    word = _pick_random_word(db, body.word_length)
    game_session = GameSessionDb(
        user_id=current_user.id,
        mode=GameMode.time,
        word_length=body.word_length,
        secret_word_id=word.id,
        status=GameStatus.in_progess,
        timed_session_id=timed.id,
    )
    db.add(game_session)
    db.commit()
    db.refresh(timed)
    db.refresh(game_session)

    return TimedStartResponse(
        timed_session_id=timed.id,
        game_session_id=game_session.id,
        word_length=timed.word_length,
        words_solved=timed.words_solved,
        ends_at=_aware(timed.ends_at),
        status=timed.status,
    )


@router.post("/game/timed/{timed_session_id}/guess", response_model=TimedGuessResponse)
def timed_guess(
    timed_session_id: int,
    body: TimedGuessRequest,
    db: Session = Depends(get_db),
    current_user: RegisterDb = Depends(autenticat_curr_user),
):
    timed = db.query(TimedSessionDb).filter(TimedSessionDb.id == timed_session_id).first()
    if not timed or timed.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Timed session not found")

    now = _utc_now()
    if timed.status == TimedSessionStatus.ended or now >= timed.ends_at:
        _finalize_timed_session(db, timed)
        current_word = (
            db.query(GameSessionDb)
            .filter(GameSessionDb.timed_session_id == timed.id, GameSessionDb.status == GameStatus.in_progess)
            .first()
        )
        return TimedGuessResponse(
            time_up=True,
            words_solved=timed.words_solved,
            ends_at=_aware(timed.ends_at),
            secret_word=current_word.secret_word.word if current_word else None,
        )

    session = (
        db.query(GameSessionDb)
        .filter(GameSessionDb.timed_session_id == timed.id, GameSessionDb.status == GameStatus.in_progess)
        .first()
    )
    if not session:
        raise HTTPException(status_code=500, detail="Timed session has no active word")

    guess = body.guess
    if len(guess) != timed.word_length:
        raise HTTPException(status_code=400, detail=f"Guess must be {timed.word_length} letters")

    valid = db.query(WordDb).filter(WordDb.word == guess, WordDb.length == timed.word_length).first()
    if not valid:
        raise HTTPException(status_code=400, detail="Not in word list")

    secret = session.secret_word.word
    result = score_guess(guess, secret)
    guess_number = len(session.guess) + 1
    won = guess == secret

    db.add(GuessesDb(session_id=session.id, guess_word=guess, result=result, guess_number=guess_number))

    if won:
        # Timed mode is "solve this one word before the clock runs out" -- a
        # correct guess ends the run immediately (timer stops, stats finalize)
        # rather than continuing on to a new word.
        session.status = GameStatus.won
        session.ended_at = now
        timed.words_solved = 1
        _finalize_timed_session(db, timed, won=True, guesses_used=guess_number)

    db.commit()

    time_up = timed.status == TimedSessionStatus.ended

    return TimedGuessResponse(
        time_up=time_up,
        words_solved=timed.words_solved,
        ends_at=_aware(timed.ends_at),
        guess_word=guess,
        result=result,
        letter_counts=_letter_counts(guess, secret),
        word_won=won,
        secret_word=secret if (won or time_up) else None,
    )


@router.post("/game/timed/{timed_session_id}/forfeit", response_model=TimedForfeitResponse)
def forfeit_timed(
    timed_session_id: int,
    db: Session = Depends(get_db),
    current_user: RegisterDb = Depends(autenticat_curr_user),
):
    timed = db.query(TimedSessionDb).filter(TimedSessionDb.id == timed_session_id).first()
    if not timed or timed.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Timed session not found")

    current_word = (
        db.query(GameSessionDb)
        .filter(GameSessionDb.timed_session_id == timed.id, GameSessionDb.status == GameStatus.in_progess)
        .first()
    )
    secret_word = current_word.secret_word.word if current_word else None

    _finalize_timed_session(db, timed)

    return TimedForfeitResponse(
        timed_session_id=timed.id,
        words_solved=timed.words_solved,
        secret_word=secret_word,
    )


@router.get("/game/timed/{timed_session_id}/status", response_model=TimedStatusResponse)
def timed_status(
    timed_session_id: int,
    db: Session = Depends(get_db),
    current_user: RegisterDb = Depends(autenticat_curr_user),
):
    timed = db.query(TimedSessionDb).filter(TimedSessionDb.id == timed_session_id).first()
    if not timed or timed.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Timed session not found")

    if timed.status == TimedSessionStatus.active and _utc_now() >= timed.ends_at:
        _finalize_timed_session(db, timed)

    current_word = (
        db.query(GameSessionDb)
        .filter(GameSessionDb.timed_session_id == timed.id, GameSessionDb.status == GameStatus.in_progess)
        .first()
    )

    return TimedStatusResponse(
        timed_session_id=timed.id,
        word_length=timed.word_length,
        words_solved=timed.words_solved,
        ends_at=_aware(timed.ends_at),
        status=timed.status,
        current_game_session_id=current_word.id if current_word else None,
    )


# ---------- stats ----------

def _stats_to_response(stats: UserStats) -> StatsResponse:
    # timed mode is scored through the same _apply_win_loss_stats path as
    # practice now (see _finalize_timed_session), so it reads the same way too
    avg = (stats.total_guesses / stats.game_won) if stats.game_won else 0.0
    win_pct = (stats.game_won / stats.game_played * 100) if stats.game_played else 0.0

    return StatsResponse(
        mode=stats.mode,
        word_length=stats.word_length,
        games_played=stats.game_played,
        games_won=stats.game_won,
        win_percentage=round(win_pct, 1),
        current_streak=stats.current_streak,
        best_streak=stats.best_streak,
        average_guesses=round(avg, 2),
        best_score=stats.best_score,
    )


@router.get("/stats", response_model=list[StatsResponse])
def get_stats(
    db: Session = Depends(get_db),
    current_user: RegisterDb = Depends(autenticat_curr_user),
):
    rows = db.query(UserStats).filter(UserStats.user_id == current_user.id).all()
    return [_stats_to_response(r) for r in rows]


@router.get("/stats/distribution", response_model=DistributionResponse)
def get_distribution(
    mode: GameMode,
    word_length: int,
    db: Session = Depends(get_db),
    current_user: RegisterDb = Depends(autenticat_curr_user),
):
    stats = (
        db.query(UserStats)
        .filter(
            UserStats.user_id == current_user.id,
            UserStats.mode == mode,
            UserStats.word_length == word_length,
        )
        .first()
    )
    distribution = stats.score_distribution if stats and stats.score_distribution else {}
    counts = [distribution.get(str(n), 0) for n in range(1, MAX_TRIES + 1)]

    return DistributionResponse(mode=mode, word_length=word_length, distribution=counts)
