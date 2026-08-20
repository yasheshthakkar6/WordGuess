"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board from "./Board";
import Keyboard from "./Keyboard";
import GameHeader from "./GameHeader";
import SidePanel from "./SidePanel";
import TimerBar from "./TimerBar";
import ResultModal from "./ResultModal";
import StatsModal from "./StatsModal";
import CalendarModal from "./CalendarModal";
import Modal from "./Modal";
import {
  useStartGameMutation,
  useSubmitGuessMutation,
  useForfeitGameMutation,
  useLazyGetSessionQuery,
  useStartTimedMutation,
  useSubmitTimedGuessMutation,
  useForfeitTimedMutation,
  useLazyGetDailyTodayQuery,
  useLazyGetStatsQuery,
} from "../store/apiSlice";
import { buildKeyboardStatus, buildRepeatedLetters, formatCountdown } from "../lib/wordle";
import { useToast } from "../context/ToastContext";

const TIMED_TOTAL_MS = 5 * 60 * 1000;

export default function GameScreen({ mode, wordLength, onChangeLength, onChangeMode, persistPointer, clearPointer }) {
  const { showToast } = useToast();
  const isTimed = mode === "timed";

  const [startGameMutation] = useStartGameMutation();
  const [submitGuessMutation] = useSubmitGuessMutation();
  const [forfeitGameMutation] = useForfeitGameMutation();
  const [triggerGetSession] = useLazyGetSessionQuery();
  const [startTimedMutation] = useStartTimedMutation();
  const [submitTimedGuessMutation] = useSubmitTimedGuessMutation();
  const [forfeitTimedMutation] = useForfeitTimedMutation();
  const [triggerGetDailyToday] = useLazyGetDailyTodayQuery();
  const [triggerGetStats] = useLazyGetStatsQuery();

  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState(null); // daily/practice: the session. timed: current word's session (bookkeeping only)
  const [timedSessionId, setTimedSessionId] = useState(null);
  const [guesses, setGuesses] = useState([]);
  const [status, setStatus] = useState("inprogess");
  const [secretWord, setSecretWord] = useState(null);
  const [currentGuess, setCurrentGuess] = useState("");
  const [shake, setShake] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [streak, setStreak] = useState(null);
  const [forfeited, setForfeited] = useState(false);
  const [giveUpConfirmOpen, setGiveUpConfirmOpen] = useState(false);
  const [givingUp, setGivingUp] = useState(false);

  const [wordsSolved, setWordsSolved] = useState(0);
  const [endsAt, setEndsAt] = useState(null);
  const [msRemaining, setMsRemaining] = useState(TIMED_TOTAL_MS);
  const [timeUp, setTimeUp] = useState(false);
  const [timedWon, setTimedWon] = useState(false); // did the run end because the word was solved, vs time simply running out

  const [nextResetAt, setNextResetAt] = useState(null);
  const [nextResetLabel, setNextResetLabel] = useState("");

  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const gameOver = isTimed ? timeUp : status !== "inprogess";
  const anyModalOpen = sidePanelOpen || statsOpen || calendarOpen || showResult || giveUpConfirmOpen;

  // Synchronous in-flight guard shared by every path that can hit
  // /game/timed/{id}/guess: a real keypress submission (handleSubmit) and the
  // timer-driven forced end-of-run check (finalizeTimedRun) are two independent
  // call sites hitting the same backend session with no server-side locking, so
  // without a shared guard they could race -- e.g. the timer's forced "is time
  // up?" probe and a real in-flight guess landing concurrently, which is how a
  // stray "Not in word list" toast from the probe could show up alongside a
  // correctly-scored real guess. React state (`submitting`) only reflects reality
  // *after* a re-render, so a rapid double-fire can also read a stale
  // `submitting === false` closure and slip a second request through before the
  // first one's setState lands -- a ref updates immediately, closing that window.
  const timedRequestInFlightRef = useRef(false);

  const loadStreak = useCallback(async () => {
    try {
      const rows = await triggerGetStats().unwrap();
      const row = rows.find((r) => r.mode === mode && r.word_length === wordLength);
      if (row) setStreak({ current: row.current_streak, best: row.best_streak });
    } catch {
      // supplementary to the win modal -- a failure here shouldn't block anything
    }
  }, [mode, wordLength, triggerGetStats]);

  // ---- start / resume ----
  // Guards against React 18 Strict Mode's dev-only double-invoke of mount effects.
  // A plain `cancelled` cleanup flag only stops the *stale* run's setState calls --
  // it doesn't stop the actual POST request from firing, so /game/start or
  // /game/timed/start would still create two real sessions server-side. Since this
  // component gets a fresh `key` (and therefore a fresh ref) per mode+length from
  // the parent, `hasStartedRef` reliably lets exactly one of the two invocations
  // actually run, rather than letting both fire and discarding one's results.
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    setLoading(true);
    setGuesses([]);
    setCurrentGuess("");
    setStatus("inprogess");
    setSecretWord(null);
    setShowResult(false);
    setForfeited(false);
    setTimeUp(false);
    setTimedWon(false);
    setWordsSolved(0);

    async function init() {
      try {
        if (isTimed) {
          const res = await startTimedMutation(wordLength).unwrap();
          setTimedSessionId(res.timed_session_id);
          setSessionId(res.game_session_id);
          setWordsSolved(res.words_solved);
          setEndsAt(res.ends_at);
          persistPointer({ mode, wordLength, timedSessionId: res.timed_session_id });

          const sessionState = await triggerGetSession(res.game_session_id).unwrap();
          setGuesses(sessionState.guesses);
        } else {
          const res = await startGameMutation({ mode, wordLength }).unwrap();
          setSessionId(res.session_id);
          persistPointer({ mode, wordLength, sessionId: res.session_id });

          const sessionState = await triggerGetSession(res.session_id).unwrap();
          setGuesses(sessionState.guesses);
          setStatus(sessionState.status);
          if (sessionState.status !== "inprogess") {
            const last = sessionState.guesses[sessionState.guesses.length - 1];
            setSecretWord(last?.secret_word || null);
            setShowResult(true);
            loadStreak();
          }

          if (mode === "daily") {
            const today = await triggerGetDailyToday().unwrap();
            setNextResetAt(today.next_reset_at);
          }
        }
      } catch (err) {
        showToast(err.message || "Couldn't start the game");
      } finally {
        setLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, wordLength]);

  // ---- timed countdown ----
  const finalizeTimedRun = useCallback(async () => {
    // skip if a real guess is already in flight -- that request will surface
    // time_up itself if time has genuinely run out, so there's nothing this
    // forced probe needs to do, and firing it anyway is exactly what could
    // race a legitimate guess and toast a spurious dictionary error alongside it
    if (!timedSessionId || timedRequestInFlightRef.current) return;
    timedRequestInFlightRef.current = true;
    try {
      // any guess payload works here -- the backend checks whether time's up before it
      // even looks at the guess word, so this reliably returns the authoritative
      // end-of-run state, including the secret word for whatever word was in progress
      const res = await submitTimedGuessMutation({ timedSessionId, guess: "a".repeat(wordLength) }).unwrap();
      setTimeUp(true);
      setWordsSolved(res.words_solved);
      setSecretWord(res.secret_word);
      setShowResult(true);
      clearPointer();
    } catch (err) {
      showToast(err.message || "Couldn't finalize the timed run");
    } finally {
      timedRequestInFlightRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedSessionId, wordLength]);

  useEffect(() => {
    if (!isTimed || !endsAt || timeUp) return;
    const tick = () => {
      const remaining = new Date(endsAt).getTime() - Date.now();
      setMsRemaining(Math.max(0, remaining));
      if (remaining <= 0) finalizeTimedRun();
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [isTimed, endsAt, timeUp, finalizeTimedRun]);

  // ---- daily reset countdown label ----
  useEffect(() => {
    if (!nextResetAt) return;
    const tick = () => setNextResetLabel(formatCountdown(new Date(nextResetAt).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextResetAt]);

  // ---- derived ----
  const keyboardStatus = useMemo(() => buildKeyboardStatus(guesses), [guesses]);
  const repeatedLetters = useMemo(() => buildRepeatedLetters(guesses), [guesses]);

  // ---- input ----
  const triggerShake = useCallback(
    (message) => {
      setShake(true);
      if (message) showToast(message);
      setTimeout(() => setShake(false), 400);
    },
    [showToast]
  );

  async function handleSubmit(guessValue) {
    timedRequestInFlightRef.current = true;
    setSubmitting(true);
    try {
      if (isTimed) {
        const res = await submitTimedGuessMutation({ timedSessionId, guess: guessValue }).unwrap();
        setCurrentGuess("");

        // a scored guess always comes back with guess_word set -- the only case it's
        // absent is the "time already ran out before this request was even looked
        // at" short-circuit (e.g. the timer-driven finalize probe), which has no
        // board row to show
        if (res.guess_word) {
          setGuesses((g) => [...g, { guess_word: res.guess_word, result: res.result, letter_counts: res.letter_counts }]);
        }
        setWordsSolved(res.words_solved);
        setEndsAt(res.ends_at);

        if (res.time_up) {
          // covers both outcomes: solving the word (word_won=true) ends the run
          // immediately -- there's no next word to advance to in timed mode -- and
          // genuinely running out of the clock (word_won=false)
          setTimeUp(true);
          setTimedWon(res.word_won);
          setSecretWord(res.secret_word);
          clearPointer();
          setTimeout(() => setShowResult(true), res.guess_word ? 900 : 0); // let a winning flip finish first
          return;
        }
      } else {
        const res = await submitGuessMutation({ sessionId, guess: guessValue }).unwrap();
        setCurrentGuess("");
        setGuesses((g) => [...g, { guess_word: res.guess_word, result: res.result, letter_counts: res.letter_counts }]);

        if (res.status !== "inprogess") {
          setStatus(res.status);
          setSecretWord(res.secret_word);
          clearPointer();
          setTimeout(() => {
            setShowResult(true);
            loadStreak();
          }, 900);
        }
      }
    } catch (err) {
      triggerShake(err.message || "Something went wrong");
    } finally {
      timedRequestInFlightRef.current = false;
      setSubmitting(false);
    }
  }

  const handleKey = useCallback(
    (key) => {
      if (timedRequestInFlightRef.current || submitting || gameOver || loading || anyModalOpen) return;

      if (key === "backspace") {
        setCurrentGuess((g) => g.slice(0, -1));
        return;
      }
      if (key === "enter") {
        if (currentGuess.length !== wordLength) {
          triggerShake("Not enough letters");
          return;
        }
        void handleSubmit(currentGuess);
        return;
      }
      setCurrentGuess((g) => (g.length < wordLength ? g + key : g));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [submitting, gameOver, loading, anyModalOpen, wordLength, currentGuess]
  );

  async function handlePlayAgain() {
    setShowResult(false);
    if (mode === "daily") {
      // daily is one-shot per calendar day -- "play again" just closes back to the finished board
      return;
    }
    setLoading(true);
    setGuesses([]);
    setCurrentGuess("");
    setStatus("inprogess");
    setSecretWord(null);
    setForfeited(false);
    setTimeUp(false);
    setTimedWon(false);
    setWordsSolved(0);
    try {
      if (isTimed) {
        const res = await startTimedMutation(wordLength).unwrap();
        setTimedSessionId(res.timed_session_id);
        setSessionId(res.game_session_id);
        setEndsAt(res.ends_at);
        persistPointer({ mode, wordLength, timedSessionId: res.timed_session_id });
      } else {
        const res = await startGameMutation({ mode, wordLength }).unwrap();
        setSessionId(res.session_id);
        persistPointer({ mode, wordLength, sessionId: res.session_id });
      }
    } catch (err) {
      showToast(err.message || "Couldn't start a new game");
    } finally {
      setLoading(false);
    }
  }

  async function handleGiveUp() {
    setGiveUpConfirmOpen(false);
    setGivingUp(true);
    try {
      if (isTimed) {
        const res = await forfeitTimedMutation(timedSessionId).unwrap();
        setTimeUp(true);
        setWordsSolved(res.words_solved);
        setSecretWord(res.secret_word);
      } else {
        const res = await forfeitGameMutation(sessionId).unwrap();
        setStatus(res.status);
        setSecretWord(res.secret_word);
        loadStreak();
      }
      setForfeited(true);
      setShowResult(true);
      clearPointer();
    } catch (err) {
      showToast(err.message || "Couldn't end the game");
    } finally {
      setGivingUp(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50">
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <GameHeader
        onMenu={() => setSidePanelOpen(true)}
        onStats={() => setStatsOpen(true)}
        onCalendar={() => setCalendarOpen(true)}
        showCalendar={mode === "daily"}
      />

      {mode === "daily" && nextResetAt && (
        <p className="py-1.5 text-center text-xs font-medium text-zinc-500">Next word in {nextResetLabel}</p>
      )}

      {!gameOver && (
        <div className="flex justify-center py-1">
          <button
            onClick={() => setGiveUpConfirmOpen(true)}
            className="text-xs font-medium text-red-500 hover:text-red-700 hover:underline"
          >
            Give Up
          </button>
        </div>
      )}

      {isTimed && <TimerBar msRemaining={msRemaining} totalMs={TIMED_TOTAL_MS} />}

      <div className="flex flex-1 flex-col justify-between gap-4 py-2">
        <Board
          wordLength={wordLength}
          guesses={guesses}
          currentGuess={currentGuess}
          gameOver={gameOver}
          shake={shake}
          repeatedLetters={repeatedLetters}
        />
        <Keyboard
          onKey={handleKey}
          keyStatus={keyboardStatus}
          repeatedLetters={repeatedLetters}
          disabled={submitting || gameOver || anyModalOpen}
        />
      </div>

      {sidePanelOpen && <SidePanel onClose={() => setSidePanelOpen(false)} onChangeMode={onChangeMode} />}
      {statsOpen && <StatsModal onClose={() => setStatsOpen(false)} />}
      {calendarOpen && <CalendarModal defaultLength={wordLength} onClose={() => setCalendarOpen(false)} />}

      {giveUpConfirmOpen && (
        <Modal title="Give up?" onClose={() => setGiveUpConfirmOpen(false)}>
          <div className="flex flex-col gap-4 text-center">
            <p className="text-sm text-zinc-600">
              {isTimed
                ? "This will end your timed run right now. Your progress so far will still be saved."
                : "This will end the game and count as a loss. The secret word will be revealed."}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setGiveUpConfirmOpen(false)}
                className="flex-1 rounded-lg border border-zinc-300 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Keep Playing
              </button>
              <button
                onClick={handleGiveUp}
                disabled={givingUp}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {givingUp ? "Ending..." : "Give Up"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showResult && (
        <ResultModal
          mode={mode}
          wordLength={wordLength}
          status={isTimed ? (timedWon ? "won" : "time_up") : status}
          forfeited={forfeited}
          guesses={guesses}
          secretWord={secretWord}
          streak={isTimed ? null : streak}
          dateLabel={mode === "daily" ? new Date().toLocaleDateString() : null}
          onClose={() => setShowResult(false)}
          onPlayAgain={handlePlayAgain}
          onChangeLength={onChangeLength}
          onChangeMode={onChangeMode}
          onViewStats={() => {
            setShowResult(false);
            setStatsOpen(true);
          }}
        />
      )}
    </div>
  );
}
