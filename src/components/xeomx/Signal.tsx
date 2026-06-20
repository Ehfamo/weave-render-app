import { Flame, Rocket, Trophy, Zap } from "lucide-react";
import type { ViralSignal } from "@/lib/prompts";

const map = {
  trending: { label: "Trending", Icon: Flame, cls: "text-magenta border-magenta/40 bg-magenta/10" },
  rising: { label: "Rising fast", Icon: Zap, cls: "text-gold border-gold/40 bg-gold/10" },
  top1: { label: "Top 1%", Icon: Trophy, cls: "text-gold border-gold/50 bg-gold/15" },
  viral: { label: "Viral", Icon: Rocket, cls: "text-magenta border-magenta/50 bg-magenta/15" },
} as const;

export function SignalBadge({ signal, score }: { signal?: ViralSignal; score?: number }) {
  if (!signal) return null;
  const m = map[signal];
  const Icon = m.Icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] backdrop-blur ${m.cls}`}>
      <Icon className="h-3 w-3" /> {m.label}
      {typeof score === "number" ? <span className="opacity-70">· {score}</span> : null}
    </span>
  );
}