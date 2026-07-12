import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  ArrowRight,
  Sparkles,
  Wand2,
  Bot,
  Workflow,
  Store,
  Cpu,
  Shield,
  Code2,
  Users,
  GraduationCap,
  Play,
  Zap,
} from "lucide-react";
import { Header } from "@/components/xeomx/Header";
import { Logo } from "@/components/xeomx/Logo";
import { ConnectSection } from "@/components/xeomx/ConnectSection";
import { TickerMarquee } from "@/components/xeomx/Marquee";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";
import { pageUrl } from "@/lib/seo";
import { CORE_SECTIONS, EXPLORE_SECTIONS } from "@/lib/explore-sections";
import heroImg from "@/assets/hero.jpg";
import cover1 from "@/assets/cover-1.jpg";
import cover3 from "@/assets/cover-3.jpg";
import cover7 from "@/assets/cover-7.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "XEOMX — The Operating System for the AI Era" },
      {
        name: "description",
        content:
          "XEOMX unifies AI, Prompt Studio, Agents, Workflows, Marketplace, Models, Enterprise, API, Community and Academy in one cinematic ecosystem.",
      },
      { property: "og:title", content: "XEOMX — The Operating System for the AI Era" },
      {
        property: "og:description",
        content:
          "One ecosystem for creators, teams and enterprises. Build, orchestrate and ship with AI.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: pageUrl("/") },
    ],
    links: [{ rel: "canonical", href: pageUrl("/") }],
  }),
  component: Home,
});

type Pillar = {
  key: string;
  eyebrow: string;
  title: string;
  desc: string;
  icon: typeof Sparkles;
  cta: string;
  to: string;
  params?: Record<string, string>;
  accent: "gold" | "magenta" | "cyan";
  status?: "live" | "soon";
};

const PILLARS: Pillar[] = [
  {
    key: "ai",
    eyebrow: "Intelligence",
    title: "XEOMX AI",
    desc: "A single interface to the world's best models — chat, reason, research and create across every modality.",
    icon: Sparkles,
    cta: "Enter XEOMX AI",
    to: "/xeomx-ai",
    accent: "magenta",
    status: "live",
  },
  {
    key: "studio",
    eyebrow: "Creation",
    title: "Prompt Studio",
    desc: "The creative forge for AI artisans. Compose, remix and perfect prompts inside a cinematic workspace.",
    icon: Wand2,
    cta: "Open Prompt Studio",
    to: "/studio",
    accent: "gold",
    status: "live",
  },
  {
    key: "agents",
    eyebrow: "Automation",
    title: "AI Agents",
    desc: "Deploy specialized agents in one click. Autonomous work across research, ops and creation.",
    icon: Bot,
    cta: "Browse Agents",
    to: "/explore/$slug",
    params: { slug: "agent-store" },
    accent: "cyan",
    status: "soon",
  },
  {
    key: "workflows",
    eyebrow: "Orchestration",
    title: "Workflows",
    desc: "Drag. Connect. Ship. A visual builder for complex AI pipelines — no code required.",
    icon: Workflow,
    cta: "Explore Workflows",
    to: "/explore/$slug",
    params: { slug: "visual-workflow" },
    accent: "magenta",
    status: "soon",
  },
  {
    key: "marketplace",
    eyebrow: "Economy",
    title: "Marketplace",
    desc: "Premium prompts, collections and drops from the top 1% of creators worldwide.",
    icon: Store,
    cta: "Enter Marketplace",
    to: "/collections",
    accent: "gold",
    status: "live",
  },
  {
    key: "models",
    eyebrow: "Benchmarks",
    title: "Models",
    desc: "Live intelligence on 400+ models. Compare, benchmark and pick the best AI for every task.",
    icon: Cpu,
    cta: "See Model Intelligence",
    to: "/explore/$slug",
    params: { slug: "model-intelligence" },
    accent: "cyan",
    status: "soon",
  },
  {
    key: "enterprise",
    eyebrow: "Scale",
    title: "Enterprise",
    desc: "Governance, SSO, audit and admin controls for teams deploying AI at scale.",
    icon: Shield,
    cta: "Talk to Enterprise",
    to: "/pricing",
    accent: "gold",
    status: "live",
  },
  {
    key: "api",
    eyebrow: "Developers",
    title: "API",
    desc: "Composable APIs for prompts, agents and models. Build XEOMX into your product.",
    icon: Code2,
    cta: "Read the API",
    to: "/explore/$slug",
    params: { slug: "api-quota" },
    accent: "cyan",
    status: "soon",
  },
  {
    key: "community",
    eyebrow: "Network",
    title: "Community",
    desc: "The creator network powering XEOMX — collaborate, publish and grow together.",
    icon: Users,
    cta: "Meet Creators",
    to: "/creators",
    accent: "magenta",
    status: "live",
  },
  {
    key: "academy",
    eyebrow: "Learn",
    title: "Academy",
    desc: "Structured courses and certifications to master the AI era from foundations to mastery.",
    icon: GraduationCap,
    cta: "Enter Academy",
    to: "/explore/$slug",
    params: { slug: "academy" },
    accent: "gold",
    status: "soon",
  },
];

