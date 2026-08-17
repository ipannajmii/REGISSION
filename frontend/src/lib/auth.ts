export type AuthRole = "user" | "admin";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: AuthRole;
  avatar_path?: string | null;
  avatar_url?: string | null;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

type LoginPayload = {
  email: string;
  password: string;
  expectedRole: AuthRole;
};

type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
};

type AuthResponse = {
  message: string;
  token: string;
  user: AuthUser;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "/api/proxy/api";

const KEYS = {
  user: {
    token: "regission_user_token",
    profile: "regission_user_profile",
  },
  admin: {
    token: "regission_admin_token",
    profile: "regission_admin_profile",
  },
} as const;

function extractError(payload: unknown, fallback: string): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "message" in payload &&
    typeof (payload as { message?: unknown }).message === "string"
  ) {
    return (payload as { message: string }).message;
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "errors" in payload
  ) {
    const errors = (payload as {
      errors?: Record<string, string[]>;
    }).errors;

    const first = errors
      ? Object.values(errors).flat().find(Boolean)
      : undefined;

    if (first) return first;
  }

  return fallback;
}

async function authRequest(
  path: string,
  init: RequestInit
): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      extractError(payload, `Request failed (${response.status}).`)
    );
  }

  return payload as AuthResponse;
}

export async function login(
  payload: LoginPayload
): Promise<AuthResponse> {
  return authRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      expected_role: payload.expectedRole ?? "user",
    }),
  });
}

export async function register(
  payload: RegisterPayload
): Promise<AuthResponse> {
  return authRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      password_confirmation: payload.passwordConfirmation,
    }),
  });
}

function readFromStorage(key: string): string | null {
  if (typeof window === "undefined") return null;

  return (
    window.localStorage.getItem(key) ??
    window.sessionStorage.getItem(key)
  );
}


function notifyAuthChange(): void {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new Event("regission-auth-change"));
}
function removeFromBoth(key: string): void {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(key);
  window.sessionStorage.removeItem(key);
}

export function saveSession(
  session: AuthSession,
  remember = true
): void {
  if (typeof window === "undefined") return;

  const role = session.user.role;
  clearSession(role);

  const storage = remember
    ? window.localStorage
    : window.sessionStorage;

  storage.setItem(KEYS[role].token, session.token);
  storage.setItem(
    KEYS[role].profile,
    JSON.stringify(session.user)
  );

  // Backward compatibility for the existing chess board and history pages.
  // These legacy keys always represent the NORMAL USER only.
  if (role === "user") {
    removeFromBoth("regission_token");
    removeFromBoth("regission_user");
    storage.setItem("regission_token", session.token);
    storage.setItem(
      "regission_user",
      JSON.stringify(session.user)
    );
  }

  notifyAuthChange();
}

export function getStoredToken(
  role: AuthRole = "user"
): string {
  if (typeof window === "undefined") return "";

  const roleToken = readFromStorage(KEYS[role].token);

  if (roleToken) return roleToken;

  // Migrate an older normal-user session automatically.
  if (role === "user") {
    return readFromStorage("regission_token") ?? "";
  }

  return "";
}

export function getStoredUser(
  role: AuthRole = "user"
): AuthUser | null {
  if (typeof window === "undefined") return null;

  const raw =
    readFromStorage(KEYS[role].profile) ??
    (role === "user"
      ? readFromStorage("regission_user")
      : null);

  if (!raw) return null;

  try {
    const user = JSON.parse(raw) as AuthUser;

    if (
      typeof user.id !== "number" ||
      typeof user.name !== "string" ||
      typeof user.email !== "string" ||
      (user.role !== "user" && user.role !== "admin") ||
      user.role !== role
    ) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

export function getStoredSession(
  role: AuthRole = "user"
): AuthSession | null {
  const token = getStoredToken(role);
  const user = getStoredUser(role);

  if (!token || !user) return null;

  return { token, user };
}

export function clearSession(role?: AuthRole): void {
  if (typeof window === "undefined") return;

  const roles: AuthRole[] = role
    ? [role]
    : ["user", "admin"];

  for (const currentRole of roles) {
    removeFromBoth(KEYS[currentRole].token);
    removeFromBoth(KEYS[currentRole].profile);

    if (currentRole === "user") {
      removeFromBoth("regission_token");
      removeFromBoth("regission_user");
    }
  }

  notifyAuthChange();
}

export async function logout(
  role: AuthRole = "user"
): Promise<void> {
  const token = getStoredToken(role);

  try {
    if (token) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
    }
  } finally {
    clearSession(role);
  }
}

export async function validateSession(
  role: AuthRole = "user"
): Promise<AuthUser> {
  const token = getStoredToken(role);

  if (!token) {
    throw new Error("Authentication is required.");
  }

  const response = await fetch(`${API_BASE}/auth/user`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    clearSession(role);
    throw new Error(
      extractError(payload, "Your session has expired.")
    );
  }

  const user = (payload as { user: AuthUser }).user;

  if (user.role !== role) {
    clearSession(role);
    throw new Error(
      role === "admin"
        ? "Administrator access is required."
        : "A normal user account is required."
    );
  }

  const remember =
    window.localStorage.getItem(KEYS[role].token) !== null ||
    (role === "user" &&
      window.localStorage.getItem("regission_token") !== null);

  saveSession({ token, user }, remember);

  return user;
}