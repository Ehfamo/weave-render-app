import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { pageUrl } from "@/lib/seo";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles, TrendingUp, Plus, LogOut, ChevronRight,
  Wand2, BarChart3, Wallet, LayoutGrid, LineChart as LineChartIcon,
  Trophy, Flame, Rocket, ArrowUpRight, Eye, Coins, Users2,
} from "lucide-react";
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/xeomx/Header";
import { toast } from "sonner";
import { motion } from "motion/react";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your dashboard — XeomX" },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Your dashboard — XeomX" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: pageUrl("/dashboard") },
    ],
    links: [{ rel: "canonical", href: pageUrl("/dashboard") }],
  }),
});

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_creator: boolean;
};

const metricItemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const metricContainerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });

  async function signOut() {
    await supabase.auth.signOut();
    toast.success(m.common_signed_out());
    navigate({ to: "/" });
  }

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        {m.common_loading()}
      </div>
    );
  }

  const displayName =
    profile?.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Creator";
  const username = profile?.username || user.email?.split("@")[0] || "creator";

  // ---- Real data adapters (presentation-only; no query changes) ----
  // The current data layer exposes only the `profiles` row. Any metric not
  // present there is treated as "no data yet" → empty state (never fabricated).
  const latestCreationImage: string | null = null; // no creations table wired yet
  const heroBackground: string = latestCreationImage
    ? `url("${latestCreationImage}") center/cover`
    : "radial-gradient(120% 100% at 100% 0%, oklch(0.72 0.19 55 / 0.55), transparent 55%), radial-gradient(90% 90% at 0% 100%, oklch(0.55 0.24 340 / 0.6), transparent 60%), linear-gradient(135deg, oklch(0.22 0.05 320), oklch(0.16 0.03 40))";

  const primaryStat: number | null = null;      // creations generated
  const reachStat: number | null = null;        // reach / impressions
  const earningsStat: number | null = null;     // USD earnings
  const followersStat: number | null = null;    // followers
  const trendSeries: { day: string; value: number }[] = []; // render history
  const topPrompts: { id: string; title: string; value: number }[] = [];
  const highlights: { title: string; body: string; icon: typeof Trophy }[] = [];

  const hasActivity = (primaryStat ?? 0) > 0;
  const hasTrend = trendSeries.length > 0;
  const hasHighlights = highlights.length > 0;
  const hasPrompts = topPrompts.length > 0;

  const subheading = hasActivity
    ? "Your creative momentum is building."
    : "Let's create your first masterpiece.";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-[1400px] px-4 py-10 sm:px-8">

        {/* 1. Cinematic Hero Band */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-3xl"
          style={{
            minHeight: "clamp(240px, 32vw, 340px)",
            background: heroBackground,
            border: "1px solid var(--border-default)",
          }}
        >
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, transparent 0%, oklch(0.12 0.02 320 / 0.35) 45%, oklch(0.10 0.02 320 / 0.92) 100%)",
            }}
          />
          <div className="relative flex h-full flex-col justify-end" style={{ padding: "var(--space-5)", minHeight: "inherit" }}>
            <span
              className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/90"
              style={{ backgroundColor: "oklch(0 0 0 / 0.35)", backdropFilter: "blur(8px)", border: "1px solid oklch(1 0 0 / 0.15)" }}
            >
              <Sparkles className="h-3 w-3" /> {m.dashboard_free_plan()}
            </span>
            <h1
              className="font-display font-bold tracking-tight text-white"
              style={{ marginTop: "var(--space-3)", fontSize: "clamp(2rem, 5.5vw, var(--font-size-display))", lineHeight: 1.05 }}
            >
              Welcome back, @{username}
            </h1>
            <p className="text-white/80" style={{ marginTop: "var(--space-2)", fontSize: "var(--font-size-body)" }}>
              {subheading}
            </p>
            <div className="flex flex-wrap" style={{ marginTop: "var(--space-4)", gap: "var(--space-2)" }}>
              <Link
                to="/studio"
                className="inline-flex items-center gap-2 text-sm font-medium text-white"
                style={{
                  backgroundColor: "var(--action-primary)",
                  borderRadius: "var(--radius-md)",
                  paddingInline: "var(--space-4)",
                  paddingBlock: "var(--space-3)",
                }}
              >
                <Wand2 className="h-4 w-4" /> {hasActivity ? "Create new" : "Start creating"}
              </Link>
              <button
                onClick={signOut}
                className="inline-flex items-center gap-2 text-sm text-white/90 transition hover:text-white"
                style={{
                  border: "1px solid oklch(1 0 0 / 0.2)",
                  backgroundColor: "oklch(0 0 0 / 0.25)",
                  borderRadius: "var(--radius-md)",
                  paddingInline: "var(--space-4)",
                  paddingBlock: "var(--space-3)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <LogOut className="h-4 w-4" /> {m.nav_sign_out()}
              </button>
            </div>
          </div>
        </motion.section>

        {/* 3. Hero Metric + 4. Secondary Metrics */}
        <motion.section
          initial="hidden"
          animate="show"
          variants={metricContainerVariants}
          className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr]"
          style={{ marginTop: "var(--space-5)" }}
        >
          <HeroMetricCard
            label="Creations generated"
            value={primaryStat}
            icon={Rocket}
            accent="var(--color-magenta-500)"
            emptyCta={{ label: "Generate your first creation", to: "/studio" }}
          />
          <MetricCard
            label="Reach"
            value={reachStat}
            icon={Eye}
            accent="var(--color-magenta-500)"
            emptyHint="Publish to grow your reach"
          />
          <MetricCard
            label="Earnings"
            value={earningsStat}
            format="currency"
            icon={Coins}
            accent="var(--color-orange-500)"
            emptyHint="List a prompt to start earning"
          />
          <MetricCard
            label="Followers"
            value={followersStat}
            icon={Users2}
            accent="var(--color-gold-500)"
            emptyHint="Share your profile to gain followers"
          />
        </motion.section>

        {/* 5. Trend Chart + 6. Highlights */}
        <section
          className="grid gap-4 lg:grid-cols-[1.6fr_1fr]"
          style={{ marginTop: "var(--space-4)" }}
        >
          <TrendChartCard series={trendSeries} hasTrend={hasTrend} />
          <HighlightsCard highlights={highlights} hasHighlights={hasHighlights} />
        </section>

        {/* 7. Top Prompts + Quick Actions */}
        <section
          className="grid gap-4 lg:grid-cols-[1.6fr_1fr]"
          style={{ marginTop: "var(--space-4)" }}
        >
          <TopPromptsCard prompts={topPrompts} hasPrompts={hasPrompts} />
          <QuickActionsCard />
        </section>

      </main>
    </div>
  );
}

