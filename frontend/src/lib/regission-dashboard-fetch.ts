"use client";

function extractToken(raw: string | null): string | null {
  if (!raw?.trim()) {
    return null;
  }

  const value = raw.trim();

  try {
    const parsed = JSON.parse(value) as unknown;

    if (typeof parsed === "string" && parsed.trim()) {
      return parsed.trim();
    }

    if (parsed && typeof parsed === "object") {
      const object = parsed as Record<string, unknown>;

      for (const key of [
        "token",
        "access_token",
        "accessToken",
        "auth_token",
      ]) {
        const candidate = object[key];

        if (typeof candidate === "string" && candidate.trim()) {
          return candidate.trim();
        }
      }
    }
  } catch {
    // Plain Sanctum tokens are not JSON.
  }

  return value;
}

function browserToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const preferredKeys = [
    "regission_token",
    "auth_token",
    "access_token",
    "token",
    "regission-auth-token",
    "regissionAuthToken",
  ];

  for (const storage of [
    window.localStorage,
    window.sessionStorage,
  ]) {
    for (const key of preferredKeys) {
      const token = extractToken(storage.getItem(key));

      if (token) {
        return token;
      }
    }

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);

      if (!key || !key.toLowerCase().includes("token")) {
        continue;
      }

      const token = extractToken(storage.getItem(key));

      if (token) {
        return token;
      }
    }
  }

  return null;
}

export async function regissionDashboardFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const inherited =
    input instanceof Request ? input.headers : undefined;

  const headers = new Headers(inherited);

  if (init.headers) {
    new Headers(init.headers).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  const token = browserToken();

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  return window.fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? "include",
    cache: init.cache ?? "no-store",
  });
}
