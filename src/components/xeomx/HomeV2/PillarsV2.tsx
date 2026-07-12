import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  Wand2,
  Bot,
  Workflow,
  Store,
  Cpu,
  Users,
  GraduationCap,
  Code2,
  type LucideIcon,
} from "lucide-react";

type Pillar = {
  title: string;
  desc: string;
  href: "/studio" | "/xeomx-ai" | "/feed" | "/collections" | "/creators" | "/magazine" | "/pricing" | "/explore";
  icon: LucideIcon;
};

const PILLARS: Pillar[] = [
  { title: "Prompt Studio", desc: "Craft, iterate and ship prompts with structure.", href: "/studio", icon: Wand2 },
  { title: "XEOMX AI", desc: "A single intent bar for the entire ecosystem.", href: "/xeomx-ai", icon: Bot },
  { title: "Feed", desc: "Live signal from the community, ranked for taste.", href: "/feed", icon: Workflow },
  { title: "Collections", desc: "Curated sets built by creators you trust.", href: "/collections", icon: Store },
  { title: "Creators", desc: "The people shaping how we build with AI.", href: "/creators", icon: Users },
  { title: "Magazine", desc: "Editorial deep-dives into craft and culture.", href: "/magazine", icon: GraduationCap },
  { title: "Pricing", desc: "Simple tiers for solo, team and enterprise.", href: "/pricing", icon: Cpu },
  { title: "Explore", desc: "Browse every corner of the marketplace.", href: "/explore", icon: Code2 },
];

export function PillarsV2() {
  return (
    <section className="border-b border-border/60 bg-background">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 flex flex-col gap-3">
          <span className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">The Ecosystem</span>
          <h2 className="font-display text-3xl tracking-tight md:text-4xl">One platform, many surfaces</h2>
          <p className="max-w-xl text-muted-foreground">
            Every pillar links to the real, existing route — nothing is removed or replaced.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: i * 0.04 }}
              >
                <Link
                  to={p.href}
                  className="group flex h-full flex-col justify-between rounded-2xl border border-border/60 bg-surface/50 p-5 transition hover:border-magenta/50 hover:bg-surface"
                >
                  <div>
                    <span className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-background/60">
                      <Icon className="h-4 w-4 text-foreground/80 transition group-hover:text-magenta" />
                    </span>
                    <h3 className="font-display text-lg tracking-tight">{p.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
                  </div>
                  <span className="mt-6 text-xs uppercase tracking-[0.24em] text-muted-foreground transition group-hover:text-foreground">
                    Open →
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}