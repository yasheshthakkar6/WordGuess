"use client";

import { formatCountdown } from "../lib/wordle";

export default function TimerBar({ msRemaining, totalMs }) {
  const pct = Math.max(0, Math.min(100, (msRemaining / totalMs) * 100));
  const low = msRemaining < 30_000;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-1.5 px-2 pb-2">
      <div className="flex items-center justify-center text-sm font-semibold">
        <span className={low ? "text-red-600" : "text-zinc-700"}>{formatCountdown(msRemaining)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${low ? "bg-red-500" : "bg-emerald-600"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
