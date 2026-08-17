export function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="group rounded-3xl border border-neutral-800 bg-neutral-900/30 p-6 transition hover:bg-neutral-900/50">
      <div className="h-10 w-10 rounded-2xl bg-orange-500/15 ring-1 ring-orange-500/25 transition group-hover:ring-orange-500/40" />
      <p className="mt-4 font-medium">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-neutral-300">{desc}</p>
    </div>
  );
}