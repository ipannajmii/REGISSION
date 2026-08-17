"use client";
import "./turn-and-move-scroll.client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Chess, type Piece } from "chess.js";
import PageShell from "@/components/page-shell";
import { getStoredToken } from "@/lib/auth";
import ProtectedRoute from "@/components/auth/protected-route";
import GameCompletionPopup from "@/components/regission/GameCompletionPopup";
import DashboardPiActiveAutoSelect from "@/components/regission/DashboardPiActiveAutoSelect";

type ApiGame = {
  id: number;
  name: string;
  status: string;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type ApiMove = {
  id: number;
  game_id: number;
  notation: string;
  created_at?: string;
  updated_at?: string;
};

type PiStatus = {
  status: string;
  can_move: boolean;
  last_move: string;
  locked?: boolean;
  game_id?: number;
  fen?: string;
  detection_enabled?: boolean;
  auto_enabled?: boolean;
  sync_required?: boolean;
};

const API_BASE = "/api/proxy/api";
const DEFAULT_TOKEN = "";

const PI_STREAM_BASE =
  process.env.NEXT_PUBLIC_RPI_BASE_URL ?? "http://192.168.8.102:5051";
const PI_API_BASE = "/api/pi";

async function apiFetch<T>(
  path: string,
  opts: { method?: string; token?: string; body?: any } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });

  const ct = res.headers.get("content-type") ?? "";
  const isJson = ct.includes("application/json");

  if (!res.ok) {
    const payload = isJson
      ? await res.json().catch(() => ({}))
      : await res.text().catch(() => "");

    const msg =
      typeof payload === "string"
        ? payload
        : (payload as any)?.message ||
          (payload as any)?.error ||
          `Request failed (${res.status})`;

    throw new Error(msg);
  }

  if (!isJson) {
    const text = await res.text().catch(() => "");
    throw new Error(`Expected JSON response, got: ${text.slice(0, 200)}...`);
  }

  return (await res.json()) as T;
}

