"use client";

import { WORD_LENGTHS, MODES } from "../lib/constants";

export default function LengthPicker({ mode, onSelect, onBack }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-6 bg-zinc-50 px-4 py-10">
      <button onClick={onBack} className="self-start text-sm font-medium text-zinc-500 hover:text-zinc-800">
        &larr; Back to modes
      </button>
      <h1 className="text-2xl font-bold text-zinc-900">{MODES[mode].label}</h1>
      <p className="-mt-4 text-sm text-zinc-500">Choose a word length</p>
      <div className="flex gap-4">
        {WORD_LENGTHS.map((len) => (
          <button
            key={len}
            onClick={() => onSelect(len)}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 transition-all hover:-translate-y-0.5 hover:bg-emerald-600 hover:text-white hover:shadow-md"
          >
            <span className="text-3xl font-bold">{len}</span>
            <span className="text-xs font-medium uppercase tracking-wide opacity-70">letters</span>
          </button>
        ))}
      </div>
    </div>
  );
}
