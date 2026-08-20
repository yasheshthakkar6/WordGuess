"use client";

export default function Modal({ title, onClose, children, wide = false }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4 py-8"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`max-h-full w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-xl ${wide ? "max-w-lg" : "max-w-sm"}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
