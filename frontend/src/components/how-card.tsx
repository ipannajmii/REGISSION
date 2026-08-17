export function HowCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-3xl border border-neutral-800 bg-neutral-900/30 p-6">
      <p className="font-medium">{title}</p>
      <ul className="mt-4 space-y-2 text-sm text-neutral-300">
        {items.map((it, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-orange-500/80" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}