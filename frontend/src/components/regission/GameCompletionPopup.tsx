"use client";

import { useEffect, useRef, useState } from "react";

type JsonRecord = Record<string, unknown>;

type CompletionPopup = {
  gameId: number;
  gameName: string;
  kind: "checkmate" | "draw" | "completed";
  title: string;
  message: string;
  result: string;
  reason: string;
  signature: string;
};

const REGISSION_GAME_COMPLETION_POPUP_V1 = true;
const ACTIVE_GAME_STORAGE_KEY = "regission_last_active_game_id";
const POPUP_STORAGE_PREFIX = "regission_game_end_popup_";

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object"
    ? (value as JsonRecord)
    : {};
}

function asString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function asNumber(value: unknown): number | null {
  const number = Number(value);

  return Number.isFinite(number) && number > 0
    ? Math.trunc(number)
    : null;
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  const text = asString(value).toLowerCase();

  return ["1", "true", "yes", "completed", "finished"].includes(text);
}

function firstString(
  record: JsonRecord,
  keys: string[],
): string {
  for (const key of keys) {
    const value = asString(record[key]);

    if (value !== "") {
      return value;
    }
  }

  return "";
}

function firstNumber(
  record: JsonRecord,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = asNumber(record[key]);

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function findTokenInValue(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/^"|"$/g, "");

    if (
      trimmed.length >= 20 &&
      !trimmed.includes(" ") &&
      !trimmed.startsWith("{") &&
      !trimmed.startsWith("[")
    ) {
      return trimmed;
    }

    try {
      return findTokenInValue(JSON.parse(trimmed));
    } catch {
      return "";
    }
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as JsonRecord;

  for (const key of [
    "token",
    "access_token",
    "accessToken",
    "auth_token",
    "authToken",
    "bearer",
  ]) {
    const candidate = findTokenInValue(record[key]);

    if (candidate !== "") {
      return candidate;
    }
  }

  return "";
}

function getAuthToken(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const preferredKeys = [
    "regission_token",
    "auth_token",
    "access_token",
    "token",
    "regission-auth-token",
    "regissionAuthToken",
    "auth",
    "user",
  ];

  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (const key of preferredKeys) {
      const value = storage.getItem(key);

      if (value) {
        const token = findTokenInValue(value);

        if (token !== "") {
          return token;
        }
      }
    }

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);

      if (!key || !/token|auth|session/i.test(key)) {
        continue;
      }

      const value = storage.getItem(key);

      if (value) {
        const token = findTokenInValue(value);

        if (token !== "") {
          return token;
        }
      }
    }
  }

  return "";
}

function authHeaders(): HeadersInit {
  const token = getAuthToken();

  return {
    Accept: "application/json",
    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),
  };
}

function unwrapGame(payload: unknown): JsonRecord {
  const root = asRecord(payload);

  for (const key of ["data", "game", "item"]) {
    const nested = root[key];

    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return nested as JsonRecord;
    }
  }

  return root;
}

function unwrapMoves(payload: unknown): JsonRecord[] {
  if (Array.isArray(payload)) {
    return payload.map(asRecord);
  }

  const root = asRecord(payload);

  for (const key of ["data", "moves", "items"]) {
    const nested = root[key];

    if (Array.isArray(nested)) {
      return nested.map(asRecord);
    }
  }

  return [];
}

function moveOrder(move: JsonRecord): number {
  return (
    firstNumber(move, ["ply_before", "ply", "move_number", "id"]) ??
    0
  );
}

function moveSan(move: JsonRecord): string {
  return firstString(move, [
    "san",
    "notation",
    "move",
    "chess_notation",
    "uci",
  ]);
}

function winnerFromResult(
  result: string,
  game: JsonRecord,
): string {
  const winner = firstString(game, [
    "winner",
    "winner_color",
    "winner_side",
  ]).toLowerCase();

  if (winner === "white") {
    return "White";
  }

  if (winner === "black") {
    return "Black";
  }

  if (result === "1-0") {
    return "White";
  }

  if (result === "0-1") {
    return "Black";
  }

  return "";
}

