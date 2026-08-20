"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { TOKEN_STORAGE_KEY } from "../lib/constants";
import { useLoginMutation, useRegisterMutation } from "../store/apiSlice";

const USER_STORAGE_KEY = "wordguess_user";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { username, first_name }
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);

  const [loginMutation] = useLoginMutation();
  const [registerMutation] = useRegisterMutation();

  useEffect(() => {
    const storedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    const storedUser = window.localStorage.getItem(USER_STORAGE_KEY);
    if (storedToken) setToken(storedToken);
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        // ignore corrupt value
      }
    }
    setReady(true);
  }, []);

  function persistSession(nextToken, nextUser) {
    setToken(nextToken);
    setUser(nextUser);
    window.localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
  }

  async function login(username, password) {
    const data = await loginMutation({ username, password }).unwrap();
    const nextUser = { username: data.username, first_name: data.first_name };
    persistSession(data.access_token, nextUser);
    return nextUser;
  }

  async function register(values) {
    const data = await registerMutation(values).unwrap();
    // registration doesn't return a token, so log the user in right after
    await login(values.username, values.password);
    return data;
  }

  function logout() {
    setToken(null);
    setUser(null);
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(USER_STORAGE_KEY);
  }

  const value = {
    user,
    token,
    ready,
    isAuthenticated: Boolean(token),
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
