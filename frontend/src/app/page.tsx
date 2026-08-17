"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import PageShell from "@/components/page-shell";
import { MarqueeBand } from "@/components/marquee";
import {
  DynamicActiveGames,
  DynamicFoxEyeCard,
  DynamicLatency,
  DynamicSystemBadge,
} from "@/components/regission/dynamic-home-status";

function ButtonPrimary({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-xl bg-[#5865F2] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 active:translate-y-[1px]"
    >
      {children}
    </Link>
  );
}

function ButtonGhost({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10 active:translate-y-[1px]"
    >
      {children}
    </Link>
  );
}

export default function Home() {
  return (
    <PageShell>
      <div className="w-full">
        <section className="w-full px-4 py-10 md:px-6">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-start">
            <div className="space-y-6">
              <DynamicSystemBadge />

              <div className="space-y-3">
                <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">
                  The Eye Behind{" "}
                  <span className="text-[#9aa5ff]">
                    Every Move
                  </span>
                </h1>

                <p className="text-lg text-white/70 md:text-xl">
                  Vision-powered chess notation for physical boards.
                </p>
              </div>

              <p className="max-w-xl leading-relaxed text-white/70">
                Capture moves using a camera, validate legality, and
                publish live to your web dashboard. Built for training
                sessions, clubs, and tournaments.
              </p>

              <div className="flex flex-wrap gap-3">
                <ButtonPrimary href="/dashboard">
                  Start Now
                </ButtonPrimary>

                <ButtonGhost href="/features">
                  Explore Features
                </ButtonGhost>

                <ButtonGhost href="/games">
                  History
                </ButtonGhost>
              </div>

              <div className="grid max-w-md grid-cols-2 gap-3 pt-2">
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <p className="text-xs text-white/45">
                    Total games
                  </p>

                  <p className="mt-2 text-xl font-black text-white">
                    <DynamicActiveGames />
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <p className="text-xs text-white/45">
                    Avg latency
                  </p>

                  <p className="mt-2 text-xl font-black text-white">
                    <DynamicLatency />
                  </p>
                </div>
              </div>
            </div>

            <div className="min-w-0 self-start">
              <DynamicFoxEyeCard />
            </div>
          </div>
        </section>

        <section className="h-4 w-full md:h-6" />

        <div className="w-full">
          <MarqueeBand text="VISION BEYOND THE BOARD" />
        </div>

        <section className="w-full px-4 py-16 md:px-6">
          <div className="text-center">
            <h2 className="text-4xl font-extrabold italic tracking-wide text-white md:text-5xl">
              HOW IT WORKS
            </h2>

            <p className="mt-3 text-white/70">
              From camera capture {"\u2192"} move detection {"\u2192"}
              legality checks {"\u2192"} live web dashboard.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="h-full rounded-3xl border border-white/10 bg-white/95 p-8 shadow-2xl">
              <div className="flex flex-wrap items-center gap-3">
                {[
                  "\u{1F353}",
                  "\u{1F4F7}",
                  "\u{1F441}",
                  "\u{1F40D}",
                ].map((icon) => (
                  <span
                    key={icon}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-black/5 text-xl"
                  >
                    {icon}
                  </span>
                ))}
              </div>

              <h3 className="mt-6 text-xl font-extrabold text-neutral-900">
                Hardwares/Softwares
              </h3>

              <p className="mt-2 text-sm leading-relaxed text-neutral-700">
                Raspberry Pi 5, Camera Module V3, Stockfish 18,
                OpenCV, Python, Laravel, and MySQL.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-4 text-sm text-neutral-700">
                <div className="rounded-2xl bg-black/5 p-4">
                  <p className="text-xs font-semibold text-neutral-500">
                    Device
                  </p>
                  <p className="mt-1 font-semibold">
                    Raspberry Pi 5
                  </p>
                </div>

                <div className="rounded-2xl bg-black/5 p-4">
                  <p className="text-xs font-semibold text-neutral-500">
                    Vision
                  </p>
                  <p className="mt-1 font-semibold">
                    YOLOv8 + OpenCV
                  </p>
                </div>

                <div className="rounded-2xl bg-black/5 p-4">
                  <p className="text-xs font-semibold text-neutral-500">
                    Engine
                  </p>
                  <p className="mt-1 font-semibold">
                    Stockfish 18
                  </p>
                </div>

                <div className="rounded-2xl bg-black/5 p-4">
                  <p className="text-xs font-semibold text-neutral-500">
                    Capture
                  </p>
                  <p className="mt-1 font-semibold">
                    Camera Module V3
                  </p>
                </div>
              </div>
            </div>

            <div className="h-full rounded-3xl border border-white/10 bg-white/95 p-8 text-center shadow-2xl">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#5865F2]/15 text-2xl">
                {"\u265F"}
              </div>

              <h3 className="mt-6 text-xl font-extrabold text-neutral-900">
                Regission Web
              </h3>

              <p className="mt-3 text-sm leading-relaxed text-neutral-700">
                Access all your physical games here.
              </p>

              <Link
                href="/dashboard"
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#b48a68] px-10 py-3 text-sm font-extrabold text-white shadow-lg transition hover:brightness-110 active:translate-y-[1px]"
              >
                TRY NOW
              </Link>
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {[
              {
                title: "Capture",
                desc: "Camera captures the board from a fixed overhead view.",
              },
              {
                title: "Detect",
                desc: "Compute square changes to identify moves.",
              },
              {
                title: "Validate",
                desc: "Check legality to prevent incorrect updates.",
              },
              {
                title: "Publish",
                desc: "Send moves to the web dashboard in real time.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-black/60 p-5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur"
              >
                <div className="mb-3 h-9 w-9 rounded-xl bg-white/10" />
                <p className="text-base font-extrabold">
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/75">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        <ChessFigmaCTA />
      </div>
    </PageShell>
  );
}

function ChessFigmaCTA() {
  const [hovered, setHovered] = useState(false);

  type ChessShapeType =
    | "pawn"
    | "knight"
    | "bishop"
    | "rook"
    | "queen"
    | "tile"
    | "diamond"
    | "burst"
    | "ring";

  type ShapeItem = {
    type: ChessShapeType;
    x: number;
    y: number;
    s: number;
    r: number;
    driftX: number;
    driftY: number;
  };

  const shapes = useMemo<ShapeItem[]>(
    () => [
      {
        type: "pawn",
        x: 6,
        y: 18,
        s: 1.25,
        r: -8,
        driftX: -18,
        driftY: 10,
      },
      {
        type: "tile",
        x: 10,
        y: 72,
        s: 1,
        r: 0,
        driftX: -10,
        driftY: -12,
      },
      {
        type: "knight",
        x: 32,
        y: 84,
        s: 1.2,
        r: 10,
        driftX: 12,
        driftY: -16,
      },
      {
        type: "bishop",
        x: 55,
        y: 22,
        s: 1.15,
        r: 12,
        driftX: 16,
        driftY: 10,
      },
      {
        type: "diamond",
        x: 48,
        y: 18,
        s: 0.9,
        r: 45,
        driftX: 8,
        driftY: 14,
      },
      {
        type: "burst",
        x: 67,
        y: 18,
        s: 0.9,
        r: 0,
        driftX: 10,
        driftY: 12,
      },
      {
        type: "rook",
        x: 92,
        y: 26,
        s: 1.4,
        r: 6,
        driftX: 16,
        driftY: 8,
      },
      {
        type: "queen",
        x: 88,
        y: 70,
        s: 1.05,
        r: -10,
        driftX: 14,
        driftY: -14,
      },
      {
        type: "ring",
        x: 20,
        y: 30,
        s: 1,
        r: 0,
        driftX: -14,
        driftY: 12,
      },
      {
        type: "ring",
        x: 82,
        y: 40,
        s: 0.9,
        r: 0,
        driftX: 10,
        driftY: 8,
      },
    ],
    []
  );

  return (
    <section className="relative w-full overflow-hidden py-20 md:py-24">
      <div className="absolute inset-0">
        {shapes.map((shape, index) => (
          <ChessShape
            key={index}
            {...shape}
            hovered={hovered}
          />
        ))}
      </div>

      <div className="relative z-10 flex min-h-[360px] w-full flex-col items-center justify-center px-4 md:px-6">
        <p className="text-sm font-semibold text-white">
          Regission {"\u2022"} vision-based notation
        </p>

        <div className="mt-10">
          <Link
            href="/dashboard"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="group inline-flex items-center gap-5 bg-[#5865F2] px-10 py-6 text-4xl font-extrabold tracking-tight text-white shadow-2xl transition-transform duration-200 hover:-translate-y-[2px] hover:brightness-110 active:translate-y-[1px] md:text-5xl"
          >
            <span className="text-white/90 transition-transform duration-200 group-hover:translate-x-1">
              {"\u2192"}
            </span>
            Get started for free
          </Link>
        </div>
      </div>
    </section>
  );
}

function ChessShape({
  type,
  x,
  y,
  s,
  r,
  driftX,
  driftY,
  hovered,
}: {
  type:
    | "pawn"
    | "knight"
    | "bishop"
    | "rook"
    | "queen"
    | "tile"
    | "diamond"
    | "burst"
    | "ring";
  x: number;
  y: number;
  s: number;
  r: number;
  driftX: number;
  driftY: number;
  hovered: boolean;
}) {
  const base =
    `translate(-50%, -50%) rotate(${r}deg) scale(${s})`;

  const drift = hovered
    ? ` translate(${driftX}px, ${driftY}px)`
    : " translate(0px, 0px)";

  const style: React.CSSProperties = {
    left: `${x}%`,
    top: `${y}%`,
    transform: base + drift,
    transition:
      "transform 900ms cubic-bezier(.16,1,.3,1)",
  };

  return (
    <div className="absolute" style={style}>
      {type === "tile" && <Tile />}
      {type === "diamond" && <Diamond />}
      {type === "burst" && <Burst />}
      {type === "ring" && <Ring />}

      {type === "pawn" && (
        <Piece
          label={"\u265F"}
          bg="bg-emerald-400"
          ring="ring-emerald-500/30"
        />
      )}

      {type === "knight" && (
        <Piece
          label={"\u265E"}
          bg="bg-fuchsia-400"
          ring="ring-fuchsia-500/30"
        />
      )}

      {type === "bishop" && (
        <Piece
          label={"\u265D"}
          bg="bg-sky-400"
          ring="ring-sky-500/30"
        />
      )}

      {type === "rook" && (
        <Piece
          label={"\u265C"}
          bg="bg-amber-400"
          ring="ring-amber-500/30"
        />
      )}

      {type === "queen" && (
        <Piece
          label={"\u265B"}
          bg="bg-violet-400"
          ring="ring-violet-500/30"
        />
      )}
    </div>
  );
}

function Piece({
  label,
  bg,
  ring,
}: {
  label: string;
  bg: string;
  ring: string;
}) {
  return (
    <div
      className={`grid place-items-center rounded-[2.25rem] ${bg} p-10 shadow-xl ring-1 ${ring}`}
    >
      <div className="text-7xl text-black/80 drop-shadow-sm">
        {label}
      </div>
    </div>
  );
}

function Tile() {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-xl ring-1 ring-black/10">
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 16 }).map((_, index) => (
          <div
            key={index}
            className={`h-7 w-7 rounded-md ${
              (Math.floor(index / 4) + (index % 4)) % 2 === 0
                ? "bg-[#d9b25a]"
                : "bg-[#f3d7c8]"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function Diamond() {
  return (
    <div className="h-16 w-16 rotate-45 rounded-2xl bg-[#7c1d1d] shadow-xl" />
  );
}

function Ring() {
  return (
    <div className="grid place-items-center rounded-[3rem] bg-transparent p-10">
      <div className="h-24 w-24 rounded-full border-[16px] border-[#3b82f6] bg-transparent" />
      <div className="-mt-20 h-14 w-14 rounded-full border-[12px] border-[#22c55e] bg-transparent" />
    </div>
  );
}

function Burst() {
  return (
    <div className="relative h-28 w-28">
      <div className="absolute inset-0 rounded-full bg-[#ff7aa2] shadow-xl" />

      {Array.from({ length: 10 }).map((_, index) => (
        <span
          key={index}
          className="absolute left-1/2 top-1/2 h-8 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff7aa2]"
          style={{
            transform:
              `translate(-50%,-50%) rotate(${index * 36}deg) translateY(-64px)`,
          }}
        />
      ))}
    </div>
  );
}