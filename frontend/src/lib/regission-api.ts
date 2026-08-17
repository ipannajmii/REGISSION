import { API_BASE } from "@/lib/regission-config";

export type ApiGame = {
  id: number;
  name: string;
  status: string;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ApiMove = {
  id: number;
  game_id: number;
  notation: string;
  created_at?: string;
  updated_at?: string;
};

export type PiStatus = {
  status: string;
  can_move: boolean;
  last_move: string;
  game_id?: number;
  board_locked?: boolean;
  changed_squares?: string[];
  motion?: number;
};

export async function apiFetch<T>(
  path: string,
  opts: { method?: string; token?: string; body?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (opts.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  }

  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  if (!response.ok) {
    const payload = isJson
      ? await response.json().catch(() => ({}))
      : await response.text().catch(() => "");

    const message =
      typeof payload === "string"
        ? payload
        : payload?.message || payload?.error || `Request failed (${response.status})`;

    throw new Error(message);
  }

  if (!isJson) {
    const text = await response.text().catch(() => "");
    throw new Error(`Expected JSON response, got: ${text.slice(0, 200)}...`);
  }

  return response.json() as Promise<T>;
}