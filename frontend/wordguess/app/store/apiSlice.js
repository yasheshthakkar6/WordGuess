"use client";

import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { TOKEN_STORAGE_KEY } from "../lib/constants";

// Every endpoint below (e.g. "/login", `/game/guess/${sessionId}`) is just a relative
// path appended to this -- same idea as axios's `axios.create({ baseURL })`, just RTK
// Query's version of it. Change this one line and every request in the app follows.
const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: baseURL,
  prepareHeaders: (headers) => {
    const token = typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_STORAGE_KEY) : null;
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  },
});

// FastAPI error bodies come in a couple of shapes:
//  - HTTPException -> { detail: "some message" }
//  - pydantic 422 validation -> { detail: [{ loc, msg, type }, ...] }
// Normalize both into a plain `message` string on the RTK Query error object so
// components can just read `error.message` instead of poking at `error.data.detail`.
function extractErrorMessage(body, status) {
  if (!body) return `Request failed (${status})`;
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail)) return body.detail.map((e) => e.msg).join(", ");
  if (typeof body.message === "string") return body.message;
  return `Request failed (${status})`;
}

const baseQueryWithErrorNormalization = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error) {
    result.error.message = extractErrorMessage(result.error.data, result.error.status);
    return result;
  }

  // defensive: /register and /login can still return HTTP 200 with an error-shaped
  // body if an unexpected (non-HTTPException) exception is swallowed by their
  // generic except block -- treat that the same as a real error.
  if (result.data && typeof result.data.message === "string" && result.data.message.toLowerCase().startsWith("error")) {
    return { error: { status: 200, data: result.data, message: result.data.message } };
  }

  return result;
};

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithErrorNormalization,
  tagTypes: ["Stats", "DailyToday", "Calendar"],
  endpoints: (builder) => ({
    // ---- auth ----
    login: builder.mutation({
      query: ({ username, password }) => ({ url: "/login", method: "POST", body: { username, password } }),
    }),
    register: builder.mutation({
      query: (values) => ({ url: "/register", method: "POST", body: values }),
    }),

    // ---- core game ----
    startGame: builder.mutation({
      query: ({ mode, wordLength }) => ({ url: "/game/start", method: "POST", body: { mode, word_length: wordLength } }),
      invalidatesTags: ["DailyToday"],
    }),
    getSession: builder.query({
      query: (sessionId) => `/game/session/${sessionId}`,
    }),
    submitGuess: builder.mutation({
      query: ({ sessionId, guess }) => ({ url: `/game/guess/${sessionId}`, method: "POST", body: { guess } }),
      invalidatesTags: ["Stats", "DailyToday", "Calendar"],
    }),
    forfeitGame: builder.mutation({
      query: (sessionId) => ({ url: `/game/forfeit/${sessionId}`, method: "POST" }),
      invalidatesTags: ["Stats", "DailyToday", "Calendar"],
    }),

    // ---- daily / calendar ----
    getDailyToday: builder.query({
      query: () => "/game/daily/today",
      providesTags: ["DailyToday"],
    }),
    getCalendar: builder.query({
      query: (month) => `/game/calendar?month=${encodeURIComponent(month)}`,
      providesTags: ["Calendar"],
    }),

    // ---- timed mode ----
    startTimed: builder.mutation({
      query: (wordLength) => ({ url: "/game/timed/start", method: "POST", body: { word_length: wordLength } }),
    }),
    submitTimedGuess: builder.mutation({
      query: ({ timedSessionId, guess }) => ({ url: `/game/timed/${timedSessionId}/guess`, method: "POST", body: { guess } }),
      invalidatesTags: ["Stats"],
    }),
    forfeitTimed: builder.mutation({
      query: (timedSessionId) => ({ url: `/game/timed/${timedSessionId}/forfeit`, method: "POST" }),
      invalidatesTags: ["Stats"],
    }),
    getTimedStatus: builder.query({
      query: (timedSessionId) => `/game/timed/${timedSessionId}/status`,
    }),

    // ---- stats ----
    getStats: builder.query({
      query: () => "/stats",
      providesTags: ["Stats"],
    }),
    getDistribution: builder.query({
      query: ({ mode, wordLength }) => `/stats/distribution?mode=${mode}&word_length=${wordLength}`,
      providesTags: ["Stats"],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useStartGameMutation,
  useLazyGetSessionQuery,
  useSubmitGuessMutation,
  useForfeitGameMutation,
  useGetDailyTodayQuery,
  useLazyGetDailyTodayQuery,
  useGetCalendarQuery,
  useStartTimedMutation,
  useSubmitTimedGuessMutation,
  useForfeitTimedMutation,
  useLazyGetTimedStatusQuery,
  useGetStatsQuery,
  useLazyGetStatsQuery,
  useGetDistributionQuery,
} = api;
