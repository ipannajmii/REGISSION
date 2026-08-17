"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/auth-shell";
import {
  clearSession,
  getStoredSession,
  login,
  saveSession,
} from "@/lib/auth";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(
    "admin@regission.local"
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const session = getStoredSession("admin");

    if (session?.user.role === "admin") {
      router.replace("/admin/dashboard");
      return;
    }
  }, [router]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await login({
        email,
        password,
        expectedRole: "admin",
      });

      saveSession(
        {
          token: result.token,
          user: result.user,
        },
        true
      );

      router.replace("/admin/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to log in."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell role="admin">
      <div className="rounded-[28px] border border-orange-400/15 bg-[#111827]/85 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)] backdrop-blur-xl md:p-8">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-400">
              Administrator Portal
            </p>

            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">
              Secure access
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-white/55">
              Authorised REGISSION administrators only.
            </p>
          </div>

          <span className="rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-[11px] font-bold text-orange-300">
            ADMIN
          </span>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="text-sm font-medium text-white/75">
              Administrator email
            </label>

            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@regission.local"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-orange-400 focus:ring-4 focus:ring-orange-400/10"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-white/75">
              Password
            </label>

            <div className="relative mt-2">
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter administrator password"
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 pr-20 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-orange-400 focus:ring-4 focus:ring-orange-400/10"
              />

              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-white/45 hover:text-white"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-orange-500 px-5 py-3.5 text-sm font-bold text-[#160b00] shadow-[0_14px_36px_rgba(249,115,22,0.3)] transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Verifying administrator..."
              : "Access admin dashboard"}
          </button>
        </form>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs font-semibold text-white/75">
            Security notice
          </p>
          <p className="mt-2 text-xs leading-relaxed text-white/40">
            Access attempts are protected by Laravel Sanctum.
            Administrator credentials must not be shared.
          </p>
        </div>
      </div>
    </AuthShell>
  );
}