// ============================================================================
// Presentation components — pure, no data fetching.
// ============================================================================

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function HeroMetricCard({
  label, value, icon: Icon, accent, emptyCta,
}: {
  label: string;
  value: number | null;
  icon: typeof Rocket;
  accent: string;
  emptyCta: { label: string; to: string };
}) {
  const isEmpty = !value || value <= 0;
  return (
    <motion.div
      variants={metricItemVariants}
      className="surface-elevated relative overflow-hidden rounded-2xl"
      style={{ padding: "var(--space-5)" }}
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-25"
        style={{ background: `radial-gradient(90% 90% at 100% 0%, ${accent}, transparent 60%)` }}
      />
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: accent }} />
        <span style={{ fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}>{label}</span>
      </div>
      <div
        className="font-display font-bold text-foreground"
        style={{
          marginTop: "var(--space-3)",
          fontSize: "clamp(3rem, 7vw, var(--font-size-display))",
          lineHeight: 1,
          color: isEmpty ? "var(--text-primary)" : accent,
        }}
      >
        {isEmpty ? "0" : formatNumber(value!)}
      </div>
      {isEmpty ? (
        <Link
          to={emptyCta.to}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium"
          style={{ color: accent }}
        >
          {emptyCta.label} <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      ) : (
        <p style={{ marginTop: "var(--space-3)", fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}>
          Lifetime total
        </p>
      )}
    </motion.div>
  );
}

function MetricCard({
  label, value, icon: Icon, accent, emptyHint, format,
}: {
  label: string;
  value: number | null;
  icon: typeof Rocket;
  accent: string;
  emptyHint: string;
  format?: "currency";
}) {
  const isEmpty = value == null || value <= 0;
  const display = isEmpty
    ? (format === "currency" ? "$0" : "0")
    : (format === "currency" ? `$${formatNumber(value!)}` : formatNumber(value!));
  return (
    <motion.div
      variants={metricItemVariants}
      className="surface-raised rounded-2xl"
      style={{ padding: "var(--space-4)" }}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: accent }} />
        <span style={{ fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}>{label}</span>
      </div>
      <div
        className="font-display font-bold"
        style={{
          marginTop: "var(--space-3)",
          fontSize: "var(--font-size-h1)",
          color: isEmpty ? "var(--text-primary)" : accent,
          lineHeight: 1,
        }}
      >
        {display}
      </div>
      <p style={{ marginTop: "var(--space-2)", fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}>
        {isEmpty ? emptyHint : "Last 30 days"}
      </p>
    </motion.div>
  );
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      className="rounded-xl"
      style={{
        backgroundColor: "var(--surface-elevated)",
        border: "1px solid var(--border-default)",
        padding: "var(--space-3)",
        boxShadow: "0 12px 32px oklch(0 0 0 / 0.35)",
      }}
    >
      <div style={{ fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}>{label}</div>
      <div
        className="font-display font-semibold"
        style={{ marginTop: 4, fontSize: "var(--font-size-h3)", color: "var(--color-magenta-500)" }}
      >
        {formatNumber(payload[0].value)}
      </div>
    </div>
  );
}

