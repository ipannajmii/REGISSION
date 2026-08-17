"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type FoxEyeProps = {
  size?: number;          // overall eye size in px
  blinkIntervalMs?: number; // average blink interval
  blinkDurationMs?: number; // blink length
  className?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * FoxEye:
 * - pupil "looks around" by tracking mouse position relative to eye center
 * - eyelids blink automatically with a smooth animation
 */
export function FoxEye({
  size = 320,
  blinkIntervalMs = 4500,
  blinkDurationMs = 420,
  className = "",
}: FoxEyeProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [pupil, setPupil] = useState({ x: 0, y: 0 }); // -1..1-ish
  const [isBlinking, setIsBlinking] = useState(false);

  // random-ish blink schedule
  const nextBlinkDelay = useMemo(() => {
    // random between 0.7x and 1.3x
    const r = 0.7 + Math.random() * 0.6;
    return Math.round(blinkIntervalMs * r);
  }, [blinkIntervalMs]);

  useEffect(() => {
    const t = setTimeout(() => {
      setIsBlinking(true);
      const t2 = setTimeout(() => setIsBlinking(false), blinkDurationMs);
      return () => clearTimeout(t2);
    }, nextBlinkDelay);
    return () => clearTimeout(t);
  }, [nextBlinkDelay, blinkDurationMs]);

  // continuously schedule blinks
  useEffect(() => {
    let mounted = true;

    function schedule() {
      const r = 0.7 + Math.random() * 0.6;
      const delay = Math.round(blinkIntervalMs * r);

      setTimeout(() => {
        if (!mounted) return;
        setIsBlinking(true);

        setTimeout(() => {
          if (!mounted) return;
          setIsBlinking(false);
          schedule();
        }, blinkDurationMs);
      }, delay);
    }

    schedule();
    return () => {
      mounted = false;
    };
  }, [blinkIntervalMs, blinkDurationMs]);

  // mouse tracking
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const el = wrapRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const dx = e.clientX - cx;
      const dy = e.clientY - cy;

      // normalize roughly to -1..1 based on eye radius
      const nx = dx / (rect.width / 2);
      const ny = dy / (rect.height / 2);

      // fox eyes don't move pupil too much: keep it subtle
      setPupil({
        x: clamp(nx, -1, 1),
        y: clamp(ny, -1, 1),
      });
    }

    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // pupil travel limits (px)
  const pupilMaxX = size * 0.06;
  const pupilMaxY = size * 0.04;

  const pupilX = pupil.x * pupilMaxX;
  const pupilY = pupil.y * pupilMaxY;

  return (
    <div
      ref={wrapRef}
      className={`relative select-none ${className}`}
      style={{ width: size, height: Math.round(size * 0.56) }}
      aria-label="Fox eye animation"
    >
      {/* Outer glow */}
      <div className="absolute inset-0 rounded-[999px] blur-2xl bg-orange-500/20" />

      {/* Eye container */}
      <div className="absolute inset-0 rounded-[999px] border border-neutral-800 bg-neutral-950/40 overflow-hidden">
        {/* Fox-eye shape accent (slanted ends) */}
        <div className="absolute inset-0">
          <div className="absolute -left-10 top-1/2 h-[180%] w-32 -translate-y-1/2 rotate-12 bg-orange-500/10 blur-xl" />
          <div className="absolute -right-10 top-1/2 h-[180%] w-32 -translate-y-1/2 -rotate-12 bg-orange-500/10 blur-xl" />
        </div>

        {/* Sclera highlight */}
        <div className="absolute inset-0 bg-linear-to-b from-white/10 via-white/5 to-transparent" />

        {/* Iris + pupil group */}
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            transform: `translate(-50%, -50%) translate(${pupilX}px, ${pupilY}px)`,
            transition: "transform 120ms ease-out",
          }}
        >
          {/* Iris */}
          <div
            className="relative grid place-items-center rounded-full bg-linear-to-b from-orange-300/90 via-orange-500/80 to-amber-900/80 ring-1 ring-orange-200/30 shadow-[0_0_40px_rgba(249,115,22,0.25)]"
            style={{
              width: Math.round(size * 0.22),
              height: Math.round(size * 0.22),
            }}
          >
            {/* Iris texture rings */}
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12),transparent_55%)]" />
            <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,rgba(0,0,0,0.0),rgba(0,0,0,0.22),rgba(0,0,0,0.0))] opacity-60" />

            {/* Fox pupil (vertical slit) */}
            <div
              className="relative rounded-[999px] bg-neutral-950"
              style={{
                width: Math.round(size * 0.045),
                height: Math.round(size * 0.14),
                boxShadow: "0 0 10px rgba(0,0,0,0.45)",
              }}
            >
              {/* small specular highlight */}
              <div className="absolute left-1/2 top-[10%] h-3 w-2 -translate-x-1/2 rounded-full bg-white/40 blur-[0.2px]" />
            </div>
          </div>
        </div>

        {/* Eye shine */}
        <div className="absolute left-[22%] top-[18%] h-10 w-20 rotate-12 rounded-full bg-white/10 blur-md" />
        <div className="absolute left-[30%] top-[30%] h-4 w-10 rotate-12 rounded-full bg-white/10 blur-sm" />

        {/* Eyelids (blink) */}
        {/* Top lid */}
        <div
          className="absolute left-0 right-0 top-0 bg-neutral-950"
          style={{
            height: isBlinking ? "55%" : "0%",
            transition: `height ${blinkDurationMs}ms cubic-bezier(.2,.8,.2,1)`,
          }}
        />
        {/* Bottom lid */}
        <div
          className="absolute left-0 right-0 bottom-0 bg-neutral-950"
          style={{
            height: isBlinking ? "55%" : "0%",
            transition: `height ${blinkDurationMs}ms cubic-bezier(.2,.8,.2,1)`,
          }}
        />

        {/* Eyelid edges (fox sharp lids) */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-10 bg-linear-to-b from-neutral-950/80 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-neutral-950/80 to-transparent" />
        </div>

        {/* Outline */}
        <div className="absolute inset-0 rounded-[999px] ring-1 ring-orange-500/20" />
      </div>
    </div>
  );
}