const accentClass = {
  gold: {
    ring: "border-gold/30 hover:border-gold/60",
    chip: "border-gold/30 bg-gold/10 text-gold",
    icon: "text-gold",
    glow: "from-gold/20 via-transparent to-transparent",
  },
  magenta: {
    ring: "border-magenta/30 hover:border-magenta/60",
    chip: "border-magenta/30 bg-magenta/10 text-magenta",
    icon: "text-magenta",
    glow: "from-magenta/20 via-transparent to-transparent",
  },
  cyan: {
    ring: "border-border hover:border-foreground/40",
    chip: "border-border bg-surface/60 text-muted-foreground",
    icon: "text-foreground",
    glow: "from-foreground/10 via-transparent to-transparent",
  },
} as const;

const item = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};

function Home() {
  const ticker = [
    "◆ XEOMX AI · unified model layer",
    "▲ Prompt Studio · cinematic workspace",
    "● Agents · autonomous execution",
    "◇ Workflows · visual orchestration",
    "▼ Marketplace · premium drops",
    "★ Models · 400+ benchmarked",
    "◆ Enterprise · SSO + audit",
    "● API · composable primitives",
    "▲ Community · creator network",
    "★ Academy · master the AI era",
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={cover1}
            alt=""
            className="h-full w-full object-cover opacity-40"
            width={1600}
            height={1200}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.75_0.18_340/0.15),transparent_60%)]" />
        </div>

        <div
          className="relative mx-auto max-w-[1400px] text-center"
          style={{
            paddingInline: "var(--space-4)",
            paddingTop: "var(--space-9)",
            paddingBottom: "var(--space-8)",
          }}
        >
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
            }}
            className="mx-auto flex max-w-3xl flex-col items-center"
          >
            <motion.span
              variants={item}
              className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 uppercase tracking-[0.3em] text-gold"
              style={{ fontSize: "var(--font-size-micro)" }}
            >
              <Zap className="h-3 w-3" /> The XEOMX Ecosystem
            </motion.span>
            <motion.h1
              variants={item}
              className="font-display font-bold leading-[0.95] tracking-tight"
              style={{
                marginTop: "var(--space-5)",
                fontSize: "clamp(2.75rem, 7vw, var(--font-size-display))",
              }}
            >
              The operating system
              <br />
              for the{" "}
              <span className="text-gradient-magenta italic">AI era</span>.
            </motion.h1>
            <motion.p
              variants={item}
              className="max-w-2xl text-muted-foreground"
              style={{
                marginTop: "var(--space-4)",
                fontSize: "var(--font-size-body-lg)",
              }}
            >
              One cinematic ecosystem for AI, prompts, agents, workflows, models,
              marketplace, enterprise, API, community and academy — engineered
              for creators, teams and the world's most ambitious brands.
            </motion.p>

            <motion.div
              variants={item}
              className="flex flex-wrap items-center justify-center"
              style={{ marginTop: "var(--space-6)", gap: "var(--space-3)" }}
            >
              <Link
                to="/xeomx-ai"
                className="group inline-flex items-center gap-2 text-sm font-medium text-white transition hover:opacity-95"
                style={{
                  background: "var(--gradient-magenta)",
                  borderRadius: "var(--radius-sm)",
                  paddingInline: "var(--space-5)",
                  paddingBlock: "var(--space-3)",
                  boxShadow: "var(--shadow-glow)",
                }}
              >
                <Sparkles className="h-4 w-4" /> Enter XEOMX AI
              </Link>
              <Link
                to="/studio"
                className="inline-flex items-center gap-2 text-sm font-medium text-foreground backdrop-blur transition hover:border-gold/40"
                style={{
                  border: "1px solid var(--border-default)",
                  backgroundColor: "var(--surface-glass)",
                  borderRadius: "var(--radius-sm)",
                  paddingInline: "var(--space-5)",
                  paddingBlock: "var(--space-3)",
                }}
              >
                <Play className="h-4 w-4" /> Open Prompt Studio
              </Link>
              <Link
                to="/feed"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
                style={{ paddingInline: "var(--space-3)", paddingBlock: "var(--space-3)" }}
              >
                Explore the feed <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>

            <motion.dl
              variants={item}
              className="mx-auto grid max-w-2xl grid-cols-3 text-center"
              style={{
                marginTop: "var(--space-8)",
                gap: "var(--space-5)",
                paddingTop: "var(--space-5)",
                borderTop: "1px solid var(--border-subtle)",
              }}
            >
              {[
                ["10", "Product pillars"],
                ["400+", "Models tracked"],
                ["1.4M", "Renders shipped"],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                    {v}
                  </dt>
                  <dd className="mt-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                    {l}
                  </dd>
                </div>
              ))}
            </motion.dl>
          </motion.div>
        </div>
      </section>

      <TickerMarquee items={ticker} />

      {/* PILLARS GRID */}
      <section
        className="mx-auto max-w-[1400px]"
        style={{
          paddingInline: "var(--space-4)",
          paddingTop: "var(--space-9)",
          paddingBottom: "var(--space-6)",
        }}
      >
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-magenta/80">
              The Ecosystem
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
              Ten pillars.{" "}
              <span className="text-gradient-gold italic">One XEOMX.</span>
            </h2>
            <p
              className="mt-3 max-w-2xl text-muted-foreground"
              style={{ fontSize: "var(--font-size-body-lg)" }}
            >
              Every product is designed to stand alone — and to compound when
              used together.
            </p>
          </div>
          <Link
            to="/explore"
            className="hidden shrink-0 text-sm text-muted-foreground transition hover:text-foreground sm:inline"
          >
            See the full map →
          </Link>
        </div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.05 } },
          }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {PILLARS.map((p) => {
            const a = accentClass[p.accent];
            const Icon = p.icon;
            const linkProps = p.params
              ? { to: p.to as "/explore/$slug", params: p.params }
              : { to: p.to as "/studio" };
            return (
              <motion.div key={p.key} variants={item}>
                <Link
                  {...(linkProps as any)}
                  className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border bg-surface/40 backdrop-blur transition ${a.ring}`}
                  style={{ padding: "var(--space-5)" }}
                >
                  <div
                    className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${a.glow} opacity-0 transition group-hover:opacity-100`}
                  />
                  <div className="relative flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] ${a.chip}`}
                    >
                      {p.eyebrow}
                    </span>
                    {p.status === "soon" && (
                      <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                        Soon
                      </span>
                    )}
                  </div>
                  <div className="relative mt-6 flex items-center gap-3">
                    <span
                      className="grid h-10 w-10 place-items-center rounded-2xl border border-border bg-background/60"
                    >
                      <Icon className={`h-5 w-5 ${a.icon}`} />
                    </span>
                    <h3 className="font-display text-xl font-semibold tracking-tight">
                      {p.title}
                    </h3>
                  </div>
                  <p className="relative mt-3 text-sm leading-relaxed text-muted-foreground">
                    {p.desc}
                  </p>
                  <div className="relative mt-6 flex items-center gap-2 text-sm font-medium text-foreground">
                    {p.cta}
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* SPOTLIGHT: PROMPT STUDIO */}
      <section
        className="mx-auto max-w-[1400px]"
        style={{
          paddingInline: "var(--space-4)",
          paddingTop: "var(--space-7)",
          paddingBottom: "var(--space-8)",
        }}
      >
        <div className="relative overflow-hidden rounded-3xl border border-border">
          <img
            src={cover3}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-60"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(120deg, oklch(0.13 0.012 40 / 0.95), oklch(0.13 0.012 40 / 0.55))",
            }}
          />
          <div className="relative grid gap-8 p-8 sm:p-14 lg:grid-cols-[1.2fr_auto] lg:items-center">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-gold">
                <Wand2 className="h-3 w-3" /> Flagship product
              </span>
              <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Prompt Studio —
                <br />
                <span className="text-gradient-gold italic">
                  where prompts become craft.
                </span>
              </h2>
              <p className="mt-4 max-w-xl text-muted-foreground sm:text-base">
                The cinematic canvas that made XEOMX famous. Compose, remix and
                ship your best prompts inside a workspace built for artisans.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  to="/studio"
                  className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-white"
                  style={{
                    background: "var(--gradient-gold)",
                    color: "oklch(0.18 0.02 60)",
                  }}
                >
                  <Play className="h-4 w-4" /> Launch Prompt Studio
                </Link>
                <Link
                  to="/feed"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-5 py-3 text-sm text-foreground backdrop-blur"
                >
                  See what creators are shipping <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="relative hidden shrink-0 lg:block">
              <div className="relative w-[300px] overflow-hidden rounded-3xl border border-border shadow-[var(--shadow-card)]">
                <img
                  src={cover7}
                  alt="Prompt Studio preview"
                  className="aspect-[3/4] w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/40 to-transparent p-5">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-gold">
                    Live
                  </p>
                  <p className="mt-2 font-display text-lg font-semibold">
                    Cinematic workspace
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOR EVERYONE */}
      <section
        className="mx-auto max-w-[1400px]"
        style={{
          paddingInline: "var(--space-4)",
          paddingTop: "var(--space-6)",
          paddingBottom: "var(--space-8)",
        }}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              tag: "Creators",
              title: "Ship cinematic work, faster.",
              cta: "Enter the Feed",
              to: "/feed" as const,
            },
            {
              tag: "Teams",
              title: "Orchestrate AI across your org.",
              cta: "See Pricing",
              to: "/pricing" as const,
            },
            {
              tag: "Enterprise",
              title: "Deploy AI with governance built-in.",
              cta: "Talk to us",
              to: "/contact" as const,
            },
          ].map((c) => (
            <Link
              key={c.tag}
              to={c.to}
              className="group flex flex-col justify-between rounded-3xl border border-border bg-surface/40 p-6 backdrop-blur transition hover:border-magenta/40"
            >
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-magenta/80">
                  {c.tag}
                </p>
                <h3 className="mt-3 font-display text-2xl font-semibold tracking-tight">
                  {c.title}
                </h3>
              </div>
              <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-foreground">
                {c.cta}{" "}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA BANNER */}
      <section
        className="mx-auto max-w-[1400px]"
        style={{
          paddingInline: "var(--space-4)",
          paddingBottom: "var(--space-9)",
        }}
      >
        <div className="relative overflow-hidden rounded-3xl border border-border">
          <img
            src={heroImg}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-50"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at right, oklch(0.75 0.18 340 / 0.35), transparent 60%), linear-gradient(120deg, oklch(0.13 0.012 40 / 0.95), oklch(0.13 0.012 40 / 0.55))",
            }}
          />
          <div className="relative grid gap-6 p-8 sm:p-14 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-magenta/30 bg-magenta/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-magenta">
                Founders Access
              </span>
              <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Build the AI era
                <br />
                <span className="text-gradient-magenta italic">with XEOMX.</span>
              </h2>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                Join the creators, teams and enterprises shipping the next
                generation of AI-native products.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/auth"
                search={{ next: undefined }}
                className="rounded-full px-5 py-3 text-sm font-medium text-white"
                style={{
                  background: "var(--gradient-magenta)",
                  boxShadow: "var(--shadow-glow)",
                }}
              >
                Create your account
              </Link>
              <Link
                to="/pricing"
                className="rounded-full border border-border bg-surface/60 px-5 py-3 text-sm text-foreground backdrop-blur"
              >
                View plans
              </Link>
            </div>
          </div>
        </div>
      </section>

      <ConnectSection />

      <footer className="mt-4 border-t border-border/60 bg-surface/30">
        <div className="mx-auto max-w-[1400px] px-4 py-12 sm:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Logo variant="full" size={28} ariaLabel="XEOMX" />
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {m.footer_tagline()}
              </p>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Ecosystem
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link to="/xeomx-ai" className="transition hover:text-foreground">XEOMX AI</Link></li>
                <li><Link to="/studio" className="transition hover:text-foreground">Prompt Studio</Link></li>
                <li><Link to="/collections" className="transition hover:text-foreground">Marketplace</Link></li>
                <li><Link to="/creators" className="transition hover:text-foreground">Community</Link></li>
                <li><Link to="/explore" className="transition hover:text-foreground">All products</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                {m.footer_platform()}
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link to="/feed" className="transition hover:text-foreground">{m.nav_feed()}</Link></li>
                <li><Link to="/collections" className="transition hover:text-foreground">{m.nav_collections()}</Link></li>
                <li><Link to="/creators" className="transition hover:text-foreground">{m.nav_creators()}</Link></li>
                <li><Link to="/pricing" className="transition hover:text-foreground">Pricing</Link></li>
                <li><Link to="/magazine" className="transition hover:text-foreground">Magazine</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                {m.footer_legal()}
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link to="/terms" className="transition hover:text-foreground">{m.footer_terms()}</Link></li>
                <li><Link to="/privacy" className="transition hover:text-foreground">{m.footer_privacy()}</Link></li>
                <li><Link to="/cookies" className="transition hover:text-foreground">{m.footer_cookie()}</Link></li>
                <li><Link to="/refund-policy" className="transition hover:text-foreground">{m.footer_refund()}</Link></li>
                <li><Link to="/contact" className="transition hover:text-foreground">Contact</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-6 sm:flex-row">
            <p className="text-xs text-muted-foreground">{m.footer_rights()}</p>
            <p className="text-xs text-muted-foreground">
              {m.footer_built()} ·{" "}
              <span className="text-gradient-gold">
                {m.footer_sections({
                  count: String(CORE_SECTIONS.length + EXPLORE_SECTIONS.length),
                })}
              </span>{" "}
              · {m.footer_powered()}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
