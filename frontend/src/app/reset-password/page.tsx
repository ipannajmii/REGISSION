"use client";

import Link from "next/link";
import {
  FormEvent,
  Suspense,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "/api/proxy/api";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get("token") ?? "";
  const initialEmail = searchParams.get("email") ?? "";

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError("");
    setMessage("");

    if (!token) {
      setError(
        "The password reset link is invalid or incomplete."
      );
      setWorking(false);
      return;
    }

    if (password !== confirmation) {
      setError(
        "The password confirmation does not match."
      );
      setWorking(false);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/reset-password`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token,
            email,
            password,
            password_confirmation: confirmation,
          }),
        }
      );

      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.message ??
            "Unable to reset the password."
        );
      }

      setMessage(
        payload?.message ??
          "Password reset successfully. Redirecting..."
      );

      window.setTimeout(() => {
        router.replace("/login");
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to reset the password."
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
            REGISSION ACCOUNT SECURITY
          </p>

          <h1 className="mt-5 max-w-2xl text-5xl font-black leading-tight md:text-6xl">
            Create a new secure password.
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-8 text-white/60">
            Your new password must contain at least eight characters,
            including letters and numbers.
          </p>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-[#111b2d]/95 p-7 shadow-2xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9aa5ff]">
            USER PORTAL
          </p>

          <h2 className="mt-3 text-3xl font-black">
            New password
          </h2>

          <p className="mt-2 text-sm leading-6 text-white/50">
            Complete the form to recover your account.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
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
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-white outline-none focus:border-[#7781ff]"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="text-sm font-semibold text-white/75"
              >
                New password
              </label>

              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-white outline-none focus:border-[#7781ff]"
              />
            </div>

            <div>
              <label
                htmlFor="confirmation"
                className="text-sm font-semibold text-white/75"
              >
                Confirm new password
              </label>

              <input
                id="confirmation"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) =>
                  setConfirmation(event.target.value)
                }
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-white outline-none focus:border-[#7781ff]"
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
              {working ? "Resetting..." : "Reset password"}
            </button>

            <p className="text-center text-sm text-white/45">
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#081221]" />
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}