"use client";

const STATUS_CLASSES = {
  correct: "bg-emerald-600 border-emerald-600 text-white",
  present: "bg-amber-500 border-amber-500 text-white",
  absent: "bg-zinc-500 border-zinc-500 text-white",
};

export default function Tile({ letter, status, revealed, delayMs = 0, showBadge = false, shake = false }) {
  const filled = Boolean(letter);
  const colorClass = revealed && status ? STATUS_CLASSES[status] : "border-zinc-300 bg-white text-zinc-900";

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center rounded-md border-2 text-2xl font-bold uppercase select-none ${colorClass} ${
        filled && !revealed ? "border-zinc-500 animate-[pop_0.1s_ease-out]" : ""
      } ${shake ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
      style={revealed ? { animation: `flip 0.5s ease ${delayMs}ms both` } : undefined}
    >
      {letter}
      {showBadge && (
        <span
          title="This letter appears more than once"
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-bold text-zinc-700 ring-1 ring-zinc-300"
        >
          2+
        </span>
      )}
    </div>
  );
}
