import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { pageUrl } from "@/lib/seo";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell, ChevronDown, Sparkles, Box, Users, DollarSign, TrendingUp,
  Plus, BarChart3, LogOut, ArrowRight, Award, Star, Trophy, AlertCircle, Eye,
} from "lucide-react";
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart,
} from "recharts";
import { motion } from "motion/react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import avatarImg from "@/assets/dashboard-avatar.jpg";

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
};

type CreatorStats = {
  user_id: string | null;
  prompt_count: number | null;
  published_count: number | null;
  followers_count: number | null;
  following_count: number | null;
  likes_count: number | null;
  views_count: number | null;
};

type TopPrompt = {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  views: number;
  spark: { x: number; y: number }[];
};

type DashboardData = {
  stats: CreatorStats | null;
  earnedCents: number;
  earnedCentsPrev: number;
  unreadCount: number;
  trend: { d: string; v: number }[];
  totalViews30d: number;
  topPrompts: TopPrompt[];
};

const TOP_COLORS = ["#ff2d87", "#ff8a3d", "#ff2d87"];
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatCompact(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

function formatMoney(cents: number) {
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: dollars >= 100 ? 0 : 2 });
}

function pctDelta(curr: number, prev: number): string | null {
  if (prev <= 0) return null;
  const p = ((curr - prev) / prev) * 100;
  if (!Number.isFinite(p)) return null;
  const sign = p >= 0 ? "↗" : "↘";
  return `${sign} ${Math.abs(p).toFixed(0)}%`;
}

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
        .from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });

  const dashboardQ = useQuery<DashboardData>({
    queryKey: ["dashboard", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const uid = user!.id;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const since30 = new Date(Date.now() - 30 * DAY_MS).toISOString();

      const [statsRes, earnCurrRes, earnPrevRes, unreadRes, promptsRes] = await Promise.all([
        supabase.from("creator_stats").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("earnings").select("amount_cents").eq("user_id", uid).eq("status", "paid").gte("occurred_at", monthStart),
        supabase.from("earnings").select("amount_cents").eq("user_id", uid).eq("status", "paid").gte("occurred_at", prevMonthStart).lt("occurred_at", monthStart),
        supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", uid).is("read_at", null),
        supabase.from("prompts").select("id, title, slug, cover_url").eq("author_id", uid),
      ]);

      if (statsRes.error) throw statsRes.error;
      if (earnCurrRes.error) throw earnCurrRes.error;
      if (earnPrevRes.error) throw earnPrevRes.error;
      if (unreadRes.error) throw unreadRes.error;
      if (promptsRes.error) throw promptsRes.error;

      const prompts = promptsRes.data ?? [];
      const promptIds = prompts.map((p) => p.id);

      let views: { created_at: string; prompt_id: string }[] = [];
      if (promptIds.length) {
        const { data, error } = await supabase
          .from("prompt_views")
          .select("created_at, prompt_id")
          .in("prompt_id", promptIds)
          .gte("created_at", since30);
        if (error) throw error;
        views = data ?? [];
      }

      // Bucket views by day (30d trend) and per prompt
      const today = startOfDay(now).getTime();
      const dayBuckets: number[] = Array(30).fill(0);
      const perPromptDay = new Map<string, number[]>();
      for (const id of promptIds) perPromptDay.set(id, Array(14).fill(0));

      for (const v of views) {
        const t = startOfDay(new Date(v.created_at)).getTime();
        const idx30 = 29 - Math.floor((today - t) / DAY_MS);
        if (idx30 >= 0 && idx30 < 30) dayBuckets[idx30] += 1;
        const idx14 = 13 - Math.floor((today - t) / DAY_MS);
        if (idx14 >= 0 && idx14 < 14) {
          const arr = perPromptDay.get(v.prompt_id);
          if (arr) arr[idx14] += 1;
        }
      }

      const trend = dayBuckets.map((v, i) => {
        const d = new Date(today - (29 - i) * DAY_MS);
        return { d: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), v };
      });

      // Per-prompt totals (last 30d)
      const perPromptTotal = new Map<string, number>();
      for (const v of views) perPromptTotal.set(v.prompt_id, (perPromptTotal.get(v.prompt_id) ?? 0) + 1);

      const topPrompts: TopPrompt[] = prompts
        .map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          cover_url: p.cover_url,
          views: perPromptTotal.get(p.id) ?? 0,
          spark: (perPromptDay.get(p.id) ?? Array(14).fill(0)).map((y, x) => ({ x, y })),
        }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 3);

      const earnedCents = (earnCurrRes.data ?? []).reduce((s, r) => s + (r.amount_cents ?? 0), 0);
      const earnedCentsPrev = (earnPrevRes.data ?? []).reduce((s, r) => s + (r.amount_cents ?? 0), 0);

      return {
        stats: (statsRes.data as CreatorStats | null) ?? null,
        earnedCents,
        earnedCentsPrev,
        unreadCount: unreadRes.count ?? 0,
        trend,
        totalViews30d: views.length,
        topPrompts,
      };
    },
  });

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#08060a] text-sm text-white/50">
        Loading…
      </div>
    );
  }

  const username = profile?.username || user.email?.split("@")[0] || "nocturne";
  const avatarUrl = profile?.avatar_url || avatarImg;

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  const d = dashboardQ.data;
  const isLoading = dashboardQ.isLoading;
  const isError = dashboardQ.isError;

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background:
          "radial-gradient(1200px 700px at 15% -10%, rgba(255,90,40,0.10), transparent 60%), radial-gradient(900px 700px at 95% 20%, rgba(255,45,135,0.10), transparent 60%), radial-gradient(1000px 800px at 50% 110%, rgba(140,50,220,0.10), transparent 60%), #08060a",
        fontFamily: "'InterVariable', Inter, system-ui, sans-serif",
      }}
    >
      <TopNav avatarUrl={avatarUrl} onSignOut={signOut} unreadCount={d?.unreadCount ?? 0} />
      <main className="mx-auto max-w-[1200px] px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <HeroSection username={username} avatarUrl={avatarUrl} totalViews={d?.stats?.views_count ?? 0} />
        {isError ? (
          <ErrorBanner onRetry={() => dashboardQ.refetch()} />
        ) : null}
        <StatsRow loading={isLoading} data={d} />
        <AnalyticsCard loading={isLoading} trend={d?.trend ?? []} total={d?.totalViews30d ?? 0} />
        <StudioHighlights loading={isLoading} top={d?.topPrompts ?? []} stats={d?.stats ?? null} />
        <BottomRow loading={isLoading} top={d?.topPrompts ?? []} />
        <MilestoneBanner stats={d?.stats ?? null} />
      </main>
    </div>
  );
}

