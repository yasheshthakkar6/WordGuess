"use client";

export default function GameHeader({ onMenu, onStats, onCalendar, showCalendar }) {
  return (
    <header className="flex w-full items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
      <button onClick={onMenu} aria-label="Menu" className="rounded-full p-2 text-zinc-600 hover:bg-zinc-100">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M3 6H21M3 12H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <h1 className="text-lg font-extrabold tracking-tight text-zinc-900">Word Guesser</h1>

      <div className="flex items-center gap-1">
        {showCalendar && (
          <button onClick={onCalendar} aria-label="Calendar" className="rounded-full p-2 text-zinc-600 hover:bg-zinc-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M3 9H21M8 3V6M16 3V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <button onClick={onStats} aria-label="Statistics" className="rounded-full p-2 text-zinc-600 hover:bg-zinc-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M4 20V10M12 20V4M20 20V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </header>
  );
}
