"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext(null);
const MAX_VISIBLE_TOASTS = 3;
const AUTO_DISMISS_MS = 2000;

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});
  const activeKeys = useRef(new Map()); // "type:message" -> id, so a repeat refreshes the existing toast instead of stacking a new one

  const removeToast = useCallback((id) => {
    setToasts((prev) => {
      const toast = prev.find((t) => t.id === id);
      if (toast && activeKeys.current.get(toast.key) === id) {
        activeKeys.current.delete(toast.key);
      }
      return prev.filter((t) => t.id !== id);
    });
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const showToast = useCallback(
    (message, type = "error") => {
      const key = `${type}:${message}`;
      const existingId = activeKeys.current.get(key);

      // already showing this exact message -- just restart its auto-dismiss timer
      // instead of piling on a duplicate, however many times this gets called
      if (existingId != null) {
        clearTimeout(timers.current[existingId]);
        timers.current[existingId] = setTimeout(() => removeToast(existingId), AUTO_DISMISS_MS);
        return existingId;
      }

      const id = nextId++;
      activeKeys.current.set(key, id);

      setToasts((prev) => {
        const next = [...prev, { id, message, type, key }];
        return next.length > MAX_VISIBLE_TOASTS ? next.slice(next.length - MAX_VISIBLE_TOASTS) : next;
      });

      timers.current[id] = setTimeout(() => removeToast(id), AUTO_DISMISS_MS);
      return id;
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            onClick={() => removeToast(t.id)}
            className={`cursor-pointer rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg animate-[toast-in_0.15s_ease-out] ${
              t.type === "error" ? "bg-red-600" : t.type === "success" ? "bg-emerald-600" : "bg-zinc-800"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