function TopNav({ avatarUrl, onSignOut, unreadCount }: { avatarUrl: string; onSignOut: () => void; unreadCount: number }) {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl" style={{ background: "rgba(8,6,10,0.55)" }}>
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Link to="/" className="text-2xl font-bold tracking-tight">
          Xeom<span style={{ color: "#ff2d87" }}>X</span>
        </Link>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.06]">
            This Month <ChevronDown className="h-4 w-4" />
          </button>
          <button
            className="relative grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.03] transition hover:bg-white/[0.06]"
            aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 ? (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#ff2d87] shadow-[0_0_8px_#ff2d87]" />
            ) : null}
          </button>
          <Link
            to="/profile-edit"
            className="relative block h-10 w-10 overflow-hidden rounded-full ring-2 ring-[#ff8a3d]/70"
            title="Edit profile"
          >
            <img src={avatarUrl} alt="You" className="h-full w-full object-cover" />
          </Link>
          <button
            onClick={onSignOut}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.03] transition hover:bg-white/[0.06]"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

function HeroSection({ username, avatarUrl, totalViews }: { username: string; avatarUrl: string; totalViews: number }) {
  const hasReach = totalViews > 0;
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-start gap-8 pt-4 sm:flex-row sm:items-start sm:gap-10"
    >
      <div className="relative shrink-0">
        <div
          className="absolute -inset-3 rounded-full opacity-70 blur-2xl"
          style={{ background: "radial-gradient(circle, #ff5a28 0%, transparent 70%)" }}
        />
        <div
          className="relative h-[168px] w-[168px] overflow-hidden rounded-full"
          style={{ boxShadow: "0 0 0 2px #ff5a28, 0 0 40px rgba(255,90,40,0.55)" }}
        >
          <img src={avatarUrl} alt={username} className="h-full w-full object-cover" width={336} height={336} />
        </div>
        <div
          className="absolute -bottom-1 right-2 grid h-11 w-11 place-items-center"
          style={{
            clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
            background: "linear-gradient(135deg, #ff8a3d, #ff5a28)",
          }}
        >
          <Star className="h-5 w-5 fill-black text-black" />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-lg text-white/60">Welcome back, @{username}</p>
        <h1
          className="mt-2 font-bold leading-[0.98] tracking-tight"
          style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)" }}
        >
          {hasReach ? (
            <>
              Your creative
              <br />
              <span
                style={{
                  background: "linear-gradient(90deg, #ff8a3d, #ff2d87)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                studio
              </span>{" "}
              awaits.
              <Sparkles className="ml-2 inline h-8 w-8 text-[#ff8a3d]" />
            </>
          ) : (
            <>
              Start your
              <br />
              <span
                style={{
                  background: "linear-gradient(90deg, #ff8a3d, #ff2d87)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                first
              </span>{" "}
              creation.
              <Sparkles className="ml-2 inline h-8 w-8 text-[#ff8a3d]" />
            </>
          )}
        </h1>
        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
          {hasReach ? (
            <>
              <span className="inline-flex items-center gap-2 text-[#f5c76e]">
                <Trophy className="h-4 w-4" /> {formatCompact(totalViews)} lifetime views
              </span>
              <span className="h-4 w-px bg-white/20" />
              <span className="text-white/60">Keep creating — your audience is growing.</span>
            </>
          ) : (
            <span className="text-white/60">Publish a prompt to start tracking your reach.</span>
          )}
        </div>
      </div>
    </motion.section>
  );
}

function StatsRow({ loading, data }: { loading: boolean; data: DashboardData | undefined }) {
  const earnDelta = data ? pctDelta(data.earnedCents, data.earnedCentsPrev) : null;
  return (
    <section className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
      <PrimaryStat loading={loading} value={data?.stats?.prompt_count ?? 0} />
      <SecondaryStat loading={loading} icon={Eye} label="Views (30d)" value={formatCompact(data?.totalViews30d ?? 0)} color="#ff2d87" />
      <SecondaryStat loading={loading} icon={DollarSign} label="Earned this month" value={formatMoney(data?.earnedCents ?? 0)} delta={earnDelta} color="#ff8a3d" />
      <SecondaryStat loading={loading} icon={Users} label="Followers" value={formatCompact(data?.stats?.followers_count ?? 0)} color="#ff2d87" />
    </section>
  );
}

function PrimaryStat({ loading, value }: { loading: boolean; value: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.05 }}
    >
      <div className="flex items-center gap-2 text-white/70">
        <span
          className="grid h-7 w-7 place-items-center rounded-md"
          style={{ border: "1px solid rgba(255,138,61,0.4)", color: "#ff8a3d" }}
        >
          <Box className="h-3.5 w-3.5" />
        </span>
        <span className="text-sm">Prompts created</span>
      </div>
      <div
        className="mt-3 font-extrabold tracking-tight"
        style={{
          fontSize: "clamp(4rem, 10vw, 8rem)",
          lineHeight: 0.9,
          background: "linear-gradient(180deg, #ff8a3d 0%, #ff2d87 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          filter: "drop-shadow(0 6px 30px rgba(255,90,40,0.35))",
        }}
      >
        {loading ? <SkeletonBox className="h-[6rem] w-40" /> : formatCompact(value)}
      </div>
      <p className="mt-2 text-sm text-white/50">
        {loading ? <SkeletonBox className="h-4 w-32" /> : value > 0 ? "Across your library" : "No prompts yet"}
      </p>
    </motion.div>
  );
}

