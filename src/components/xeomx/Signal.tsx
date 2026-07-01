import { Flame, Rocket, Trophy, Zap } from "lucide-react";
import type { ViralSignal } from "@/lib/prompts";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

const map = {
  trending: { labelKey: "signal_trending" as const, Icon: Flame, cls: "text-magenta border-magenta/40 bg-magenta/10" },
  rising: { labelKey: "signal_rising" as const, Icon: Zap, cls: "text-gold border-gold/40 bg-gold/10" },
  top1: { labelKey: "signal_top1" as const, Icon: Trophy, cls: "text-gold border-gold/50 bg-gold/15" },
  viral: { labelKey: "signal_viral" as const, Icon: Rocket, cls: "text-magenta border-magenta/50 bg-magenta/15" },
} as const;

export function SignalBadge({ signal, score }: { signal?: ViralSignal; score?: number }) {
  if (!signal) return null;
  const s = map[signal];
  const Icon = s.Icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] backdrop-blur ${s.cls}`}>
      <Icon className="h-3 w-3" /> {m[s.labelKey]()}
      {typeof score === "number" ? <span className="opacity-70">· {score}</span> : null}
    </span>
  );
}