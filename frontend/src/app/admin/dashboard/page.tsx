"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/auth/protected-route";
import {
  type AuthUser,
  getStoredToken,
  getStoredUser,
  logout,
} from "@/lib/auth";

type AdminTab = "overview" | "users" | "games" | "moves";

type UserRow = {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  games_count: number;
  created_at?: string;
};

type GameRow = {
  id: number;
  name: string;
  status: string;
  moves_count: number;
  created_at?: string;
  updated_at?: string;
  user?: {
    id: number;
    name: string;
    email: string;
  } | null;
};

type MoveRow = {
  id: number;
  notation: string;
  created_at?: string;
  game?: {
    id: number;
    name: string;
    user?: {
      id: number;
      name: string;
      email: string;
    } | null;
  } | null;
};

type Paginated<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

type Overview = {
  total_users: number;
  total_admins: number;
  total_games: number;
  ongoing_games: number;
  completed_games: number;
  total_moves: number;
  recent_users: UserRow[];
  recent_games: GameRow[];
  recent_moves: MoveRow[];
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "/api/proxy/api";

function formatDate(value?: string | null) {
  if (!value) return "â€”";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function adminFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = getStoredToken("admin");

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof payload?.message === "string"
        ? payload.message
        : `Request failed (${response.status}).`;

    throw new Error(message);
  }

  return payload as T;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function AdminDashboardContent() {
  const router = useRouter();
  const currentUser = getStoredUser("admin");
  const [tab, setTab] = useState<AdminTab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<Paginated<UserRow> | null>(null);
  const [games, setGames] = useState<Paginated<GameRow> | null>(null);
  const [moves, setMoves] = useState<Paginated<MoveRow> | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await adminFetch<Overview>("/admin/overview");
      setOverview(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const data = await adminFetch<Paginated<UserRow>>(
        `/admin/users?${params.toString()}`
      );

      setUsers(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load users."
      );
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  const loadGames = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (status) {
        params.set("status", status);
      }

      const data = await adminFetch<Paginated<GameRow>>(
        `/admin/games?${params.toString()}`
      );

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
  }, [page, search, status]);

  const loadMoves = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const data = await adminFetch<Paginated<MoveRow>>(
        `/admin/moves?${params.toString()}`
      );

      setMoves(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load moves."
      );
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (tab === "overview") void loadOverview();
      if (tab === "users") void loadUsers();
      if (tab === "games") void loadGames();
      if (tab === "moves") void loadMoves();
    }, tab === "overview" ? 0 : 250);

    return () => window.clearTimeout(timer);
  }, [tab, loadOverview, loadUsers, loadGames, loadMoves]);

  useEffect(() => {
    setPage(1);
  }, [tab, search, status]);

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function handleLogout() {
    await logout("admin");
    router.replace("/admin/login");
    router.refresh();
  }

  async function deleteUser(user: UserRow) {
    if (
      !window.confirm(
        `Delete user "${user.name}"?\n\nThis action cannot be undone.`
      )
    ) {
      return;
    }

    setWorkingId(user.id);
    setError("");

    try {
      await adminFetch(`/admin/users/${user.id}`, {
        method: "DELETE",
      });

      setToast("User deleted successfully.");
      await loadUsers();
      await loadOverview();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete the user."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function deleteGame(game: GameRow) {
    if (
      !window.confirm(
        `Delete game "${game.name}" and all of its moves?\n\nThis action cannot be undone.`
      )
    ) {
      return;
    }

    setWorkingId(game.id);
    setError("");

    try {
      await adminFetch(`/admin/games/${game.id}`, {
        method: "DELETE",
      });

      setToast("Game and its moves were deleted.");
      await loadGames();
      await loadOverview();
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

  async function deleteMove(move: MoveRow) {
    if (
      !window.confirm(
        `Delete move "${move.notation}"?\n\nThis action cannot be undone.`
      )
    ) {
      return;
    }

    setWorkingId(move.id);
    setError("");

    try {
      await adminFetch(`/admin/moves/${move.id}`, {
        method: "DELETE",
      });

      setToast("Move deleted successfully.");
      await loadMoves();
      await loadOverview();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete the move."
      );
    } finally {
      setWorkingId(null);
    }
  }

  const currentPageData = useMemo(() => {
    if (tab === "users") return users;
    if (tab === "games") return games;
    if (tab === "moves") return moves;
    return null;
  }, [tab, users, games, moves]);

  const navItems: Array<{
    id: AdminTab;
    label: string;
    description: string;
  }> = [
    {
      id: "overview",
      label: "Overview",
      description: "System statistics",
    },
    {
      id: "users",
      label: "Users",
      description: "View and delete users",
    },
    {
      id: "games",
      label: "Games",
      description: "View and delete games",
    },
    {
      id: "moves",
      label: "Moves",
      description: "View and delete moves",
    },
  ];

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-[0.08] [background-image:radial-gradient(rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:20px_20px]" />
      <div className="pointer-events-none fixed -left-40 top-0 h-[520px] w-[520px] rounded-full bg-orange-500/10 blur-3xl" />
      <div className="pointer-events-none fixed right-0 top-20 h-[480px] w-[480px] rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="relative z-10 flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-[#0b1525]/90 p-6 backdrop-blur-xl lg:flex lg:flex-col">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="REGISSION"
              width={48}
              height={48}
              className="object-contain"
            />
            <div>
              <p className="font-black tracking-wide">REGISSION</p>
              <p className="text-xs text-orange-300">
                Administrator Console
              </p>
            </div>
          </div>

          <nav className="mt-10 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cx(
                  "w-full rounded-2xl border px-4 py-3 text-left transition",
                  tab === item.id
                    ? "border-orange-400/30 bg-orange-500/10 text-white"
                    : "border-transparent text-white/55 hover:border-white/10 hover:bg-white/5 hover:text-white"
                )}
              >
                <p className="text-sm font-bold">{item.label}</p>
                <p className="mt-1 text-xs opacity-60">
                  {item.description}
                </p>
              </button>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm font-bold">
              {currentUser?.name ?? "Administrator"}
            </p>
            <p className="mt-1 truncate text-xs text-white/45">
              {currentUser?.email}
            </p>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-4 w-full rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-200 transition hover:bg-red-500/20"
            >
              Sign out
            </button>
          </div>
        </aside>

        <section className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
          <header className="flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-400">
                Administrator Dashboard
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                System Control Centre
              </h1>
              <p className="mt-2 text-sm text-white/45">
                Manage users, games, and recorded chess moves.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 lg:hidden">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cx(
                    "rounded-xl border px-3 py-2 text-xs font-bold",
                    tab === item.id
                      ? "border-orange-400/40 bg-orange-500/15 text-orange-200"
                      : "border-white/10 bg-white/5 text-white/60"
                  )}
                >
                  {item.label}
                </button>
              ))}

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200"
              >
                Logout
              </button>
            </div>
          </header>

          {tab !== "overview" && (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={
                  tab === "users"
                    ? "Search name or email..."
                    : tab === "games"
                    ? "Search game name..."
                    : "Search move notation..."
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-orange-400/50 sm:max-w-md"
              />

              {tab === "games" && (
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-[#0d1727] px-4 py-3 text-sm text-white outline-none focus:border-orange-400/50"
                >
                  <option value="">All statuses</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                </select>
              )}
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {toast && (
            <div className="fixed right-5 top-5 z-50 rounded-2xl border border-emerald-400/25 bg-[#10241d] px-5 py-4 text-sm font-semibold text-emerald-200 shadow-2xl">
              {toast}
            </div>
          )}

          {loading && (
            <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-orange-400" />
              <p className="mt-4 text-sm text-white/45">
                Loading records from phpMyAdmin database...
              </p>
            </div>
          )}

          {!loading && tab === "overview" && overview && (
            <div className="mt-7 space-y-7">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  ["Registered Users", overview.total_users],
                  ["Administrators", overview.total_admins],
                  ["Total Games", overview.total_games],
                  ["Ongoing Games", overview.ongoing_games],
                  ["Completed Games", overview.completed_games],
                  ["Recorded Moves", overview.total_moves],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-3xl border border-white/10 bg-[#0e192a]/80 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.22)] backdrop-blur"
                  >
                    <p className="text-sm text-white/45">{label}</p>
                    <p className="mt-3 text-4xl font-black">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#0e192a]/80">
                  <div className="border-b border-white/10 px-6 py-5">
                    <h2 className="text-lg font-black">
                      Recent Users
                    </h2>
                  </div>

                  <div className="divide-y divide-white/5">
                    {overview.recent_users.length === 0 ? (
                      <p className="p-6 text-sm text-white/40">
                        No users are available.
                      </p>
                    ) : (
                      overview.recent_users.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between gap-4 px-6 py-4"
                        >
                          <div>
                            <p className="font-semibold">{user.name}</p>
                            <p className="mt-1 text-xs text-white/40">
                              {user.email}
                            </p>
                          </div>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase text-white/55">
                            {user.role}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#0e192a]/80">
                  <div className="border-b border-white/10 px-6 py-5">
                    <h2 className="text-lg font-black">
                      Recent Games
                    </h2>
                  </div>

                  <div className="divide-y divide-white/5">
                    {overview.recent_games.length === 0 ? (
                      <p className="p-6 text-sm text-white/40">
                        No games are available.
                      </p>
                    ) : (
                      overview.recent_games.map((game) => (
                        <div
                          key={game.id}
                          className="flex items-center justify-between gap-4 px-6 py-4"
                        >
                          <div>
                            <p className="font-semibold">{game.name}</p>
                            <p className="mt-1 text-xs text-white/40">
                              {game.user?.email ?? "Unassigned"} Â·{" "}
                              {game.moves_count ?? 0} moves
                            </p>
                          </div>
                          <span
                            className={cx(
                              "rounded-full border px-3 py-1 text-xs font-bold capitalize",
                              game.status === "completed"
                                ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                                : "border-amber-400/20 bg-amber-500/10 text-amber-200"
                            )}
                          >
                            {game.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}

          {!loading && tab === "users" && users && (
            <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-[#0e192a]/85">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wider text-white/45">
                    <tr>
                      <th className="px-5 py-4">User</th>
                      <th className="px-5 py-4">Role</th>
                      <th className="px-5 py-4">Games</th>
                      <th className="px-5 py-4">Registered</th>
                      <th className="px-5 py-4 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/5">
                    {users.data.map((user) => (
                      <tr key={user.id}>
                        <td className="px-5 py-4">
                          <p className="font-semibold">{user.name}</p>
                          <p className="mt-1 text-xs text-white/40">
                            {user.email}
                          </p>
                        </td>
                        <td className="px-5 py-4 capitalize text-white/65">
                          {user.role}
                        </td>
                        <td className="px-5 py-4 text-white/65">
                          {user.games_count}
                        </td>
                        <td className="px-5 py-4 text-white/45">
                          {formatDate(user.created_at)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            disabled={
                              workingId === user.id ||
                              currentUser?.id === user.id
                            }
                            onClick={() => deleteUser(user)}
                            className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            {currentUser?.id === user.id
                              ? "Current Admin"
                              : workingId === user.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {users.data.length === 0 && (
                <p className="p-8 text-center text-sm text-white/40">
                  No users matched your search.
                </p>
              )}
            </div>
          )}

          {!loading && tab === "games" && games && (
            <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-[#0e192a]/85">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wider text-white/45">
                    <tr>
                      <th className="px-5 py-4">Game</th>
                      <th className="px-5 py-4">Owner</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Moves</th>
                      <th className="px-5 py-4">Updated</th>
                      <th className="px-5 py-4 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/5">
                    {games.data.map((game) => (
                      <tr key={game.id}>
                        <td className="px-5 py-4">
                          <p className="font-semibold">{game.name}</p>
                          <p className="mt-1 text-xs text-white/35">
                            ID #{game.id}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-white/70">
                            {game.user?.name ?? "Unassigned"}
                          </p>
                          <p className="mt-1 text-xs text-white/35">
                            {game.user?.email ?? "No linked user"}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={cx(
                              "rounded-full border px-3 py-1 text-xs font-bold capitalize",
                              game.status === "completed"
                                ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                                : "border-amber-400/20 bg-amber-500/10 text-amber-200"
                            )}
                          >
                            {game.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-white/65">
                          {game.moves_count}
                        </td>
                        <td className="px-5 py-4 text-white/45">
                          {formatDate(game.updated_at)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            disabled={workingId === game.id}
                            onClick={() => deleteGame(game)}
                            className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            {workingId === game.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {games.data.length === 0 && (
                <p className="p-8 text-center text-sm text-white/40">
                  No games matched your filter.
                </p>
              )}
            </div>
          )}

          {!loading && tab === "moves" && moves && (
            <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-[#0e192a]/85">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wider text-white/45">
                    <tr>
                      <th className="px-5 py-4">Move</th>
                      <th className="px-5 py-4">Game</th>
                      <th className="px-5 py-4">Owner</th>
                      <th className="px-5 py-4">Recorded</th>
                      <th className="px-5 py-4 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/5">
                    {moves.data.map((move) => (
                      <tr key={move.id}>
                        <td className="px-5 py-4">
                          <span className="rounded-xl border border-orange-400/20 bg-orange-500/10 px-3 py-2 font-mono font-bold text-orange-200">
                            {move.notation}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-white/70">
                          {move.game?.name ?? "Deleted game"}
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-white/70">
                            {move.game?.user?.name ?? "Unassigned"}
                          </p>
                          <p className="mt-1 text-xs text-white/35">
                            {move.game?.user?.email ?? "â€”"}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-white/45">
                          {formatDate(move.created_at)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            disabled={workingId === move.id}
                            onClick={() => deleteMove(move)}
                            className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            {workingId === move.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {moves.data.length === 0 && (
                <p className="p-8 text-center text-sm text-white/40">
                  No moves matched your search.
                </p>
              )}
            </div>
          )}

          {!loading &&
            tab !== "overview" &&
            currentPageData &&
            currentPageData.last_page > 1 && (
              <div className="mt-6 flex items-center justify-between gap-4">
                <p className="text-sm text-white/40">
                  Page {currentPageData.current_page} of{" "}
                  {currentPageData.last_page} Â·{" "}
                  {currentPageData.total} records
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold disabled:opacity-30"
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    disabled={
                      page >= currentPageData.last_page
                    }
                    onClick={() =>
                      setPage((current) => current + 1)
                    }
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
        </section>
      </div>
    </main>
  );
}

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute role="admin">
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}