function SecondaryStat({
  icon: Icon, label, value, delta, color, loading,
}: {
  icon: typeof Users; label: string; value: string; delta?: string | null; color: string; loading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="lg:border-l lg:border-white/10 lg:pl-6"
    >
      <span
        className="grid h-9 w-9 place-items-center rounded-full"
        style={{ background: `${color}22`, color }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-3 text-sm text-white/60">{label}</p>
      <div className="mt-1 text-3xl font-bold tracking-tight" style={{ color }}>
        {loading ? <SkeletonBox className="h-8 w-20" /> : value}
      </div>
      <p className="mt-2 text-xs">
        {loading ? (
          <SkeletonBox className="h-3 w-24" />
        ) : delta ? (
          <>
            <span style={{ color: "#ff8a3d" }}>{delta}</span>{" "}
            <span className="text-white/50">vs last month</span>
          </>
        ) : (
          <span className="text-white/40">No comparison data</span>
        )}
      </p>
    </motion.div>
  );
}

function AnalyticsCard({ loading, trend, total }: { loading: boolean; trend: { d: string; v: number }[]; total: number }) {
  const ticks = useMemo(() => {
    if (trend.length < 5) return undefined;
    const step = Math.floor(trend.length / 4);
    return [0, step, step * 2, step * 3, trend.length - 1].map((i) => trend[i]?.d).filter(Boolean) as string[];
  }, [trend]);
  const hasData = total > 0;
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5 }}
      className="mt-8 rounded-[28px] p-6 sm:p-8"
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold">Views overview</h3>
          <p className="mt-1 text-sm text-white/50">Last 30 days</p>
        </div>
        <Link to="/studio" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#ff2d87] hover:opacity-90">
          Open studio <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-6 h-[280px]">
        {loading ? (
          <SkeletonBox className="h-full w-full rounded-2xl" />
        ) : !hasData ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="renderFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff5a28" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#ff2d87" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="renderStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ff8a3d" />
                  <stop offset="100%" stopColor="#ff2d87" />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="d" stroke="rgba(255,255,255,0.35)" fontSize={11}
                tickLine={false} axisLine={false}
                ticks={ticks}
              />
              <YAxis
                stroke="rgba(255,255,255,0.35)" fontSize={11}
                tickLine={false} axisLine={false} width={44}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ stroke: "rgba(255,138,61,0.5)", strokeDasharray: "3 3" }}
                content={<RenderTip />}
              />
              <Area
                type="monotone" dataKey="v"
                stroke="url(#renderStroke)" strokeWidth={2.5}
                fill="url(#renderFill)"
                activeDot={{ r: 7, fill: "#ff8a3d", stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.section>
  );
}

