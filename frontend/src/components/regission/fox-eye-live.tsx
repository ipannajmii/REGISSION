"use client";

import { useEffect, useState } from "react";

export default function FoxEyeLive() {
  const [blink, setBlink] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let blinkTimer: number | undefined;
    let moveTimer: number | undefined;
    let reopenTimer: number | undefined;

    function scheduleBlink() {
      blinkTimer = window.setTimeout(() => {
        setBlink(true);

        reopenTimer = window.setTimeout(() => {
          setBlink(false);
          scheduleBlink();
        }, 160);
      }, 2400 + Math.random() * 3400);
    }

    function scheduleMove() {
      moveTimer = window.setTimeout(() => {
        setPosition({
          x: Math.round((Math.random() - 0.5) * 22),
          y: Math.round((Math.random() - 0.5) * 10),
        });

        scheduleMove();
      }, 1200 + Math.random() * 1700);
    }

    scheduleBlink();
    scheduleMove();

    return () => {
      if (blinkTimer) window.clearTimeout(blinkTimer);
      if (moveTimer) window.clearTimeout(moveTimer);
      if (reopenTimer) window.clearTimeout(reopenTimer);
    };
  }, []);

  return (
    <div className="relative flex h-52 items-center justify-center overflow-hidden rounded-[92px] border border-orange-400/10 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.34),rgba(29,17,17,0.98)_62%)]">
      <div
        className={
          blink
            ? "flex h-2 w-24 items-center justify-center rounded-full bg-orange-500/80 transition-all duration-150"
            : "flex h-24 w-24 items-center justify-center rounded-full bg-orange-500 shadow-[0_0_55px_rgba(249,115,22,0.48)] transition-all duration-500"
        }
        style={{
          transform: blink
            ? "translate(0px, 0px)"
            : `translate(${position.x}px, ${position.y}px)`,
        }}
      >
        {!blink && (
          <div className="h-14 w-4 rounded-full bg-black" />
        )}
      </div>
    </div>
  );
}