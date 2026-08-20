"use client";

import Tile from "./Tile";

export default function Board({ wordLength, guesses, currentGuess, gameOver, shake, repeatedLetters, minRows = 6 }) {
  const activeRowIndex = gameOver ? -1 : guesses.length;
  const rowCount = Math.max(minRows, guesses.length + (gameOver ? 0 : 1));
  const rows = Array.from({ length: rowCount }, (_, i) => i);

  return (
    <div className="mx-auto flex max-h-[min(60vh,28rem)] w-full max-w-sm flex-col gap-1.5 overflow-y-auto px-2 py-2">
      {rows.map((rowIndex) => {
        const guess = guesses[rowIndex];
        const isActive = rowIndex === activeRowIndex;
        const letters = guess
          ? guess.guess_word.split("")
          : isActive
            ? currentGuess.padEnd(wordLength, " ").split("")
            : new Array(wordLength).fill("");

        return (
          <div
            key={rowIndex}
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${wordLength}, minmax(0, 1fr))`, aspectRatio: `${wordLength} / 1` }}
          >
            {letters.map((ch, i) => {
              const display = ch === " " ? "" : ch;
              const status = guess?.result?.[i];
              const showBadge = Boolean(guess) && status !== "absent" && display && repeatedLetters?.has(display);

              return (
                <Tile
                  key={i}
                  letter={display}
                  status={status}
                  revealed={Boolean(guess)}
                  delayMs={i * 250}
                  showBadge={showBadge}
                  shake={isActive && shake}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
