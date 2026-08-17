"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "/api/proxy/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/forgot-password`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        }
      );

      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.message ??
            "Unable to send the password reset link."
        );
      }

      setMessage(
        payload?.message ??
          "Password reset link sent. Check your email."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to send the password reset link."
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#081221] px-4 py-10 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1fr_460px]">
        <section>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#9aa5ff]">
            REGISSION ACCOUNT RECOVERY
          </p>

          <h1 className="mt-5 max-w-2xl text-5xl font-black leading-tight md:text-6xl">
            Recover access to your chess dashboard.
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-8 text-white/60">
            Enter the email address linked to your REGISSION account.
            A secure password reset link will be sent to your inbox.
          </p>

          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
            {[
              "Secure token",
              "Time-limited link",
              "Password reset",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold text-white/70"
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-[#111b2d]/95 p-7 shadow-2xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9aa5ff]">
            USER PORTAL
          </p>

          <h2 className="mt-3 text-3xl font-black">
            Reset your password
          </h2>

          <p className="mt-2 text-sm leading-6 text-white/50">
            Enter your registered email address.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-5">
            <div>
              <label
                htmlFor="email"
                className="text-sm font-semibold text-white/75"
              >
                Email address
              </label>

              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="name@example.com"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-white outline-none transition placeholder:text-white/25 focus:border-[#7781ff]"
              />
            </div>

            {message && (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {message}
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={working}
              className="w-full rounded-2xl bg-[#5865F2] px-5 py-3.5 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {working ? "Sending..." : "Send reset link"}
            </button>

            <p className="text-center text-sm text-white/45">
              Remembered your password?{" "}
              <Link
                href="/login"
                className="font-bold text-[#9aa5ff] hover:text-white"
              >
                Back to sign in
              </Link>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}