function RenderTip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ value: number }>; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{ background: "#141014", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}
    >
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-1 text-lg font-semibold">{payload[0].value.toLocaleString()}</div>
      <div className="text-xs text-white/50">views</div>
    </div>
  );
}

function StudioHighlights({ loading, top, stats }: { loading: boolean; top: TopPrompt[]; stats: CreatorStats | null }) {
  return (
    <section className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-xl font-semibold">
          <Sparkles className="h-5 w-5 text-[#ff8a3d]" /> Studio highlights
        </h2>
        <Link to="/explore" className="inline-flex items-center gap-1.5 text-sm text-[#ff2d87]">
          Explore <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.7fr_1fr_1fr]">
        <TrendingCard loading={loading} top={top[0]} />
        <AchievementCard loading={loading} stats={stats} />
        <FollowersCard loading={loading} stats={stats} />
      </div>
    </section>
  );
}

function HighlightShell({ children, glow }: { children: React.ReactNode; glow: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-[22px] p-5"
      style={{
        background: `radial-gradient(120% 100% at 100% 0%, ${glow}, transparent 60%), #100b0f`,
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {children}
    </div>
  );
}

function TrendingCard({ loading, top }: { loading: boolean; top: TopPrompt | undefined }) {
  return (
    <HighlightShell glow="rgba(255,45,135,0.10)">
      {loading ? (
        <SkeletonBox className="h-[200px] w-full rounded-2xl" />
      ) : !top || top.views === 0 ? (
        <div className="flex h-[200px] flex-col items-start justify-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: "rgba(255,45,135,0.18)" }}>
            <TrendingUp className="h-4 w-4 text-[#ff2d87]" />
          </span>
          <div>
            <p className="text-lg font-semibold">No trending prompt yet</p>
            <p className="mt-1 text-sm text-white/60">Publish a prompt to start collecting views.</p>
          </div>
          <Link to="/studio" className="mt-1 inline-flex items-center gap-1.5 text-sm text-[#ff2d87]">
            Create prompt <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-[140px_1fr] gap-5 sm:grid-cols-[180px_1fr]">
          <div className="relative h-[200px] overflow-hidden rounded-2xl bg-white/[0.03]">
            {top.cover_url ? (
              <img src={top.cover_url} alt={top.title} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="grid h-full w-full place-items-center text-white/30">
                <Box className="h-8 w-8" />
              </div>
            )}
            <div className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/50 backdrop-blur">
              <TrendingUp className="h-4 w-4 text-[#ff2d87]" />
            </div>
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="inline-flex items-center gap-1.5 text-xs text-[#ff2d87]">
              <Sparkles className="h-3 w-3" /> Your top prompt (30d)
            </span>
            <h4 className="mt-2 truncate text-2xl font-bold">{top.title}</h4>
            <p className="mt-2 text-sm text-white/60">
              Leading your library in views this month.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 text-white">
              <MiniStat value={formatCompact(top.views)} label="views (30d)" />
            </div>
            <div className="mt-auto flex items-center justify-end pt-4">
              <Link
                to="/prompt/$id"
                params={{ id: top.slug }}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-[#ff2d87] transition hover:bg-white/[0.06]"
              >
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </HighlightShell>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-white/50">{label}</div>
    </div>
  );
}

function AchievementCard({ loading, stats }: { loading: boolean; stats: CreatorStats | null }) {
  const likes = stats?.likes_count ?? 0;
  return (
    <HighlightShell glow="rgba(255,138,61,0.14)">
      <div className="flex h-full flex-col">
        <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: "rgba(255,138,61,0.18)" }}>
          <Award className="h-4 w-4 text-[#ff8a3d]" />
        </span>
        <p className="mt-6 text-sm text-[#ff8a3d]">Total likes</p>
        <div
          className="mt-1 text-4xl font-extrabold"
          style={{
            background: "linear-gradient(180deg,#ff8a3d,#ff5a28)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {loading ? <SkeletonBox className="h-10 w-24" /> : formatCompact(likes)}
        </div>
        <p className="mt-3 text-sm text-white/70">
          {likes > 0 ? <>Across your<br />published prompts</> : <>No likes yet —<br />share your work</>}
        </p>
        <div className="mt-auto flex justify-end pt-4">
          <Link to="/explore" className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-[#ff8a3d] transition hover:bg-white/[0.06]">
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </HighlightShell>
  );
}

function FollowersCard({ loading, stats }: { loading: boolean; stats: CreatorStats | null }) {
  const followers = stats?.followers_count ?? 0;
  return (
    <HighlightShell glow="rgba(255,45,135,0.14)">
      <div className="flex h-full flex-col">
        <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: "rgba(255,45,135,0.18)" }}>
          <Users className="h-4 w-4 text-[#ff2d87]" />
        </span>
        <p className="mt-6 text-sm text-white/70">Followers</p>
        <div
          className="mt-1 text-4xl font-extrabold"
          style={{
            background: "linear-gradient(180deg,#ff2d87,#c026d3)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {loading ? <SkeletonBox className="h-10 w-24" /> : formatCompact(followers)}
        </div>
        <p className="mt-3 text-sm text-white/70">
          {followers > 0 ? <>Creators watching<br />your work</> : <>Grow your reach —<br />share your profile</>}
        </p>
        <div className="mt-auto flex justify-end pt-4">
          <Link to="/creators" className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-[#ff2d87] transition hover:bg-white/[0.06]">
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </HighlightShell>
  );
}

function BottomRow({ loading, top }: { loading: boolean; top: TopPrompt[] }) {
  return (
    <section className="mt-6 grid gap-6 lg:grid-cols-2">
      <TopPromptsCard loading={loading} top={top} />
      <QuickActionsCard />
    </section>
  );
}

function TopPromptsCard({ loading, top }: { loading: boolean; top: TopPrompt[] }) {
  const items = top.filter((p) => p.views > 0);
  return (
    <div className="rounded-[22px] p-6" style={{ background: "#100b0f", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Top performing prompts</h3>
        <Link to="/explore" className="inline-flex items-center gap-1.5 text-sm text-[#ff2d87]">
          Explore <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {loading ? (
        <ul className="mt-5 space-y-3">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <SkeletonBox className="h-12 w-full" />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-8 text-center">
          <p className="text-sm text-white/60">No prompt views in the last 30 days yet.</p>
          <Link to="/studio" className="mt-3 inline-flex items-center gap-1.5 text-sm text-[#ff2d87]">
            Publish your first prompt <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-white/5">
          {items.map((p, idx) => (
            <li key={p.id} className="grid grid-cols-[28px_56px_1fr_120px] items-center gap-4 py-3">
              <span className="text-sm font-semibold text-[#ff2d87]">{String(idx + 1).padStart(2, "0")}</span>
              <div className="h-12 w-14 overflow-hidden rounded-lg bg-white/[0.04]">
                {p.cover_url ? (
                  <img src={p.cover_url} alt={p.title} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-white/30">
                    <Box className="h-4 w-4" />
                  </div>
                )}
              </div>
              <Link to="/prompt/$id" params={{ id: p.slug }} className="min-w-0">
                <p className="truncate font-medium hover:text-[#ff8a3d]">{p.title}</p>
                <p className="text-xs text-white/50">{formatCompact(p.views)} views (30d)</p>
              </Link>
              <div className="h-10">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={p.spark} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                    <Line type="monotone" dataKey="y" stroke={TOP_COLORS[idx % TOP_COLORS.length]} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuickActionsCard() {
  const actions = [
    { icon: Plus, title: "Create new", desc: "Start from scratch", color: "#ff2d87", to: "/studio" as const },
    { icon: Box, title: "Browse explore", desc: "Discover prompts", color: "#ff8a3d", to: "/explore" as const },
    { icon: BarChart3, title: "Edit profile", desc: "Update your account", color: "#ff2d87", to: "/profile-edit" as const },
    { icon: DollarSign, title: "Pricing", desc: "Upgrade your plan", color: "#ff8a3d", to: "/pricing" as const },
  ];
  return (
    <div className="rounded-[22px] p-6" style={{ background: "#100b0f", border: "1px solid rgba(255,255,255,0.06)" }}>
      <h3 className="text-lg font-semibold">Quick actions</h3>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {actions.map((a) => (
          <Link
            key={a.title}
            to={a.to}
            className="group flex items-center gap-3 rounded-2xl p-4 transition hover:bg-white/[0.03]"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <span
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
              style={{ background: `${a.color}22`, color: a.color }}
            >
              <a.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{a.title}</p>
              <p className="truncate text-xs text-white/50">{a.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function MilestoneBanner({ stats }: { stats: CreatorStats | null }) {
  const published = stats?.published_count ?? 0;
  const views = stats?.views_count ?? 0;
  const hasWork = published > 0;
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="mt-6 rounded-[22px] p-[1px]"
      style={{ background: "linear-gradient(90deg, #ff8a3d, #ff2d87, #c026d3)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[21px] px-6 py-5" style={{ background: "#100b0f" }}>
        <div className="flex items-center gap-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: "rgba(255,138,61,0.15)" }}>
            <Sparkles className="h-5 w-5 text-[#ff8a3d]" />
          </span>
          <div>
            <p className="font-semibold">
              {hasWork
                ? `${formatCompact(published)} published · ${formatCompact(views)} lifetime views`
                : "Ready to publish your first prompt?"}
            </p>
            <p className="text-sm text-white/50">
              {hasWork ? "Keep going — momentum compounds." : "Head to the studio to get started."}
            </p>
          </div>
        </div>
        <Link
          to="/studio"
          className="inline-flex items-center gap-2 rounded-full border border-[#ff8a3d]/50 px-5 py-2.5 text-sm font-medium text-[#ff8a3d] transition hover:bg-[#ff8a3d]/10"
        >
          Open studio <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </motion.section>
  );
}

function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-pulse rounded-md bg-white/10 align-middle ${className}`}
      aria-hidden="true"
    />
  );
}

function EmptyChart() {
  return (
    <div className="grid h-full w-full place-items-center rounded-2xl border border-dashed border-white/10">
      <div className="text-center">
        <p className="text-sm font-medium text-white/70">No views in the last 30 days</p>
        <p className="mt-1 text-xs text-white/40">Publish and share a prompt to start collecting data.</p>
        <Link to="/studio" className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#ff2d87]">
          Open studio <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function ErrorBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4"
      style={{ background: "rgba(255,45,45,0.08)", border: "1px solid rgba(255,45,45,0.3)" }}
    >
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-[#ff6b6b]" />
        <div>
          <p className="text-sm font-medium">We couldn't load your dashboard data.</p>
          <p className="text-xs text-white/60">Check your connection and try again.</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-white/[0.06]"
      >
        Retry
      </button>
    </div>
  );
}
