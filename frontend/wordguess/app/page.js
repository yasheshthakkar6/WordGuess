"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./context/AuthContext";
import ModePicker from "./components/ModePicker";
import LengthPicker from "./components/LengthPicker";
import GameScreen from "./components/GameScreen";

const POINTER_KEY = "wordguess_active_session";

export default function Home() {
  const { ready, isAuthenticated } = useAuth();
  const router = useRouter();

  const [screen, setScreen] = useState("modes"); // 'modes' | 'length' | 'game'
  const [mode, setMode] = useState(null);
  const [wordLength, setWordLength] = useState(null);
  const [checkingResume, setCheckingResume] = useState(true);

  useEffect(() => {
    if (ready && !isAuthenticated) router.replace("/login");
  }, [ready, isAuthenticated, router]);

  // resume an in-progress session on load/refresh, if one was left pointing somewhere
  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    try {
      const raw = window.localStorage.getItem(POINTER_KEY);
      if (raw) {
        const pointer = JSON.parse(raw);
        if (pointer?.mode && pointer?.wordLength) {
          setMode(pointer.mode);
          setWordLength(pointer.wordLength);
          setScreen("game");
        }
      }
    } catch {
      // corrupt pointer -- just fall back to the mode picker
    } finally {
      setCheckingResume(false);
    }
  }, [ready, isAuthenticated]);

  const persistPointer = useCallback((pointer) => {
    window.localStorage.setItem(POINTER_KEY, JSON.stringify(pointer));
  }, []);

  const clearPointer = useCallback(() => {
    window.localStorage.removeItem(POINTER_KEY);
  }, []);

  function handleSelectMode(selectedMode) {
    setMode(selectedMode);
    if (selectedMode === "daily") {
      setWordLength(5); // default length for word-of-the-day; user can still switch below via the header/calendar flow
      setScreen("game");
    } else {
      setScreen("length");
    }
  }

  function handleSelectLength(len) {
    setWordLength(len);
    setScreen("game");
  }

  function handleChangeMode() {
    clearPointer();
    setMode(null);
    setWordLength(null);
    setScreen("modes");
  }

  function handleChangeLength() {
    clearPointer();
    setWordLength(null);
    setScreen(mode === "daily" ? "modes" : "length");
  }

  if (!ready || !isAuthenticated || checkingResume) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50">
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (screen === "modes") {
    return <ModePicker onSelect={handleSelectMode} />;
  }

  if (screen === "length") {
    return <LengthPicker mode={mode} onSelect={handleSelectLength} onBack={handleChangeMode} />;
  }

  return (
    <GameScreen
      key={`${mode}-${wordLength}`}
      mode={mode}
      wordLength={wordLength}
      onChangeMode={handleChangeMode}
      onChangeLength={handleChangeLength}
      persistPointer={persistPointer}
      clearPointer={clearPointer}
    />
  );
}
