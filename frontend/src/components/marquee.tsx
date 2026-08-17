// src/components/marquee.tsx
"use client";

export function MarqueeBand({
  text = "VISION BEYOND THE BOARD",
}: {
  text?: string;
}) {
  const pieces = ["♟", "♞", "♜", "♛", "♚", "♝"];
  const chips = Array.from({ length: 10 });

  return (
    <section className="relative overflow-hidden border-y border-white/10 bg-[#5865F2]">
      {/* soft glow overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.38),transparent_60%)]" />

      {/* floating chess pieces behind */}
      <div className="pointer-events-none absolute inset-0 opacity-20">
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className="float-piece absolute select-none text-white"
            style={{
              left: `${(i * 7) % 100}%`,
              top: `${(i * 11) % 100}%`,
              fontSize: `${22 + (i % 5) * 10}px`,
              animationDelay: `${i * 0.4}s`,
            }}
          >
            {pieces[i % pieces.length]}
          </div>
        ))}
      </div>

      {/* glow particles */}
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="particle absolute block rounded-full bg-white"
            style={{
              left: `${(i * 13) % 100}%`,
              top: `${(i * 17) % 100}%`,
              width: `${2 + (i % 3)}px`,
              height: `${2 + (i % 3)}px`,
              animationDelay: `${i * 0.25}s`,
            }}
          />
        ))}
      </div>

      {/* band height + CENTER content */}
      <div className="relative flex items-center justify-center py-6">
        <div className="marquee w-full">
          <div className="marquee__track">
            {[...chips, ...chips].map((_, i) => (
              <div key={i} className="marquee__item">
                <span className="marquee__text">{text}</span>
                <span className="marquee__sep">{pieces[i % pieces.length]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* neon hover glow */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 hover:opacity-100">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(88,101,242,0.55),transparent_55%)]" />
      </div>
    </section>
  );
}