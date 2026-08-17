"use client";

import { regissionDashboardFetch } from "@/lib/regission-dashboard-fetch";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageShell from "@/components/page-shell";
import ProtectedRoute from "@/components/auth/protected-route";
import { getStoredToken } from "@/lib/auth";

type Move = {
  id: number;
  notation: string;
};

type Game = {
  id: number;
  name: string;
  status: "ongoing" | "completed";
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  moves?: Move[];
};

type FilterStatus = "all" | "ongoing" | "completed";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "/api/proxy/api";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Ã¢â‚¬â€";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function apiRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = getStoredToken("user");

  if (!token) {
    throw new Error("Your user session has expired.");
  }

  const response = await regissionDashboardFetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof (payload as { message?: unknown }).message === "string"
        ? (payload as { message: string }).message
        : `Request failed with status ${response.status}.`;

    throw new Error(message);
  }

  return payload as T;
}

function Calendar({
  month,
  selectedDate,
  completedDates,
  onMonthChange,
  onSelectDate,
}: {
  month: Date;
  selectedDate: string;
  completedDates: Set<string>;
  onMonthChange: (next: Date) => void;
  onSelectDate: (date: string) => void;
}) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const previousMonthDays = new Date(year, monthIndex, 0).getDate();

  const cells = Array.from({ length: 42 }, (_, index) => {
    const dayOffset = index - firstWeekday + 1;

    if (dayOffset <= 0) {
      const day = previousMonthDays + dayOffset;
      return {
        day,
        muted: true,
        date: new Date(year, monthIndex - 1, day),
      };
    }

    if (dayOffset > daysInMonth) {
      const day = dayOffset - daysInMonth;
      return {
        day,
        muted: true,
        date: new Date(year, monthIndex + 1, day),
      };
    }

    return {
      day: dayOffset,
      muted: false,
      date: new Date(year, monthIndex, dayOffset),
    };
  });

  return (
    <section className="self-start rounded-3xl border border-white/10 bg-[#0d1829]/85 p-4 lg:sticky lg:top-24">
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#15213a] px-4 py-4">
        <button
          type="button"
          onClick={() =>
            onMonthChange(new Date(year, monthIndex - 1, 1))
          }
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white/70 transition hover:bg-white/10"
        >
          Prev
        </button>

        <div className="text-center">
          <p className="text-lg font-black text-white">{year}</p>
          <p className="text-sm font-bold uppercase tracking-wider text-orange-300">
            {MONTHS[monthIndex]}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            onMonthChange(new Date(year, monthIndex + 1, 1))
          }
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white/70 transition hover:bg-white/10"
        >
          Next
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 text-center">
        {WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            className="py-2 text-[11px] font-bold uppercase text-white/35"
          >
            {weekday}
          </div>
        ))}

        {cells.map((cell, index) => {
          const dateKey = toDateKey(cell.date.toISOString());
          const selected = selectedDate === dateKey;
          const hasCompletedGame = completedDates.has(dateKey);

          return (
            <button
              key={`${dateKey}-${index}`}
              type="button"
              onClick={() => {
                onSelectDate(selected ? "" : dateKey);
              }}
              className={
                selected
                  ? "relative aspect-square rounded-xl bg-orange-500 text-sm font-black text-black"
                  : cell.muted
                    ? "relative aspect-square rounded-xl text-sm font-semibold text-white/20 hover:bg-white/5"
                    : "relative aspect-square rounded-xl text-sm font-semibold text-white/80 hover:bg-white/5"
              }
            >
              {cell.day}

              {hasCompletedGame && (
                <span
                  className={
                    selected
                      ? "absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-black"
                      : "absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-emerald-400"
                  }
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => {
            const now = new Date();
            onMonthChange(new Date(now.getFullYear(), now.getMonth(), 1));
            onSelectDate(toDateKey(now.toISOString()));
          }}
          className="flex-1 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-black"
        >
          Today
        </button>

        <button
          type="button"
          onClick={() => onSelectDate("")}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white/70"
        >
          Clear
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-white/35">
        Green dots indicate completed games.
      </p>
    </section>
  );
}

function GamesContent() {
  const now = new Date();

  const [games, setGames] = useState<Game[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FilterStatus>("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1)
  );
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const loadGames = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await apiRequest<Game[]>("/games");
      setGames(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load games."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGames();
  }, [loadGames]);

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const completedDates = useMemo(() => {
    return new Set(
      games
        .filter((game) => game.status === "completed")
        .map((game) => toDateKey(game.completed_at))
        .filter(Boolean)
    );
  }, [games]);

  const filteredGames = useMemo(() => {
    const query = search.trim().toLowerCase();

    return games
      .filter((game) => {
        const matchesSearch =
          !query || game.name.toLowerCase().includes(query);

        const matchesStatus =
          status === "all" || game.status === status;

        const matchesDate =
          !selectedDate ||
          (game.status === "completed" &&
            toDateKey(game.completed_at) === selectedDate);

        return matchesSearch && matchesStatus && matchesDate;
      })
      .sort((firstGame, secondGame) => {
        // Always display ongoing games before completed games.
        if (firstGame.status !== secondGame.status) {
          return firstGame.status === "ongoing" ? -1 : 1;
        }

        // Sort alphabetically inside each status group.
        const nameComparison = firstGame.name.localeCompare(
          secondGame.name,
          "en",
          {
            sensitivity: "base",
            numeric: true,
          }
        );

        // Use the game ID as a stable fallback for duplicate names.
        return nameComparison !== 0
          ? nameComparison
          : firstGame.id - secondGame.id;
      });
  }, [games, search, selectedDate, status]);

  const ongoingCount = games.filter(
    (game) => game.status === "ongoing"
  ).length;

  const completedCount = games.filter(
    (game) => game.status === "completed"
  ).length;

  async function completeGame(game: Game) {
    if (
      !window.confirm(
        `Complete "${game.name}"?\n\nIt will become available for Stockfish analysis.`
      )
    ) {
      return;
    }

    setWorkingId(game.id);
    setError("");

    try {
      await apiRequest(`/games/${game.id}/complete`, {
        method: "POST",
      });

      setToast("Game completed successfully.");
      await loadGames();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to complete the game."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function deleteGame(game: Game) {
    if (
      !window.confirm(
        `Delete "${game.name}" and all recorded moves?\n\nThis cannot be undone.`
      )
    ) {
      return;
    }

    setWorkingId(game.id);
    setError("");

    try {
      await apiRequest(`/games/${game.id}`, {
        method: "DELETE",
      });

      setToast("Game deleted successfully.");
      await loadGames();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete the game."
      );
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <PageShell>
      {toast && (
        <div className="fixed right-5 top-24 z-[100] rounded-2xl border border-emerald-400/20 bg-[#10271f] px-5 py-4 text-sm font-bold text-emerald-200 shadow-2xl">
          {toast}
        </div>
      )}

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-400">
              Game History
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
              History
            </h1>

            <p className="mt-3 max-w-2xl text-base leading-7 text-white/55">
              Manage ongoing games and browse completed match history from one page.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-black transition hover:bg-orange-400"
          >
            Open Game Board
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["All History", games.length],
            ["Ongoing", ongoingCount],
            ["Completed", completedCount],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-3xl border border-white/10 bg-[#0d1829]/80 p-5"
            >
              <p className="text-sm text-white/45">{label}</p>
              <p className="mt-2 text-3xl font-black text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Calendar
            month={calendarMonth}
            selectedDate={selectedDate}
            completedDates={completedDates}
            onMonthChange={setCalendarMonth}
            onSelectDate={(date) => {
              setSelectedDate(date);

              if (date) {
                setStatus("completed");
              }
            }}
          />

          <div>
            <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-[#0d1829]/80 p-4 sm:flex-row">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search game name..."
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-orange-400/50"
              />

              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as FilterStatus)
                }
                className="rounded-2xl border border-white/10 bg-[#101b2c] px-4 py-3 text-sm text-white outline-none focus:border-orange-400/50"
              >
                <option value="all">All history</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                  setSelectedDate("");
                }}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/75 transition hover:bg-white/10"
              >
                Clear
              </button>
            </div>

            {selectedDate && (
              <div className="mt-3 rounded-2xl border border-orange-400/20 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
                Showing completed games from{" "}
                <span className="font-black">{selectedDate}</span>
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">
                {error}
              </div>
            )}

            {loading ? (
              <div className="mt-4 rounded-3xl border border-white/10 bg-[#0d1829]/80 p-10 text-center">
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-orange-400" />
                <p className="mt-4 text-sm text-white/45">
                  Loading your games...
                </p>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                {filteredGames.map((game) => (
                  <article
                    key={game.id}
                    className="rounded-3xl border border-white/10 bg-[#0d1829]/85 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.2)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-white/35">
                          Game #{game.id}
                        </p>

                        <h2 className="mt-2 text-xl font-black text-white">
                          {game.name}
                        </h2>

                        <p className="mt-2 text-sm text-white/45">
                          {game.moves?.length ?? 0} recorded moves
                        </p>
                      </div>

                      <span
                        className={
                          game.status === "completed"
                            ? "rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold capitalize text-emerald-200"
                            : "rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-bold capitalize text-amber-200"
                        }
                      >
                        {game.status}
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl border border-white/5 bg-black/15 p-4 text-sm">
                      <div>
                        <p className="text-xs text-white/35">Created</p>
                        <p className="mt-1 text-white/70">
                          {formatDate(game.created_at)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-white/35">
                          {game.status === "completed"
                            ? "Completed"
                            : "Last updated"}
                        </p>
                        <p className="mt-1 text-white/70">
                          {formatDate(
                            game.status === "completed"
                              ? game.completed_at
                              : game.updated_at
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {game.status === "ongoing" ? (
                        <>
                          <Link
                            href={`/dashboard?game=${game.id}`}
                            className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-black text-black transition hover:bg-orange-400"
                          >
                            Resume
                          </Link>

                          <button
                            type="button"
                            disabled={workingId === game.id}
                            onClick={() => void completeGame(game)}
                            className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2.5 text-sm font-bold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-40"
                          >
                            {workingId === game.id
                              ? "Working..."
                              : "Complete"}
                          </button>
                        </>
                      ) : (
                        <Link
                          href={`/dashboard/analysis/${game.id}`}
                          className="rounded-xl bg-[#5865F2] px-4 py-2.5 text-sm font-black text-white transition hover:brightness-110"
                        >
                          Open Analysis
                        </Link>
                      )}

                      <button
                        type="button"
                        disabled={workingId === game.id}
                        onClick={() => void deleteGame(game)}
                        className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-200 transition hover:bg-red-500/20 disabled:opacity-40"
                      >
                        {workingId === game.id
                          ? "Working..."
                          : "Delete"}
                      </button>
                    </div>
                  </article>
                ))}

                {filteredGames.length === 0 && (
                  <div className="col-span-full rounded-3xl border border-white/10 bg-[#0d1829]/80 p-10 text-center">
                    <p className="text-lg font-bold text-white">
                      No games found
                    </p>
                    <p className="mt-2 text-sm text-white/40">
                      Change the search, status, or calendar filter.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </PageShell>
  );
}

export default function GamesPage() {
  return (
    <ProtectedRoute role="user">
      <GamesContent />
    </ProtectedRoute>
  );
}