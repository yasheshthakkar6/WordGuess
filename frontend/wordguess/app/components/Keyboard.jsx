"use client";

import { useEffect, useRef } from "react";

const ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["enter", "z", "x", "c", "v", "b", "n", "m", "backspace"],
];

const STATUS_CLASSES = {
  correct: "bg-emerald-600 text-white",
  present: "bg-amber-500 text-white",
  absent: "bg-zinc-400 text-white",
};

export default function Keyboard({ onKey, keyStatus, repeatedLetters, disabled }) {
  // Read the latest onKey/disabled through a ref rather than the effect's dependency
  // array. onKey is recreated by the parent fairly often (e.g. it closes over
  // currentGuess), and re-subscribing addEventListener/removeEventListener on every
  // one of those changes is unnecessary churn -- this keeps exactly one listener
  // registered for the component's whole lifetime, no matter how often props change.
  const latest = useRef({ onKey, disabled });
  latest.current = { onKey, disabled };

  useEffect(() => {
    function handleKeyDown(e) {
      const { onKey: currentOnKey, disabled: currentDisabled } = latest.current;
      if (currentDisabled) return;
      // don't hijack typing when the user is focused in a text input (e.g. a modal form)
      if (e.target && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;

      if (e.key === "Enter") currentOnKey("enter");
      else if (e.key === "Backspace") currentOnKey("backspace");
      else if (/^[a-zA-Z]$/.test(e.key)) currentOnKey(e.key.toLowerCase());
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-1.5 px-1 pb-4">
      {ROWS.map((row, i) => (
        <div key={i} className="flex justify-center gap-1.5">
          {row.map((key) => {
            const isSpecial = key === "enter" || key === "backspace";
            const status = keyStatus?.[key];
            const badge = !isSpecial && repeatedLetters?.has(key);

            return (
              <button
                key={key}
                disabled={disabled}
                onClick={() => onKey(key)}
                className={`relative flex h-12 items-center justify-center rounded-md text-xs font-bold uppercase transition-colors disabled:opacity-50 ${
                  isSpecial ? "flex-[1.6] text-[10px]" : "flex-1"
                } ${status ? STATUS_CLASSES[status] : "bg-zinc-200 text-zinc-900 hover:bg-zinc-300"}`}
              >
                {key === "backspace" ? "⌫" : key === "enter" ? "Enter" : key}
                {badge && (
                  <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-[8px] font-bold text-zinc-700 ring-1 ring-zinc-300">
                    2+
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
