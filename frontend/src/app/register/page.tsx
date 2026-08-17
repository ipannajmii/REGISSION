"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/auth-shell";
import { register, saveSession } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] =
    useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");

    if (password !== passwordConfirmation) {
      setError("The password confirmation does not match.");
      return;
    }

    if (!accepted) {
      setError(
        "Please confirm that you agree to use the system responsibly."
      );
      return;
    }

    setLoading(true);

    try {
      const result = await register({
        name,
        email,
        password,
        passwordConfirmation,
      });

      saveSession(
        {
          token: result.token,
          user: result.user,
        },
        true
      );

      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create the account."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell role="user">
      <div className="rounded-[28px] border border-white/10 bg-[#111827]/85 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#9aa5ff]">
          User Registration
        </p>

        <h2 className="mt-3 text-3xl font-extrabold tracking-tight">
          Create your account
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-white/55">
          Register to create games, monitor live moves, and
          review your chess history.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <div>
            <label className="text-sm font-medium text-white/75">
              Full name
            </label>

            <input
              type="text"
              required
              minLength={2}
              maxLength={255}
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your full name"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#5865F2] focus:ring-4 focus:ring-[#5865F2]/15"
            />
          </div>

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

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-white/75">
                Password
              </label>

              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimum 8 characters"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#5865F2] focus:ring-4 focus:ring-[#5865F2]/15"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-white/75">
                Confirm password
              </label>

              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={(event) =>
                  setPasswordConfirmation(event.target.value)
                }
                placeholder="Repeat password"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#5865F2] focus:ring-4 focus:ring-[#5865F2]/15"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-3 text-sm text-white/60">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) =>
                setShowPassword(event.target.checked)
              }
              className="h-4 w-4 accent-[#5865F2]"
            />
            Show passwords
          </label>

          <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-white/55">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-1 h-4 w-4 accent-[#5865F2]"
            />
            <span>
              I agree to use REGISSION responsibly and keep my
              login credentials secure.
            </span>
          </label>

          {error && (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[#5865F2] px-5 py-3.5 text-sm font-bold text-white shadow-[0_14px_36px_rgba(88,101,242,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/50">
          Already registered?{" "}
          <Link
            href="/login"
            className="font-semibold text-orange-400 hover:text-orange-300"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}