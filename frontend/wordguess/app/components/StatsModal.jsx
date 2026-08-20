"use client";

import { useMemo, useState } from "react";
import Modal from "./Modal";
import { WORD_LENGTHS } from "../lib/constants";
import { useGetStatsQuery, useGetDistributionQuery } from "../store/apiSlice";

const TABS = [
  { key: "daily", label: "Word of the Day" },
  { key: "practice", label: "Practice" },
  { key: "timed", label: "Timed" },
];

const EMPTY_ROW = {
  games_played: 0,
  games_won: 0,
  win_percentage: 0,
  current_streak: 0,
  best_streak: 0,
  average_guesses: 0,
  best_score: 0,
};

export default function StatsModal({ onClose }) {
  const [tab, setTab] = useState("daily");
  const [length, setLength] = useState(5);

  const { data: rows, isLoading } = useGetStatsQuery();
  const { data: distributionData } = useGetDistributionQuery({ mode: tab, wordLength: length });

  const rowFor = useMemo(() => {
    return (mode, len) => rows?.find((r) => r.mode === mode && r.word_length === len) || EMPTY_ROW;
  }, [rows]);

  // Timed mode is "solve this word before time runs out" -- a real win/loss
  // outcome, scored the same way practice is -- so it rolls into the same
  // overall totals as every other mode instead of being carved out separately.
  const overview = useMemo(() => {
    if (!rows) return null;
    const gamesPlayed = rows.reduce((sum, r) => sum + r.games_played, 0);
    const gamesWon = rows.reduce((sum, r) => sum + r.games_won, 0);
    const bestStreak = rows.reduce((max, r) => Math.max(max, r.best_streak), 0);

    return {
      gamesPlayed,
      gamesWon,
      gamesLost: gamesPlayed - gamesWon,
      winPct: gamesPlayed ? Math.round((gamesWon / gamesPlayed) * 100) : 0,
      bestStreak,
    };
  }, [rows]);

  return (
    <Modal title="Statistics" onClose={onClose} wide>
      {overview && (
        <div className="mb-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
          <Stat label="Games Played" value={overview.gamesPlayed} />
          <Stat label="Wins" value={overview.gamesWon} />
          <Stat label="Losses" value={overview.gamesLost} />
          <Stat label="Win %" value={`${overview.winPct}%`} />
          <Stat label="Best Streak" value={overview.bestStreak} />
        </div>
      )}

      <div className="mb-4 flex gap-1 rounded-lg bg-zinc-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
              tab === t.key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-zinc-500">Loading...</p>
      ) : (
        <PerLengthStats
          tab={tab}
          length={length}
          setLength={setLength}
          rowFor={rowFor}
          distribution={distributionData?.distribution}
        />
      )}
    </Modal>
  );
}

function PerLengthStats({ tab, length, setLength, rowFor, distribution }) {
  const stats = rowFor(tab, length);
  const maxCount = Math.max(1, ...(distribution || [0]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center gap-2">
        {WORD_LENGTHS.map((len) => (
          <button
            key={len}
            onClick={() => setLength(len)}
            className={`h-9 w-9 rounded-full text-sm font-bold transition-colors ${
              length === len ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {len}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-4">
        <Stat label="Played" value={stats.games_played} />
        <Stat label="Won" value={stats.games_won} />
        <Stat label="Win %" value={`${stats.win_percentage}%`} />
        <Stat label="Avg Guesses" value={stats.average_guesses} />
        <Stat label="Current Streak" value={stats.current_streak} />
        <Stat label="Best Streak" value={stats.best_streak} />
      </div>

      {tab === "daily" && distribution && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Guess Distribution</p>
          <div className="flex items-end gap-2">
            {distribution.map((count, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-24 w-full items-end">
                  <div
                    className="w-full rounded-t bg-emerald-600"
                    style={{ height: `${Math.max(4, (count / maxCount) * 100)}%` }}
                    title={`${count} win${count === 1 ? "" : "s"}`}
                  />
                </div>
                <span className="text-xs text-zinc-500">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-2">
      <div className="text-lg font-bold text-zinc-900">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
    </div>
  );
}