function drawReason(termination: string): string {
  const normalized = termination.toLowerCase();

  if (normalized.includes("stalemate")) {
    return "Stalemate";
  }

  if (
    normalized.includes("insufficient") ||
    normalized.includes("material")
  ) {
    return "Insufficient material";
  }

  if (
    normalized.includes("fivefold") ||
    normalized.includes("repetition")
  ) {
    return "Repetition";
  }

  if (
    normalized.includes("75") ||
    normalized.includes("seventy-five")
  ) {
    return "75-move rule";
  }

  if (
    normalized.includes("50") ||
    normalized.includes("fifty")
  ) {
    return "50-move rule";
  }

  if (normalized.includes("agreement")) {
    return "Draw by agreement";
  }

  return "Draw";
}

function completionStatus(game: JsonRecord): boolean {
  const status = firstString(game, [
    "status",
    "game_status",
    "state",
  ]).toLowerCase();

  const result = firstString(game, ["result", "outcome"]);

  return (
    ["completed", "complete", "finished", "ended"].includes(status) ||
    asBoolean(game.completed) ||
    asBoolean(game.is_completed) ||
    asBoolean(game.finished) ||
    asBoolean(game.is_finished) ||
    firstString(game, [
      "completed_at",
      "finished_at",
      "ended_at",
    ]) !== "" ||
    (result !== "" && result !== "-" && result !== "*")
  );
}

function buildPopup(
  gameId: number,
  game: JsonRecord,
  latestSan: string,
): CompletionPopup | null {
  if (!completionStatus(game)) {
    return null;
  }

  const gameName =
    firstString(game, ["name", "title", "game_name"]) ||
    `Game ${gameId}`;

  const result = firstString(game, [
    "result",
    "outcome",
  ]);

  const termination = firstString(game, [
    "termination",
    "end_reason",
    "result_reason",
    "reason",
  ]);

  const completedAt = firstString(game, [
    "completed_at",
    "finished_at",
    "ended_at",
    "updated_at",
  ]);

  const normalizedTermination = termination.toLowerCase();
  const isCheckmate =
    normalizedTermination.includes("checkmate") ||
    latestSan.endsWith("#") ||
    asBoolean(game.checkmate) ||
    asBoolean(game.is_checkmate);

  const isDraw =
    result === "1/2-1/2" ||
    normalizedTermination.includes("draw") ||
    normalizedTermination.includes("stalemate") ||
    normalizedTermination.includes("insufficient") ||
    normalizedTermination.includes("repetition") ||
    normalizedTermination.includes("fivefold") ||
    normalizedTermination.includes("75-move") ||
    normalizedTermination.includes("fifty");

  let kind: CompletionPopup["kind"] = "completed";
  let title = "Game Completed";
  let message = `${gameName} has been completed.`;
  let reason = termination || "Completed";

  if (isCheckmate) {
    const winner = winnerFromResult(result, game);

    kind = "checkmate";
    title = "Checkmate!";
    reason = "Checkmate";
    message = winner
      ? `${winner} wins by checkmate.`
      : `${gameName} ended by checkmate.`;
  } else if (isDraw) {
    kind = "draw";
    title = "Game Drawn";
    reason = drawReason(termination);
    message = `${gameName} ended in a draw — ${reason}.`;
  } else {
    const winner = winnerFromResult(result, game);

    if (winner) {
      message = `${winner} wins. The game is complete.`;
    }
  }

  const signature = [
    gameId,
    completedAt,
    result,
    termination,
    latestSan,
  ].join("|");

  return {
    gameId,
    gameName,
    kind,
    title,
    message,
    result: result || "-",
    reason,
    signature,
  };
}

