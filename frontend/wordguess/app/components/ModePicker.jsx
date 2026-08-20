"use client";

import { useState } from "react";
import { MODES } from "../lib/constants";
import { useAuth } from "../context/AuthContext";
import StatsModal from "./StatsModal";

const ICONS = {
  daily: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 9H21M8 3V6M16 3V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  practice: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path d="M4 12C4 7.58 7.58 4 12 4C15.14 4 17.86 5.83 19.15 8.5M20 12C20 16.42 16.42 20 12 20C8.86 20 6.14 18.17 4.85 15.5"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M19 4V8.5H14.5M5 20V15.5H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  timed: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 9V13L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 2H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

export default function ModePicker({ onSelect }) {
  const { user, logout } = useAuth();
  const [statsOpen, setStatsOpen] = useState(false);

  return (
    <div className="flex flex-1 flex-col items-center gap-6 bg-zinc-50 px-4 py-10">
      <div className="flex w-full max-w-md items-center justify-between">
        <span className="text-sm text-zinc-500">Hi, {user?.first_name}</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStatsOpen(true)}
            className="flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M4 20V10M12 20V4M20 20V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            My Stats
          </button>
          <button onClick={logout} className="text-sm font-medium text-zinc-500 hover:text-zinc-800">
            Log out
          </button>
        </div>
      </div>
      <h1 className="text-2xl font-bold text-zinc-900">Choose a mode</h1>
      <div className="grid w-full max-w-md gap-4">
        {Object.values(MODES).map((mode) => (
          <button
            key={mode.key}
            onClick={() => onSelect(mode.key)}
            className="flex items-start gap-4 rounded-2xl bg-white p-5 text-left shadow-sm ring-1 ring-zinc-200 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="mt-0.5 shrink-0 text-emerald-600">{ICONS[mode.key]}</span>
            <span>
              <span className="block text-base font-semibold text-zinc-900">{mode.label}</span>
              <span className="mt-1 block text-sm text-zinc-500">{mode.blurb}</span>
            </span>
          </button>
        ))}
      </div>

      {statsOpen && <StatsModal onClose={() => setStatsOpen(false)} />}
    </div>
  );
}
