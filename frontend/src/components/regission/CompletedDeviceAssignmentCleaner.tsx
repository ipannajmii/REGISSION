"use client";

import { useEffect, useRef } from "react";

type JsonRecord = Record<string, unknown>;

const REGISSION_COMPLETED_DEVICE_ASSIGNMENT_CLEANER_V1 = true;
const ACTIVE_GAME_KEY = "regission_device_active_game_id";
const CLEARING_KEY = "regission_completed_assignment_clearing";

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

  return ["1", "true", "yes", "completed", "finished"].includes(
    asString(value).toLowerCase(),
  );
}

function findToken(value: unknown): string {
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
      return findToken(JSON.parse(trimmed));
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
    const token = findToken(record[key]);

    if (token !== "") {
      return token;
    }
  }

  return "";
}

function authHeaders(): HeadersInit {
  if (typeof window === "undefined") {
    return {
      Accept: "application/json",
    };
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

  let token = "";

  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (const key of preferredKeys) {
      const value = storage.getItem(key);

      if (!value) {
        continue;
      }

      token = findToken(value);

      if (token !== "") {
        break;
      }
    }

    if (token !== "") {
      break;
    }

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);

      if (!key || !/token|auth|session/i.test(key)) {
        continue;
      }

      const value = storage.getItem(key);

      if (!value) {
        continue;
      }

      token = findToken(value);

      if (token !== "") {
        break;
      }
    }

    if (token !== "") {
      break;
    }
  }

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

  for (const key of ["data", "game", "item", "active_game"]) {
    const nested = root[key];

    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return nested as JsonRecord;
    }
  }

  return root;
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

function isCompleted(game: JsonRecord): boolean {
  const status = firstString(game, [
    "status",
    "game_status",
    "state",
  ]).toLowerCase();

  const result = firstString(game, [
    "result",
    "outcome",
  ]);

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
    (
      result !== "" &&
      result !== "-" &&
      result !== "*"
    )
  );
}

async function fetchJson(
  url: string,
): Promise<unknown> {
  const response = await fetch(
    `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`,
    {
      method: "GET",
      cache: "no-store",
      headers: authHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function findActiveGame(): Promise<JsonRecord | null> {
  const payload = await fetchJson(
    "/api/proxy/api/device/active-game",
  );

  const root = asRecord(payload);
  const game = unwrapGame(payload);

  const gameId =
    firstNumber(game, ["id", "game_id", "active_game_id"]) ??
    firstNumber(root, ["game_id", "active_game_id"]);

  if (gameId === null) {
    window.sessionStorage.removeItem(ACTIVE_GAME_KEY);
    return null;
  }

  window.sessionStorage.setItem(
    ACTIVE_GAME_KEY,
    String(gameId),
  );

  if (
    Object.keys(game).length > 1 &&
    (
      game.status !== undefined ||
      game.completed_at !== undefined ||
      game.result !== undefined
    )
  ) {
    return {
      ...game,
      id: gameId,
    };
  }

  const detail = unwrapGame(
    await fetchJson(
      `/api/proxy/api/games/${gameId}`,
    ),
  );

  return {
    ...detail,
    id: gameId,
  };
}

async function clearAssignment(): Promise<boolean> {
  const response = await fetch(
    "/api/proxy/api/device/active-game",
    {
      method: "DELETE",
      cache: "no-store",
      headers: authHeaders(),
    },
  );

  return response.ok || response.status === 404;
}

function clickExistingClearButton(): boolean {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button"),
  );

  const button = buttons.find((item) => {
    return item.textContent
      ?.replace(/\s+/g, " ")
      .trim()
      .toLowerCase() === "clear assignment";
  });

  if (!button) {
    return false;
  }

  button.click();
  return true;
}

export default function CompletedDeviceAssignmentCleaner() {
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const check = async (): Promise<void> => {
      if (busyRef.current || cancelled) {
        return;
      }

      busyRef.current = true;

      try {
        const game = await findActiveGame();

        if (!game || !isCompleted(game) || cancelled) {
          return;
        }

        const gameId = firstNumber(game, ["id", "game_id"]);

        if (gameId === null) {
          return;
        }

        const clearingSignature = String(gameId);

        if (
          window.sessionStorage.getItem(CLEARING_KEY) ===
          clearingSignature
        ) {
          return;
        }

        window.sessionStorage.setItem(
          CLEARING_KEY,
          clearingSignature,
        );

        let cleared = false;

        try {
          cleared = await clearAssignment();
        } catch {
          cleared = false;
        }

        if (!cleared) {
          cleared = clickExistingClearButton();
        }

        if (cleared && !cancelled) {
          window.sessionStorage.removeItem(ACTIVE_GAME_KEY);

          window.setTimeout(() => {
            window.location.replace("/device?completed_game_cleared=1");
          }, 500);
        } else {
          window.sessionStorage.removeItem(CLEARING_KEY);
        }
      } catch {
        // Keep the existing device page working during a temporary API error.
      } finally {
        busyRef.current = false;
      }
    };

    void check();

    const timer = window.setInterval(() => {
      void check();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
