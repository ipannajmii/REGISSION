"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/auth-shell";
import {
  clearSession,
  getStoredSession,
  login,
  saveSession,
} from "@/lib/auth";

export default function UserLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const session = getStoredSession("user");

    if (session?.user.role === "user") {
      router.replace("/");
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
        expectedRole: "user",
      });

      saveSession(
        {
          token: result.token,
          user: result.user,
        },
        remember
      );

      router.replace("/");
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
    <AuthShell role="user">
      <div className="rounded-[28px] border border-white/10 bg-[#111827]/80 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#9aa5ff]">
          User Portal
        </p>

        <h2 className="mt-3 text-3xl font-extrabold tracking-tight">
          Welcome back
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-white/55">
          Sign in to continue to your REGISSION dashboard.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="text-sm font-medium text-white/75">
              Email address
            </label>

            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#5865F2] focus:ring-4 focus:ring-[#5865F2]/15"
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
                placeholder="Enter your password"
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 pr-20 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#5865F2] focus:ring-4 focus:ring-[#5865F2]/15"
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

          <label className="flex cursor-pointer items-center gap-3 text-sm text-white/60">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-black/30 accent-[#5865F2]"
            />
            Keep me signed in
          </label>

          {error && (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-[#9aa5ff] transition hover:text-white"
          >
            Forgot password?
          </Link>
        </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[#5865F2] px-5 py-3.5 text-sm font-bold text-white shadow-[0_14px_36px_rgba(88,101,242,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in to dashboard"}
          </button>
        </form>

        <div className="my-7 h-px bg-white/10" />

        <p className="text-center text-sm text-white/50">
          New to REGISSION?{" "}
          <Link
            href="/register"
            className="font-semibold text-orange-400 hover:text-orange-300"
          >
            Create an account
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}