function TrendChartCard({
  series, hasTrend,
}: {
  series: { day: string; value: number }[];
  hasTrend: boolean;
}) {
  return (
    <div className="surface-raised rounded-2xl" style={{ padding: "var(--space-5)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LineChartIcon className="h-4 w-4 text-magenta" />
          <h3 className="font-display text-lg font-semibold text-foreground">Render activity</h3>
        </div>
        {hasTrend && (
          <span className="rounded-full border border-border/60 bg-surface/60 px-2.5 py-0.5 text-[11px] text-muted-foreground">
            Last 30 days
          </span>
        )}
      </div>

      <div style={{ marginTop: "var(--space-4)", height: 260 }}>
        {hasTrend ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="dashTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.65 0.25 340)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="oklch(0.65 0.25 340)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" vertical={false} />
              <XAxis
                dataKey="day"
                stroke="oklch(1 0 0 / 0.4)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis stroke="oklch(1 0 0 / 0.4)" fontSize={11} tickLine={false} axisLine={false} width={30} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "oklch(0.65 0.25 340)", strokeWidth: 1, strokeDasharray: "3 3" }} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="oklch(0.72 0.22 340)"
                strokeWidth={2}
                fill="url(#dashTrendFill)"
                activeDot={{ r: 6, fill: "oklch(0.72 0.22 340)", stroke: "white", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div
            className="flex h-full flex-col items-center justify-center rounded-xl text-center"
            style={{
              border: "1px dashed var(--border-default)",
              backgroundColor: "var(--surface-tertiary)",
              padding: "var(--space-5)",
            }}
          >
            <div
              className="grid h-12 w-12 place-items-center rounded-full"
              style={{ backgroundColor: "var(--surface-glass)", border: "1px solid var(--border-default)" }}
            >
              <BarChart3 className="h-5 w-5 text-magenta" />
            </div>
            <p
              className="font-display font-semibold text-foreground"
              style={{ marginTop: "var(--space-3)", fontSize: "var(--font-size-h4)" }}
            >
              No render history yet
            </p>
            <p style={{ marginTop: "var(--space-2)", fontSize: "var(--font-size-caption)", color: "var(--text-muted)", maxWidth: 320 }}>
              Your analytics will appear here after your first generation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function HighlightsCard({
  highlights, hasHighlights,
}: {
  highlights: { title: string; body: string; icon: typeof Trophy }[];
  hasHighlights: boolean;
}) {
  const emptyItems = [
    { title: "Complete your first generation", body: "Open Studio and turn an idea into an image.", to: "/studio", icon: Wand2, accent: "var(--color-orange-500)" },
    { title: "Need inspiration?", body: "Browse community prompts to spark ideas.", to: "/explore", icon: Flame, accent: "var(--color-magenta-500)" },
    { title: "Set up your creator profile", body: "Add a bio and unlock earnings.", to: "/settings", icon: Trophy, accent: "var(--color-gold-500)" },
  ];

  return (
    <div className="surface-raised rounded-2xl" style={{ padding: "var(--space-5)" }}>
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-gold" />
        <h3 className="font-display text-lg font-semibold text-foreground">
          {hasHighlights ? "Highlights" : "Get started"}
        </h3>
      </div>
      <div className="flex flex-col" style={{ marginTop: "var(--space-4)", gap: "var(--space-2)" }}>
        {hasHighlights
          ? highlights.map((h) => (
              <div
                key={h.title}
                className="rounded-xl"
                style={{
                  padding: "var(--space-4)",
                  background: "linear-gradient(135deg, oklch(0.65 0.2 55 / 0.15), oklch(0.55 0.25 340 / 0.15))",
                  border: "1px solid var(--border-default)",
                }}
              >
                <div className="flex items-center gap-2">
                  <h.icon className="h-4 w-4 text-gold" />
                  <span className="text-sm font-medium text-foreground">{h.title}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{h.body}</p>
              </div>
            ))
          : emptyItems.map((item) => (
              <Link
                key={item.title}
                to={item.to}
                className="group flex items-start gap-3 rounded-xl transition hover:border-magenta/40"
                style={{
                  padding: "var(--space-3)",
                  border: "1px solid var(--border-default)",
                  backgroundColor: "var(--surface-tertiary)",
                }}
              >
                <div
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                  style={{ backgroundColor: "var(--surface-glass)", border: "1px solid var(--border-default)" }}
                >
                  <item.icon className="h-4 w-4" style={{ color: item.accent }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.body}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:text-magenta" />
              </Link>
            ))}
      </div>
    </div>
  );
}

function TopPromptsCard({
  prompts, hasPrompts,
}: {
  prompts: { id: string; title: string; value: number }[];
  hasPrompts: boolean;
}) {
  return (
    <div className="surface-raised rounded-2xl" style={{ padding: "var(--space-5)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-magenta" />
          <h3 className="font-display text-lg font-semibold text-foreground">Top performing prompts</h3>
        </div>
      </div>
      {hasPrompts ? (
        <ul className="flex flex-col" style={{ marginTop: "var(--space-4)", gap: "var(--space-2)" }}>
          {prompts.map((p, i) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-xl"
              style={{
                padding: "var(--space-3)",
                border: "1px solid var(--border-default)",
                backgroundColor: "var(--surface-tertiary)",
              }}
            >
              <span
                className="grid h-8 w-8 place-items-center rounded-lg font-display text-sm font-semibold"
                style={{ backgroundColor: "var(--surface-glass)", color: "var(--color-magenta-500)" }}
              >
                {i + 1}
              </span>
              <span className="flex-1 truncate text-sm text-foreground">{p.title}</span>
              <span className="text-sm font-medium" style={{ color: "var(--color-orange-500)" }}>
                {formatNumber(p.value)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div
          className="flex flex-col items-center rounded-xl text-center"
          style={{
            marginTop: "var(--space-4)",
            border: "1px dashed var(--border-default)",
            backgroundColor: "var(--surface-tertiary)",
            padding: "var(--space-5)",
          }}
        >
          <div
            className="grid h-12 w-12 place-items-center rounded-full"
            style={{ backgroundColor: "var(--surface-glass)", border: "1px solid var(--border-default)" }}
          >
            <Sparkles className="h-5 w-5 text-magenta" />
          </div>
          <p
            className="font-display font-semibold text-foreground"
            style={{ marginTop: "var(--space-3)", fontSize: "var(--font-size-h4)" }}
          >
            No prompts published yet
          </p>
          <p style={{ marginTop: "var(--space-2)", fontSize: "var(--font-size-caption)", color: "var(--text-muted)", maxWidth: 320 }}>
            Once you publish prompts, your top performers will land here.
          </p>
          <Link
            to="/studio"
            className="inline-flex items-center gap-2 text-sm font-medium text-white"
            style={{
              marginTop: "var(--space-4)",
              backgroundColor: "var(--action-primary)",
              borderRadius: "var(--radius-md)",
              paddingInline: "var(--space-4)",
              paddingBlock: "var(--space-2)",
            }}
          >
            <Plus className="h-4 w-4" /> Publish a prompt
          </Link>
        </div>
      )}
    </div>
  );
}

function QuickActionsCard() {
  const actions = [
    { label: "Create new", to: "/studio", icon: Wand2, accent: "var(--color-magenta-500)" },
    { label: "My prompts", to: "/dashboard", icon: LayoutGrid, accent: "var(--color-orange-500)" },
    { label: "Analytics", to: "/dashboard", icon: BarChart3, accent: "var(--color-magenta-500)" },
    { label: "Payouts", to: "/settings", icon: Wallet, accent: "var(--color-gold-500)" },
  ];
  return (
    <div className="surface-raised rounded-2xl" style={{ padding: "var(--space-5)" }}>
      <div className="flex items-center gap-2">
        <Rocket className="h-4 w-4 text-magenta" />
        <h3 className="font-display text-lg font-semibold text-foreground">Quick actions</h3>
      </div>
      <div className="grid grid-cols-2" style={{ marginTop: "var(--space-4)", gap: "var(--space-2)" }}>
        {actions.map((a) => (
          <Link
            key={a.label}
            to={a.to}
            className="group flex flex-col items-start rounded-xl transition hover:border-magenta/40"
            style={{
              padding: "var(--space-4)",
              border: "1px solid var(--border-default)",
              backgroundColor: "var(--surface-tertiary)",
              minHeight: 96,
            }}
          >
            <div
              className="grid h-8 w-8 place-items-center rounded-lg"
              style={{ backgroundColor: "var(--surface-glass)", border: "1px solid var(--border-default)" }}
            >
              <a.icon className="h-4 w-4" style={{ color: a.accent }} />
            </div>
            <span className="mt-3 text-sm font-medium text-foreground">{a.label}</span>
            <ArrowUpRight className="mt-1 h-3.5 w-3.5 text-muted-foreground transition group-hover:text-magenta" />
          </Link>
        ))}
      </div>
    </div>
  );
}