function cx(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function normalizeGameName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function looksLikeDuplicateGameNameError(message: string) {
  const m = message.toLowerCase();

  return (
    m.includes("duplicate entry") ||
    m.includes("unique") ||
    m.includes("games_name_unique") ||
    m.includes("already exists")
  );
}

function clearToast(
  toastTimer: React.MutableRefObject<number | null>,
  setToast: React.Dispatch<React.SetStateAction<string>>
) {
  setToast("");

  if (toastTimer.current) {
    window.clearTimeout(toastTimer.current);
    toastTimer.current = null;
  }
}

function buildChessFromMoves(moveList: ApiMove[]) {
  const c = new Chess();

  const chronological = [...moveList]
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((m) => m.notation);

  for (const san of chronological) {
  try {
    const r = c.move(san as any);
    if (!r) {
      console.warn("Invalid move skipped:", san);
      break;
    }
  } catch {
    console.warn("Invalid move skipped:", san);
    break;
  }
}

  return c;
}

function BoardView({
  board,
  flipped,
}: {
  board: (Piece | null)[][];
  flipped: boolean;
}) {
  const ranks = flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const files = flipped ? "hgfedcba".split("") : "abcdefgh".split("");

  const rows = flipped ? [...board].reverse() : board;
  const displayRows = rows.map((row) => (flipped ? [...row].reverse() : row));

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[320px] sm:max-w-[350px] md:max-w-[390px] lg:max-w-[420px] xl:max-w-[440px]">
        <div className="grid grid-cols-[14px_1fr] grid-rows-[1fr_14px] gap-x-[6px] gap-y-[4px]">
          <div className="grid grid-rows-8">
            {ranks.map((r) => (
              <div
                key={r}
                className="flex items-center justify-center text-[10px] font-semibold text-[#d8c39f]"
              >
                {r}
              </div>
            ))}
          </div>

          <div className="overflow-hidden">
            <div className="grid aspect-square w-full grid-cols-8 border border-black/20 shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
              {displayRows.flatMap((row, rr) =>
                row.map((sq, cc) => {
                  const isLight = (rr + cc) % 2 === 0;

                  return (
                    <div
                      key={`${rr}-${cc}`}
                      className="flex aspect-square items-center justify-center"
                      style={{
                        backgroundColor: isLight ? "#e6d2ad" : "#b98d63",
                      }}
                    >
                      {sq && (
                        <img
                          src={`/pieces/${sq.color}${sq.type.toUpperCase()}.svg`}
                          alt=""
                          draggable={false}
                          className="pointer-events-none h-[74%] w-[74%] select-none object-contain"
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div />

          <div className="grid grid-cols-8">
            {files.map((f) => (
              <div
                key={f}
                className="flex items-center justify-center text-[10px] font-semibold text-[#d8c39f]"
              >
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardPageContent() {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const [token, setToken] = useState(DEFAULT_TOKEN);
  const [gameName, setGameName] = useState("");
  const [showCreateGame, setShowCreateGame] = useState(false);
  const [assignmentPromptGame, setAssignmentPromptGame] =
    useState<ApiGame | null>(null);

  const [games, setGames] = useState<ApiGame[]>([]);
  const [activeGameId, setActiveGameId] = useState<number | null>(null);
  const [moves, setMoves] = useState<ApiMove[]>([]);

  const [flipped, setFlipped] = useState(false);
  const [showTools, setShowTools] = useState(true);
  const [search, setSearch] = useState("");

  const [cameraSrc, setCameraSrc] = useState("");
  const [boardPreviewSrc, setBoardPreviewSrc] = useState("");
  const [showPiPreview, setShowPiPreview] = useState(false);
  const [autoControlBusy, setAutoControlBusy] = useState(false);
  const [piStatus, setPiStatus] = useState<PiStatus>({
    status: "Connecting to Raspberry Pi...",
    can_move: false,
    last_move: "-",
    locked: false,
  });

  const toastTimer = useRef<number | null>(null);

  function showToast(msg: string) {
    setToast(msg);

    if (toastTimer.current) {
      window.clearTimeout(toastTimer.current);
    }

    toastTimer.current = window.setTimeout(() => setToast(""), 2200);
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        window.clearTimeout(toastTimer.current);
      }
    };
  }, []);

  function startPiPreview() {
    setCameraSrc(`${PI_STREAM_BASE}/video?t=${Date.now()}`);
    setBoardPreviewSrc(`${PI_STREAM_BASE}/board?t=${Date.now()}`);
    setShowPiPreview(true);
  }

  function stopPiPreview() {
    // Removing the MJPEG <img> elements closes both browser stream connections.
    // Detection still runs on the Raspberry Pi.
    setShowPiPreview(false);
    setCameraSrc("");
    setBoardPreviewSrc("");
  }

  useEffect(() => {
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(`${PI_API_BASE}/status?t=${Date.now()}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok || data.ok === false) {
          throw new Error(data.message ?? `Pi status failed (${res.status})`);
        }

        setPiStatus({
          status: data.message ?? "Raspberry Pi connected",
          can_move:
            Boolean(data.detection_enabled) &&
            !Boolean(data.sync_required) &&
            Boolean(data.game_assigned),
          last_move: data.last_detected_move ?? "-",
          locked: Boolean(data.board_locked),
          game_id: data.active_game_id,
          fen: data.fen,
          detection_enabled: Boolean(data.detection_enabled),
          auto_enabled: Boolean(data.auto_enabled),
          sync_required: Boolean(data.sync_required),
        });
      } catch {
        setPiStatus({
          status: "Raspberry Pi not connected",
          can_move: false,
          last_move: "-",
          locked: false,
        });
      }
    }, 2500);

    return () => window.clearInterval(timer);
  }, []);

  async function resetPiBoard() {
    try {
      const res = await fetch(`${PI_API_BASE}/reset_calibration?t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.ok === false) {
        throw new Error(data.message ?? "Pi reset failed");
      }

      if (showPiPreview) {
        setCameraSrc(`${PI_STREAM_BASE}/video?t=${Date.now()}`);
        setBoardPreviewSrc(`${PI_STREAM_BASE}/board?t=${Date.now()}`);
      }
      showToast("Pi board reset ✅");
    } catch {
      showToast("Failed to reset Pi board");
    }
  }

  async function pausePiDetection() {
    try {
      const res = await fetch(`${PI_API_BASE}/pause?t=${Date.now()}`, {
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.ok === false) {
        throw new Error(data.message ?? "Pi pause failed");
      }

      setPiStatus((prev) => ({
        ...prev,
        status: data.message ?? "Detection paused",
        can_move: false,
        detection_enabled: false,
      }));

      showToast("Detection paused. You can adjust pieces ✅");
    } catch {
      showToast("Failed to pause Pi detection");
    }
  }

  async function resumePiDetection() {
    try {
      const res = await fetch(`${PI_API_BASE}/resume?t=${Date.now()}`, {
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.ok === false) {
        throw new Error(data.message ?? "Pi resume failed");
      }

      setPiStatus((prev) => ({
        ...prev,
        status: data.message ?? "Detection enabled",
        can_move: false,
        detection_enabled: true,
      }));

      showToast("Detection enabled. Keep board still ✅");
    } catch {
      showToast("Failed to resume Pi detection");
    }
  }

  async function setPiAutoDetection(enable: boolean) {
    if (autoControlBusy) return;

    setAutoControlBusy(true);

    try {
      const route = enable ? "auto_on" : "auto_off";
      const res = await fetch(`${PI_API_BASE}/${route}?t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.ok === false) {
        throw new Error(
          data.message ??
            (enable ? "Failed to start AUTO detection" : "Failed to stop AUTO detection")
        );
      }

      setPiStatus((prev) => ({
        ...prev,
        status:
          data.message ??
          (enable ? "AUTO detection enabled" : "AUTO detection disabled"),
        can_move: enable ? true : prev.can_move,
        detection_enabled:
          data.detection_enabled !== undefined
            ? Boolean(data.detection_enabled)
            : prev.detection_enabled,
        auto_enabled: enable,
      }));

      if (enable) {
        // AUTO and YOLO remain on the Pi. Closing the two MJPEG previews
        // reduces Chrome CPU, RAM and network usage on the laptop.
        stopPiPreview();
        showToast("AUTO detection started on Raspberry Pi ✅");
      } else {
        showToast("AUTO detection stopped ✅");
      }
    } catch (e: any) {
      showToast(
        e?.message ??
          (enable ? "Failed to start AUTO detection" : "Failed to stop AUTO detection")
      );
    } finally {
      setAutoControlBusy(false);
    }
  }

  async function syncPiBoard() {
    try {
      const res = await fetch(`${PI_API_BASE}/sync?t=${Date.now()}`, {
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      const statusRes = await fetch(`${PI_API_BASE}/status?t=${Date.now()}`, {
        cache: "no-store",
      });

      const statusData = await statusRes.json().catch(() => ({}));

      setPiStatus({
        status:
          statusData.message ?? data.message ?? "Raspberry Pi connected",
        can_move:
          Boolean(statusData.detection_enabled) &&
          !Boolean(statusData.sync_required) &&
          Boolean(statusData.game_assigned),
        last_move: statusData.last_detected_move ?? "-",
        locked: Boolean(statusData.board_locked),
        game_id: statusData.active_game_id,
        fen: statusData.fen,
        detection_enabled: Boolean(statusData.detection_enabled),
        auto_enabled: Boolean(statusData.auto_enabled),
        sync_required: Boolean(statusData.sync_required),
      });

      if (activeGameId !== null) {
        await loadMoves(activeGameId);
      }

      await loadGames(true);

      if (!res.ok || data.ok === false) {
        showToast(data.message ?? "Pi sync failed ❌");
        return;
      }

      showToast("Website + Pi synced with MySQL ✅");
    } catch {
      setPiStatus({
        status: "Raspberry Pi not connected",
        can_move: false,
        last_move: "-",
        locked: false,
      });

      showToast("Failed to sync Pi ❌");
    }
  }

  useEffect(() => {
    const saved = getStoredToken("user");

    if (saved && saved.trim()) {
      setToken(saved);
    } else {
      
      setToken("");
    }
  }, []);

  useEffect(() => {
    if (token.trim()) {
      localStorage.setItem("regission_token", token);
    }
  }, [token]);

  const activeGame = useMemo(
    () => (activeGameId ? games.find((g) => g.id === activeGameId) ?? null : null),
    [games, activeGameId]
  );

  const filteredGames = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return games;

    return games.filter(
      (g) => g.name.toLowerCase().includes(q) || String(g.id).includes(q)
    );
  }, [games, search]);

  async function loadGames(preserveSelection = true, silent = false) {
    const t = token.trim();

    if (!t) {
      setGames([]);
      setActiveGameId(null);
      setMoves([]);
      return;
    }

    try {
      const url =
        `/games?status=ongoing` +
        (search.trim() ? `&search=${encodeURIComponent(search.trim())}` : "");

      const data = await apiFetch<ApiGame[]>(url, { token: t });

      setGames(data);

      if (data.length === 0) {
        setActiveGameId(null);
        setMoves([]);
        return;
      }

      setActiveGameId((prev) => {
        if (preserveSelection && prev !== null && data.some((g) => g.id === prev)) {
          return prev;
        }

        return data[0].id;
      });
    } catch (e: any) {
      if (!silent) {
        showToast(e?.message ?? "Failed to load games");
      }
    }
  }

  async function loadMoves(gameId: number, silent = false) {
    const t = token.trim();

    if (!t) {
      setMoves([]);
      return [];
    }

    try {
      const data = await apiFetch<ApiMove[]>(`/games/${gameId}/moves`, {
        token: t,
      });

      setMoves(data);
      return data;
    } catch (e: any) {
      if (!silent) {
        showToast(e?.message ?? "Failed to load moves");
      }
      setMoves([]);
      return [];
    }
  }

  useEffect(() => {
    if (token.trim()) {
      loadGames(false);
    } else {
      setGames([]);
      setActiveGameId(null);
      setMoves([]);
    }
  }, [token]);

  useEffect(() => {
    if (activeGameId !== null) {
      loadMoves(activeGameId);
    } else {
      setMoves([]);
    }
  }, [activeGameId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (activeGameId !== null) {
        loadMoves(activeGameId, true);
      }

      if (token.trim()) {
        loadGames(true, true);
      }
    }, 3000);

    return () => window.clearInterval(interval);
  }, [activeGameId, token, search]);

  async function createGame() {
    clearToast(toastTimer, setToast);

    const t = token.trim();
    const name = gameName.trim();

    if (!t) {
      setGameName("");
      setShowCreateGame(false);
      return showToast("Token is required.");
    }

    if (!name) {
      setGameName("");
      setShowCreateGame(false);
      return showToast("Enter a game name.");
    }

    const duplicateExistsLocally = games.some(
      (g) => normalizeGameName(g.name) === normalizeGameName(name)
    );

    if (duplicateExistsLocally) {
      setGameName("");
      setShowCreateGame(false);
      return showToast(`Game name "${name}" already exists.`);
    }

    setBusy(true);

    try {
      const created = await apiFetch<ApiGame>("/games", {
        method: "POST",
        token: t,
        body: { name },
      });

      setGames([created, ...games]);
      setActiveGameId(created.id);
      setMoves([]);
      setGameName("");
      setShowCreateGame(false);

      showToast("Game created ✅");
    } catch (e: any) {
      setGameName("");
      setShowCreateGame(false);

      const msg =
        typeof e?.message === "string" ? e.message : "Create game failed";

      if (looksLikeDuplicateGameNameError(msg)) {
        showToast(`Game name "${name}" already exists.`);
      } else {
        showToast(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function completeActiveGame() {
    if (!activeGameId) return;

    const t = token.trim();

    if (!t) {
      return showToast("Token is required.");
    }

    const completedId = activeGameId;

    try {
      await apiFetch(`/games/${completedId}/complete`, {
        method: "POST",
        token: t,
      });

      const remaining = games.filter((g) => g.id !== completedId);
      setGames(remaining);

      if (remaining.length > 0) {
        const nextId = remaining[0].id;
        setActiveGameId(nextId);
        await loadMoves(nextId);
      } else {
        setActiveGameId(null);
        setMoves([]);
      }

      showToast("Game completed ✅ moved to history");
    } catch (e: any) {
      showToast(e?.message ?? "Failed to complete game");
    }
  }

  const chess = useMemo(() => buildChessFromMoves(moves), [moves]);
  const fen = useMemo(() => chess.fen(), [chess]);
  const board = useMemo(() => chess.board(), [chess]);

  const pgn = useMemo(() => {
    const headerName = activeGame?.name ?? "Regission Game";
    const date = new Date().toISOString().slice(0, 10).replaceAll("-", ".");

    const headers = [
      `[Event "${headerName}"]`,
      `[Site "Regission Dashboard"]`,
      `[Date "${date}"]`,
      `[Round "-"]`,
      `[White "-"]`,
      `[Black "-"]`,
      `[Result "*"]`,
      ``,
    ].join("\n");

    const movetext = chess.pgn().trim();

    return `${headers}${movetext ? movetext + "\n" : ""}*`.trim();
  }, [chess, activeGame]);

  const moveRows = useMemo(() => {
    const chronological = [...moves]
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((m) => m.notation);

    const rows: { no: number; w: string; b: string }[] = [];

    for (let i = 0; i < chronological.length; i += 2) {
      rows.push({
        no: i / 2 + 1,
        w: chronological[i] ?? "",
        b: chronological[i + 1] ?? "",
      });
    }

    return rows;
  }, [moves]);

  const lastMove = useMemo(() => {
    if (!moves.length) return "-";

    const chronological = [...moves].slice().sort((a, b) => a.id - b.id);
    return chronological[chronological.length - 1]?.notation ?? "-";
  }, [moves]);

  return (
    <PageShell>
      {toast && (
        <div className="pointer-events-none fixed left-1/2 top-24 z-[100] -translate-x-1/2">
          <div className="min-w-[320px] max-w-[90vw] rounded-2xl border border-emerald-400/25 bg-[#0b2b2a]/90 px-5 py-4 text-emerald-200 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            {toast}
          </div>
        </div>
      )}

      {showCreateGame && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#0b1525] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-400">
                  New Match
                </p>

                <h2 className="mt-2 text-2xl font-black text-white">
                  Create a new game
                </h2>

                <p className="mt-2 text-sm leading-6 text-white/50">
                  Enter a clear name for the chess match.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowCreateGame(false);
                  setGameName("");
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="Close create game dialog"
              >
                X
              </button>
            </div>

            <div className="mt-6">
              <label className="text-sm font-bold text-white/75">
                Game name
              </label>

              <input
                autoFocus
                value={gameName}
                onChange={(event) => {
                  setGameName(event.target.value);
                  clearToast(toastTimer, setToast);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !busy && gameName.trim()) {
                    void createGame();
                  }

                  if (event.key === "Escape") {
                    setShowCreateGame(false);
                    setGameName("");
                  }
                }}
                placeholder="Example: Club Training Match"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/25 px-5 py-4 text-white outline-none placeholder:text-white/30 focus:border-orange-400 focus:ring-4 focus:ring-orange-400/10"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateGame(false);
                  setGameName("");
                }}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/70 transition hover:bg-white/10"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={busy || !gameName.trim()}
                onClick={() => void createGame()}
                className="rounded-2xl bg-[#ff7a00] px-6 py-3 text-sm font-black text-black shadow-[0_12px_30px_rgba(249,115,22,0.28)] transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busy ? "Creating..." : "Create Game"}
              </button>
            </div>
          </div>
        </div>
      )}

      {assignmentPromptGame && (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[28px] border border-orange-400/25 bg-[#0b1525] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.65)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">
                  Game selected
                </p>

                <h2 className="mt-2 text-2xl font-black text-white">
                  {assignmentPromptGame.name}
                  <span className="ml-2 text-base font-semibold text-white/40">
                    #{assignmentPromptGame.id}
                  </span>
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setAssignmentPromptGame(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="Close Raspberry Pi activation reminder"
              >
                X
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4 text-sm leading-6 text-yellow-100">
              {piStatus.game_id ? (
                <>
                  The Raspberry Pi is currently assigned to Game #{piStatus.game_id}.
                  You can view this game board now, but physical moves will not be
                  recorded here until you activate this game on the Raspberry Pi.
                </>
              ) : (
                <>
                  This game is not currently assigned to the Raspberry Pi. You can
                  view the board now, but physical moves will not be recorded here
                  until the game is activated.
                </>
              )}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setAssignmentPromptGame(null)}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/75 transition hover:bg-white/10"
              >
                Continue Viewing
              </button>

              <button
                type="button"
                onClick={() => {
                  const gameId = assignmentPromptGame.id;
                  setAssignmentPromptGame(null);
                  router.push(`/device?game_id=${gameId}`);
                }}
                className="rounded-2xl bg-[#ff7a00] px-5 py-3 text-sm font-black text-black shadow-[0_12px_30px_rgba(249,115,22,0.28)] transition hover:bg-orange-400"
              >
                Activate on Raspberry Pi
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="mx-auto mb-8 max-w-6xl px-4 pt-6">
        <div className="max-w-4xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#9aa5ff]">
            Regission Dashboard
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-6xl">
            Dashboard
          </h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-white/72">
            Vision-powered chess notation dashboard. Moves are received
            automatically from Raspberry Pi through Laravel API and stored in MySQL.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setGameName("");
                clearToast(toastTimer, setToast);
                setShowCreateGame(true);
              }}
              className="rounded-full bg-[#ff7a00] px-6 py-3 text-sm font-black text-black shadow-[0_14px_35px_rgba(249,115,22,0.3)] transition hover:-translate-y-0.5 hover:bg-orange-400"
            >
              + New Game
            </button>

            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/55">
              {games.length} ongoing {games.length === 1 ? "game" : "games"}
            </div>
          </div>

        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-4 pb-10">
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_320px] 2xl:grid-cols-[290px_minmax(0,1fr)_330px]">
          <div className="rounded-[28px] border border-white/10 bg-[rgba(10,16,34,0.78)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-md">
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-black tracking-wide text-[#ff8a1c]">
                ONGOING GAMES
              </h2>

              <button
                className="text-sm font-semibold text-[#ff8a1c] hover:opacity-80"
                onClick={() => loadGames(false)}
                type="button"
              >
                Refresh
              </button>
            </div>

            <input
              className="mt-5 w-full rounded-full border border-white/10 bg-white px-4 py-3 text-[#111827] outline-none"
              placeholder="Search Game"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/80">
              {filteredGames.length === 0 ? (
                <div className="p-4 text-sm text-black/50">
                  No ongoing games.
                </div>
              ) : (
                <div className="divide-y divide-black/10">
                  {filteredGames.map((g) => {
                    const active = g.id === activeGameId;

                    return (
                      <button
                        key={g.id}
                        onClick={() => {
                          setActiveGameId(g.id);
                          clearToast(toastTimer, setToast);

                          if (piStatus.game_id === g.id) {
                            showToast(`${g.name} is already active on the Raspberry Pi ✅`);
                          } else {
                            setAssignmentPromptGame(g);
                          }
                        }}
                        type="button"
                        className={cx(
                          "w-full px-5 py-4 text-left font-semibold transition",
                          active
                            ? "bg-[#f1c48d] text-[#3a1e09]"
                            : "bg-white/90 text-black/75 hover:bg-[#fff1df]"
                        )}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span>
                            {g.name}
                            <span className="ml-2 text-sm font-normal text-black/35">
                              #{g.id}
                            </span>
                          </span>

                          {piStatus.game_id === g.id && (
                            <span className="shrink-0 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                              Pi Active
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[20px] border border-white/10 bg-[rgba(15,22,45,0.72)] p-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-md">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[18px] font-black tracking-wide text-[#ff8a1c]">
                BOARD
              </h2>

              <div className="flex gap-3">
                <button
                  className="rounded-full bg-[#b35f0f] px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(255,122,0,0.2)]"
                  onClick={() => setFlipped((v) => !v)}
                  type="button"
                >
                  Flip
                </button>

                <button
                  className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#7a430e]"
                  onClick={() => setShowTools((v) => !v)}
                  type="button"
                >
                  {showTools ? "Hide Tools" : "Show Tools"}
                </button>
              </div>
            </div>

            <p className="mt-3 text-sm text-white/55">
              Status: {activeGame ? "Viewing selected game" : "No active game"}
            </p>

            {activeGame && piStatus.game_id !== activeGame.id && (
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-4 py-3 text-sm text-yellow-100 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="font-black">Viewing only:</span>{" "}
                  {piStatus.game_id
                    ? `Raspberry Pi is assigned to Game #${piStatus.game_id}.`
                    : "No game is assigned to the Raspberry Pi."}
                </div>

                <button
                  type="button"
                  onClick={() => router.push(`/device?game_id=${activeGame.id}`)}
                  className="shrink-0 rounded-full bg-[#ff7a00] px-4 py-2 text-xs font-black text-black transition hover:bg-orange-400"
                >
                  Activate This Game
                </button>
              </div>
            )}

            {activeGame && piStatus.game_id === activeGame.id && (
              <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-200">
                This game is connected to the Raspberry Pi.
              </div>
            )}

            <div className="mt-1 flex justify-center">
              <BoardView board={board} flipped={flipped} />
            </div>

            <div className="mt-2 text-center text-sm font-semibold text-[#d8c39f]">
              Last move: {lastMove}
            </div>

            <div className="mt-2 flex justify-center">
              <button
                onClick={completeActiveGame}
                type="button"
                disabled={!activeGameId}
                className={cx(
                  "rounded-full bg-[#ff7a00] px-5 py-2 text-sm font-bold text-black shadow-[0_10px_30px_rgba(249,115,22,0.35)]",
                  !activeGameId && "cursor-not-allowed opacity-50"
                )}
              >
                Complete Game
              </button>
            </div>

            {showTools && (
              <div className="mt-6 grid gap-5">
                <div className="rounded-[22px] border border-white/10 bg-white/80 p-5 text-black">
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-black text-[#8d4b0e]">FEN</div>

                    <button
                      className="rounded-full bg-[#b35f0f] px-4 py-2 text-sm font-bold text-white"
                      onClick={async () =>
                        showToast(
                          (await copyToClipboard(fen))
                            ? "FEN copied ✅"
                            : "Copy failed"
                        )
                      }
                      type="button"
                    >
                      Copy
                    </button>
                  </div>

                  <input
                    value={fen}
                    readOnly
                    className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-black/70"
                  />
                </div>

                <div className="rounded-[22px] border border-white/10 bg-white/80 p-5 text-black">
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-black text-[#8d4b0e]">PGN</div>

                    <div className="flex gap-2">
                      <button
                        className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-bold text-[#8d4b0e]"
                        onClick={async () =>
                          showToast(
                            (await copyToClipboard(pgn))
                              ? "PGN copied ✅"
                              : "Copy failed"
                          )
                        }
                        type="button"
                      >
                        Copy
                      </button>

                      <button
                        className="rounded-full bg-[#b35f0f] px-4 py-2 text-sm font-bold text-white"
                        onClick={() =>
                          downloadTextFile(
                            `${(activeGame?.name ?? "game").replaceAll(
                              " ",
                              "_"
                            )}.pgn`,
                            pgn
                          )
                        }
                        type="button"
                      >
                        Download
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={pgn}
                    readOnly
                    className="mt-3 h-32 w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-black/70"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[rgba(15,22,45,0.72)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-md xl:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-black tracking-wide text-[#ff8a1c]">
                MOVE HISTORY
              </h2>

              <span className="text-lg font-bold text-white/45">
                {moves.length} moves
              </span>
            </div>

            <div className="mt-5 rounded-[22px] border border-white/10 bg-white/80 p-5 text-black">
              <div className="mb-4 text-lg">
                Active game:{" "}
                <span className="font-black text-[#8d4b0e]">
                  {activeGame?.name ?? "-"}
                </span>
              </div>

              <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
                <div className="grid grid-cols-[60px_1fr_1fr] border-b border-black/10 px-4 py-3 text-sm font-bold text-black/45">
                  <span>#</span>
                  <span className="text-center">White</span>
                  <span className="text-center">Black</span>
                </div>

                {moveRows.length === 0 ? (
                  <div className="p-5 text-black/50">No moves yet.</div>
                ) : (
                  moveRows.map((r) => (
                    <div
                      key={r.no}
                      className="grid grid-cols-[60px_1fr_1fr] px-4 py-3 text-lg odd:bg-[#f7f2ea]"
                    >
                      <span className="font-bold text-black/45">{r.no}.</span>

                      <span className="text-center font-black text-[#5f2f0b]">
                        {r.w}
                      </span>

                      <span className="text-center font-black text-[#5f2f0b]">
                        {r.b}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-6 rounded-2xl border border-black/10 bg-white px-5 py-4">
                <div className="text-lg font-black text-[#8d4b0e]">
                  Detection Status
                </div>

                <div className="mt-2 text-sm leading-6 text-black/60">
                  {piStatus.status}
                </div>

                <div
                  className={cx(
                    "mt-4 rounded-xl px-4 py-3 text-center text-sm font-black",
                    piStatus.can_move
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  )}
                >
                  {piStatus.can_move ? "YOU CAN MOVE NOW" : "WAIT"}
                </div>

                <div className="mt-2 text-xs text-black/50">
                  Last detected move: {piStatus.last_move}
                </div>

                <div className="mt-2 text-xs text-black/50">
                  Board locked: {piStatus.locked ? "YES" : "NO"}
                </div>

                <div className="mt-2 text-xs text-black/50">
                  Detection: {
                    piStatus.auto_enabled
                      ? "AUTO ON"
                      : piStatus.detection_enabled
                        ? "MANUAL ON"
                        : "PAUSED"
                  }
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={resetPiBoard}
                    type="button"
                    className="rounded-xl bg-yellow-100 px-3 py-2 text-xs font-black text-yellow-700"
                  >
                    Reset Pi Board
                  </button>

                  <button
                    onClick={syncPiBoard}
                    type="button"
                    className="rounded-xl bg-blue-100 px-3 py-2 text-xs font-black text-blue-700"
                  >
                    Sync Pi Moves
                  </button>

                  <button
                    onClick={pausePiDetection}
                    type="button"
                    className="rounded-xl bg-red-100 px-3 py-2 text-xs font-black text-red-700"
                  >
                    Pause Setup
                  </button>

                  <button
                    onClick={resumePiDetection}
                    type="button"
                    className="rounded-xl bg-green-100 px-3 py-2 text-xs font-black text-green-700"
                  >
                    Manual Detect
                  </button>

                  <button
                    onClick={() => setPiAutoDetection(true)}
                    type="button"
                    disabled={autoControlBusy || Boolean(piStatus.auto_enabled)}
                    className={cx(
                      "rounded-xl px-3 py-2 text-xs font-black transition",
                      piStatus.auto_enabled
                        ? "cursor-not-allowed bg-emerald-200 text-emerald-800 opacity-70"
                        : "bg-emerald-600 text-white hover:bg-emerald-700",
                      autoControlBusy && "cursor-wait opacity-60"
                    )}
                  >
                    {piStatus.auto_enabled ? "AUTO Running" : "Start AUTO"}
                  </button>

                  <button
                    onClick={() => setPiAutoDetection(false)}
                    type="button"
                    disabled={autoControlBusy || !piStatus.auto_enabled}
                    className={cx(
                      "rounded-xl px-3 py-2 text-xs font-black transition",
                      piStatus.auto_enabled
                        ? "bg-slate-800 text-white hover:bg-slate-900"
                        : "cursor-not-allowed bg-slate-200 text-slate-500 opacity-70",
                      autoControlBusy && "cursor-wait opacity-60"
                    )}
                  >
                    Stop AUTO
                  </button>
                </div>

                <p className="mt-3 text-xs leading-5 text-black/45">
                  AUTO runs on the Raspberry Pi. Starting AUTO pauses the two live previews in this browser to reduce laptop RAM and CPU usage.
                </p>
              </div>

            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-2 max-w-[1500px] px-4 pb-12">
        <div className="rounded-[28px] border border-white/10 bg-[rgba(15,22,45,0.72)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-md xl:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-black tracking-wide text-[#ff8a1c]">
                RASPBERRY PI CAMERA PREVIEW
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/55">
                Live camera and locked board preview are moved to the bottom for a wider side-by-side view.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={showPiPreview ? stopPiPreview : startPiPreview}
                className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15"
              >
                {showPiPreview ? "Hide Preview" : "Show Preview"}
              </button>

              <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white/60">
                RPi 5
              </span>
            </div>
          </div>

          {showPiPreview ? (
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/85 p-5 text-black">
                <div className="text-lg font-black text-[#8d4b0e]">
                  Live Camera
                </div>

                <p className="mt-2 text-sm leading-6 text-black/50">
                  Raspberry Pi Camera Module V3 original live view.
                </p>

                <div className="mt-4 overflow-hidden rounded-2xl border border-black/10 bg-black">
                  {cameraSrc ? (
                    <img
                      src={cameraSrc}
                      alt="Raspberry Pi Camera Module V3 Live Feed"
                      className="aspect-video w-full object-contain"
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center text-sm text-white/60">
                      Loading camera...
                    </div>
                  )}
                </div>

                <div className="mt-3 break-all rounded-xl bg-[#f7f2ea] px-4 py-3 text-xs text-black/60">
                  Source: {PI_STREAM_BASE}/video
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/85 p-5 text-black">
                <div className="text-lg font-black text-[#8d4b0e]">
                  Locked Warped Board + Grid
                </div>

                <p className="mt-2 text-sm leading-6 text-black/50">
                  This preview shows the detected board area used for move detection.
                </p>

                <div className="mt-4 overflow-hidden rounded-2xl border border-black/10 bg-black">
                  {boardPreviewSrc ? (
                    <img
                      src={boardPreviewSrc}
                      alt="Locked Warped Board + Grid"
                      className="aspect-video w-full object-contain"
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center text-sm text-white/60">
                      Loading board preview...
                    </div>
                  )}
                </div>

                <div className="mt-3 break-all rounded-xl bg-[#f7f2ea] px-4 py-3 text-xs text-black/60">
                  Source: {PI_STREAM_BASE}/board
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 px-6 py-10 text-center">
              <div className="text-lg font-black text-emerald-200">
                Camera preview is paused on this laptop
              </div>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-white/60">
                YOLOv8, frame processing and automatic move detection continue on the Raspberry Pi. Click Show Preview only when checking alignment.
              </p>
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute role="user">
      {/* REGISSION_DASHBOARD_PI_ACTIVE_AUTO_SELECT_V2 */}
      <DashboardPiActiveAutoSelect />
      {/* REGISSION_GAME_COMPLETION_POPUP_V1 */}
      <GameCompletionPopup />
      <DashboardPageContent />
    </ProtectedRoute>
  );
}
