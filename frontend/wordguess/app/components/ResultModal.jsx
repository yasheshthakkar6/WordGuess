"use client";

import { useState } from "react";
import Modal from "./Modal";
import { buildShareText, copyToClipboard } from "../lib/wordle";
import { MODES } from "../lib/constants";
import { useToast } from "../context/ToastContext";

export default function ResultModal({
  mode,
  wordLength,
  status, // 'won' | 'lost' | 'time_up'
  forfeited = false, // true if the player gave up rather than losing/timing out normally
  guesses,
  secretWord,
  streak, // { current, best } | null -- daily/practice only
  dateLabel,
  onClose,
  onPlayAgain,
  onChangeLength,
  onChangeMode,
  onViewStats,
}) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  const isTimed = mode === "timed";
  const won = status === "won";

  const headline = forfeited
    ? isTimed
      ? "You ended the run early."
      : "You gave up."
    : won
      ? isTimed
        ? "Nice job! You solved it before time ran out!"
        : "Nice job! You guessed the secret word!"
      : isTimed
        ? "Time's up!"
        : "Sorry, you are out of guesses.";

  // giving up leads back to mode/length selection rather than leaving the player
  // parked on a dead board -- both the explicit close and the X/backdrop do the same thing
  const handleClose = forfeited ? onChangeMode : onClose;

  async function handleShare() {
    const text = buildShareText({ modeLabel: MODES[mode].label, mode, wordLength, status, guesses, dateLabel });
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      showToast("Copied to clipboard!", "success");
      setTimeout(() => setCopied(false), 2000);
    } else {
      showToast("Couldn't copy -- your browser blocked clipboard access.");
    }
  }

  return (
    <Modal
      title={forfeited ? "Game Ended" : won ? "You Won!" : isTimed ? "Time's Up" : "Game Over"}
      onClose={handleClose}
    >
      <div className="flex flex-col gap-4 text-center">
        <p className="text-base font-medium text-zinc-800">{headline}</p>

        {won ? (
          <p className="text-sm text-zinc-600">
            Solved in <span className="font-bold">{guesses.length}</span> {guesses.length === 1 ? "guess" : "guesses"}
          </p>
        ) : (
          // forfeiting always resolves to a non-won status, so this also covers that case
          <p className="text-sm text-zinc-600">
            The word was: <span className="font-bold uppercase">{secretWord}</span>
            <br />
            Attempts used: <span className="font-bold">{guesses.length}</span>
          </p>
        )}

        {!isTimed && streak && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-zinc-50 p-3">
              <div className="text-2xl font-bold text-zinc-900">{streak.current}</div>
              <div className="text-xs uppercase tracking-wide text-zinc-500">Current Streak</div>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3">
              <div className="text-2xl font-bold text-zinc-900">{streak.best}</div>
              <div className="text-xs uppercase tracking-wide text-zinc-500">Best Streak</div>
            </div>
          </div>
        )}

        {!forfeited && (
          <button
            onClick={handleShare}
            className="rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            {copied ? "Copied!" : "Share My Score"}
          </button>
        )}

        <div className="mt-2 flex flex-col gap-2">
          {forfeited ? (
            <button
              onClick={onChangeMode}
              className="rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Back to Home
            </button>
          ) : (
            <>
              {mode !== "daily" && (
                <button
                  onClick={onPlayAgain}
                  className="rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Play Again
                </button>
              )}
              <div className="flex gap-2">
                {mode !== "daily" && (
                  <button
                    onClick={onChangeLength}
                    className="flex-1 rounded-lg border border-zinc-300 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Change Word Length
                  </button>
                )}
                <button
                  onClick={onChangeMode}
                  className="flex-1 rounded-lg border border-zinc-300 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Home
                </button>
              </div>
              <button onClick={onViewStats} className="text-xs font-medium text-zinc-500 hover:text-zinc-800 hover:underline">
                View My Stats
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
