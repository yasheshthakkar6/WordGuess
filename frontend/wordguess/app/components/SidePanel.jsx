"use client";

import { useAuth } from "../context/AuthContext";

export default function SidePanel({ onClose, onChangeMode }) {
  const { user, logout } = useAuth();

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-full w-72 max-w-[85vw] flex-col gap-6 bg-white p-5 shadow-xl animate-[slide-in_0.15s_ease-out]"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-500">Signed in as {user?.first_name}</span>
          <button onClick={onClose} className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <button
          onClick={onChangeMode}
          className="rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Change Game Mode
        </button>

        <div className="flex-1">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">More Games</p>
          <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-400">More games coming soon.</p>
        </div>

        <button
          onClick={logout}
          className="rounded-lg border border-zinc-300 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
