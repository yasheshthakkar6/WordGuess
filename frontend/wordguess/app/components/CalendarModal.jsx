"use client";

import { useState } from "react";
import Modal from "./Modal";
import { WORD_LENGTHS } from "../lib/constants";
import { useGetCalendarQuery } from "../store/apiSlice";

const STATUS_STYLES = {
  won: "bg-emerald-600 text-white",
  lost: "bg-zinc-500 text-white",
  in_progress: "bg-amber-400 text-white",
  not_played: "bg-zinc-100 text-zinc-400",
};

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function CalendarModal({ defaultLength = 5, onClose }) {
  const [cursor, setCursor] = useState(() => new Date());
  const [length, setLength] = useState(defaultLength);

  const { data, isLoading } = useGetCalendarQuery(monthKey(cursor));
  const days = data?.days || [];

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const statusByDay = {};
  for (const d of days) {
    if (d.word_length !== length) continue;
    statusByDay[Number(d.date.slice(-2))] = d.status;
  }

  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <Modal title="Word of the Day Calendar" onClose={onClose} wide>
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="rounded p-1 text-zinc-500 hover:bg-zinc-100">
          &larr;
        </button>
        <span className="text-sm font-semibold text-zinc-800">
          {cursor.toLocaleString("default", { month: "long", year: "numeric" })}
        </span>
        <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="rounded p-1 text-zinc-500 hover:bg-zinc-100">
          &rarr;
        </button>
      </div>

      <div className="mb-3 flex justify-center gap-2">
        {WORD_LENGTHS.map((len) => (
          <button
            key={len}
            onClick={() => setLength(len)}
            className={`h-8 w-8 rounded-full text-xs font-bold transition-colors ${
              length === len ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {len}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-zinc-500">Loading...</p>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-zinc-400">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((day, i) =>
              day === null ? (
                <div key={i} />
              ) : (
                <div
                  key={i}
                  className={`flex aspect-square items-center justify-center rounded-md text-xs font-semibold ${
                    STATUS_STYLES[statusByDay[day] || "not_played"]
                  }`}
                >
                  {day}
                </div>
              )
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-zinc-500">
            <Legend color="bg-emerald-600" label="Won" />
            <Legend color="bg-zinc-500" label="Lost" />
            <Legend color="bg-amber-400" label="In progress" />
            <Legend color="bg-zinc-100" label="Not played" />
          </div>
        </>
      )}
    </Modal>
  );
}

function Legend({ color, label }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-3 w-3 rounded-sm ${color}`} />
      {label}
    </span>
  );
}
