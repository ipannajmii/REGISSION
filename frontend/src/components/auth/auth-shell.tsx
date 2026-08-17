"use client";

import Image from "next/image";
import Link from "next/link";
import { FoxEye } from "@/components/fox-eye";

type AuthShellProps = {
  role: "user" | "admin";
  children: React.ReactNode;
};

export default function AuthShell({ role, children }: AuthShellProps) {
  const isAdmin = role === "admin";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b1220] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[#0b1220]" />
        <div className="absolute inset-0 opacity-[0.10] [background-image:radial-gradient(rgba(255,255,255,0.85)_1px,transparent_1px)] [background-size:18px_18px]" />
        <div className="absolute -top-40 left-1/4 h-[560px] w-[560px] rounded-full bg-[#5865F2]/20 blur-3xl" />
        <div className="absolute top-24 -right-36 h-[460px] w-[460px] rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute -bottom-56 left-10 h-[560px] w-[560px] rounded-full bg-orange-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-5 py-5 md:px-8">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Regission Logo"
              width={58}
              height={58}
              className="object-contain drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]"
            />
            <div>
              <p className="text-base font-extrabold tracking-wide">REGISSION</p>
              <p className="text-xs text-white/55">Vision {"\u2022"} Strategy {"\u2022"} IoT</p>
            </div>
          </Link>

          <Link
            href={isAdmin ? "/login" : "/admin/login"}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/75 backdrop-blur transition hover:border-orange-400/40 hover:text-white"
          >
            {isAdmin ? "User Login" : "Admin Login"}
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="hidden lg:block">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">
                <span className={`h-2 w-2 rounded-full ${isAdmin ? "bg-orange-400" : "bg-emerald-400"}`} />
                {isAdmin ? "Restricted administrator access" : "Secure user access"}
              </span>

              <h1 className="mt-6 text-5xl font-black leading-[1.05] tracking-tight xl:text-7xl">
                {isAdmin ? (
                  <>
                    Control the system.
                    <span className="block text-orange-400">Protect every game.</span>
                  </>
                ) : (
                  <>
                    Enter the board.
                    <span className="block text-[#9aa5ff]">Track every move.</span>
                  </>
                )}
              </h1>

              <p className="mt-6 max-w-xl text-base leading-relaxed text-white/65 xl:text-lg">
                {isAdmin
                  ? "Manage users, review games, monitor move records, and supervise the REGISSION platform from one secure dashboard."
                  : "Access your games, follow the live board, review move history, export PGN, and analyse completed positions with Stockfish 18."}
              </p>

              <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
                {[
                  ["Camera", "Live board"],
                  ["Validation", "Legal moves"],
                  ["Analysis", "Stockfish 18"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur">
                    <p className="text-xs text-white/45">{label}</p>
                    <p className="mt-1 text-sm font-semibold text-white/90">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-10 flex items-center gap-5">
                <FoxEye size={250} blinkIntervalMs={5200} blinkDurationMs={520} />
                <div>
                  <p className="text-sm font-semibold text-white/90">Fox Eye Online</p>
                  <p className="mt-1 text-xs text-white/50">
                    Camera tracking and move detection ready
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md">
            {children}
          </div>
        </section>

        <footer className="pb-2 text-center text-xs text-white/35">
          Â© 2026 REGISSION â€¢ Smart IoT Chess Board
        </footer>
      </div>
    </main>
  );
}