async function fetchJson(
  url: string,
  authenticated = false,
): Promise<unknown> {
  const response = await fetch(
    `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`,
    {
      method: "GET",
      cache: "no-store",
      headers: authenticated
        ? authHeaders()
        : {
            Accept: "application/json",
          },
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function findTrackedGameId(): Promise<number | null> {
  try {
    const piPayload = asRecord(
      await fetchJson("/api/pi/status"),
    );

    const activeId = firstNumber(piPayload, [
      "active_game_id",
      "activeGameId",
      "game_id",
    ]);

    if (activeId !== null) {
      window.sessionStorage.setItem(
        ACTIVE_GAME_STORAGE_KEY,
        String(activeId),
      );

      return activeId;
    }
  } catch {
    // Keep using the last active game when the Pi briefly disconnects.
  }

  return asNumber(
    window.sessionStorage.getItem(ACTIVE_GAME_STORAGE_KEY),
  );
}

async function fetchLatestMove(
  gameId: number,
): Promise<string> {
  try {
    const payload = await fetchJson(
      `/api/proxy/api/games/${gameId}/moves`,
      true,
    );

    const moves = unwrapMoves(payload).sort(
      (left, right) => moveOrder(left) - moveOrder(right),
    );

    const latest = moves.at(-1);

    return latest ? moveSan(latest) : "";
  } catch {
    return "";
  }
}

export default function GameCompletionPopup() {
  const [popup, setPopup] = useState<CompletionPopup | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const poll = async (): Promise<void> => {
      if (busyRef.current || cancelled) {
        return;
      }

      busyRef.current = true;

      try {
        const gameId = await findTrackedGameId();

        if (gameId === null) {
          return;
        }

        const gamePayload = await fetchJson(
          `/api/proxy/api/games/${gameId}`,
          true,
        );

        const game = unwrapGame(gamePayload);
        const latestSan = await fetchLatestMove(gameId);
        const nextPopup = buildPopup(gameId, game, latestSan);

        if (!nextPopup || cancelled) {
          return;
        }

        const storageKey =
          POPUP_STORAGE_PREFIX + encodeURIComponent(nextPopup.signature);

        if (window.sessionStorage.getItem(storageKey) === "shown") {
          return;
        }

        window.sessionStorage.setItem(storageKey, "shown");
        setPopup(nextPopup);
      } catch {
        // The existing dashboard continues working if a polling request fails.
      } finally {
        busyRef.current = false;
      }
    };

    void poll();

    const timer = window.setInterval(() => {
      void poll();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (!popup) {
    return null;
  }

  const icon =
    popup.kind === "checkmate"
      ? "♛"
      : popup.kind === "draw"
        ? "½"
        : "✓";

  const accent =
    popup.kind === "checkmate"
      ? "#ff7a00"
      : popup.kind === "draw"
        ? "#e7bd52"
        : "#35d79a";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="regission-game-end-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "rgba(3, 8, 24, 0.82)",
        backdropFilter: "blur(8px)",
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          setPopup(null);
        }
      }}
    >
      <section
        style={{
          width: "min(520px, 100%)",
          borderRadius: "24px",
          overflow: "hidden",
          color: "#f8fafc",
          background:
            "linear-gradient(145deg, #111a31 0%, #0a1022 100%)",
          border: `1px solid ${accent}66`,
          boxShadow: `0 24px 90px ${accent}35`,
        }}
      >
        <div
          style={{
            height: "7px",
            background: accent,
          }}
        />

        <div
          style={{
            padding: "30px",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: "76px",
              height: "76px",
              display: "grid",
              placeItems: "center",
              margin: "0 auto 18px",
              borderRadius: "999px",
              fontSize: "42px",
              fontWeight: 900,
              color: "#08101f",
              background: accent,
              boxShadow: `0 12px 35px ${accent}55`,
            }}
          >
            {icon}
          </div>

          <p
            style={{
              margin: "0 0 8px",
              textAlign: "center",
              color: accent,
              fontSize: "13px",
              fontWeight: 900,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            REGISSION game result
          </p>

          <h2
            id="regission-game-end-title"
            style={{
              margin: "0",
              textAlign: "center",
              fontSize: "34px",
              lineHeight: 1.1,
            }}
          >
            {popup.title}
          </h2>

          <p
            style={{
              margin: "14px 0 22px",
              textAlign: "center",
              color: "#cbd5e1",
              fontSize: "17px",
              lineHeight: 1.6,
            }}
          >
            {popup.message}
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                padding: "14px",
                borderRadius: "14px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.09em",
                }}
              >
                Result
              </div>

              <strong
                style={{
                  display: "block",
                  marginTop: "5px",
                  fontSize: "18px",
                }}
              >
                {popup.result}
              </strong>
            </div>

            <div
              style={{
                padding: "14px",
                borderRadius: "14px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.09em",
                }}
              >
                Reason
              </div>

              <strong
                style={{
                  display: "block",
                  marginTop: "5px",
                  fontSize: "18px",
                }}
              >
                {popup.reason}
              </strong>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <button
              type="button"
              onClick={() => setPopup(null)}
              style={{
                minHeight: "48px",
                borderRadius: "13px",
                border: "1px solid rgba(255,255,255,0.16)",
                color: "#f8fafc",
                background: "rgba(255,255,255,0.07)",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Close
            </button>

            <button
              type="button"
              onClick={() => {
                window.location.href =
                  `/dashboard/analysis/${popup.gameId}`;
              }}
              style={{
                minHeight: "48px",
                borderRadius: "13px",
                border: "none",
                color: "#07101f",
                background: accent,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              View Analysis
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
