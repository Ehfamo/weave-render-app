import { ArrowUpRight } from "lucide-react";

const SOCIALS = [
  {
    name: "TikTok",
    handle: "@xeomxai",
    desc: "Viral prompt drops · daily",
    href: "https://www.tiktok.com/@xeomxai?_r=1&_t=ZS-97O9c8UbPSn",
    accent: "var(--gradient-magenta)",
  },
  {
    name: "Instagram",
    handle: "@xeomx_ai",
    desc: "Cinematic renders · behind the scenes",
    href: "https://www.instagram.com/xeomx_ai?utm_source=qr&igsh=MTVkMzJuZHU1M3o1YQ==",
    accent: "linear-gradient(135deg, oklch(0.72 0.18 20), oklch(0.62 0.22 340))",
  },
  {
    name: "Telegram",
    handle: "@xeomxai",
    desc: "Founders channel · early drops",
    href: "https://t.me/xeomxai",
    accent: "linear-gradient(135deg, oklch(0.72 0.16 230), oklch(0.62 0.18 260))",
  },
  {
    name: "Pinterest",
    handle: "xeomx",
    desc: "Mood boards · prompt aesthetics",
    href: "https://pin.it/2iNs9SqEe",
    accent: "var(--gradient-gold)",
  },
];

export function ConnectSection() {
  return (
    <section className="relative mx-4 mt-16 overflow-hidden rounded-3xl border border-border bg-surface/40 sm:mx-8">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 20% 0%, oklch(0.55 0.22 340 / 0.18), transparent 60%), radial-gradient(50% 50% at 90% 100%, oklch(0.78 0.14 80 / 0.18), transparent 60%)",
        }}
      />
      <div className="relative grid gap-10 p-8 sm:p-14 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <div className="max-w-lg">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-gold">
            Global · network
          </span>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-[0.95] tracking-tight sm:text-5xl">
            Connect with{" "}
            <span className="text-gradient-magenta italic">XeomX</span>
          </h2>
          <p className="mt-4 text-sm text-muted-foreground sm:text-base">
            One ecosystem. Four channels. Follow the official XeomX network for
            daily prompt drops, cinematic renders and founders-only releases.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            <span className="rounded-full border border-border bg-background/50 px-3 py-1">verified</span>
            <span className="rounded-full border border-border bg-background/50 px-3 py-1">official</span>
            <span className="rounded-full border border-border bg-background/50 px-3 py-1">global</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIALS.map((s) => (
            <a
              key={s.name}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative overflow-hidden rounded-2xl border border-border bg-background/60 p-5 backdrop-blur transition hover:border-magenta/40 hover:bg-background/80"
            >
              <div
                className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-30 blur-3xl transition group-hover:opacity-60"
                style={{ background: s.accent }}
              />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-xl font-semibold tracking-tight">{s.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.handle}</p>
                  <p className="mt-3 text-[13px] text-foreground/80">{s.desc}</p>
                </div>
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-surface/80 transition group-hover:scale-110"
                  style={{ boxShadow: "var(--shadow-glow)" }}
                >
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}