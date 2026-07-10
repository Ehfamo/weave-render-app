import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { pageUrl } from "@/lib/seo";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell, ChevronDown, Sparkles, Box, Users, DollarSign, TrendingUp,
  Plus, BarChart3, LogOut, ArrowRight, Award, Star, Trophy,
} from "lucide-react";
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart,
} from "recharts";
import { motion } from "motion/react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import avatarImg from "@/assets/dashboard-avatar.jpg";
import cyberImg from "@/assets/dashboard-cyber.jpg";

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

const trendData = [
  { d: "May 15", v: 12000 }, { d: "May 16", v: 15000 }, { d: "May 17", v: 22000 },
  { d: "May 18", v: 18000 }, { d: "May 19", v: 30000 }, { d: "May 20", v: 34000 },
  { d: "May 21", v: 28000 }, { d: "May 22", v: 40000 }, { d: "May 23", v: 48000 },
  { d: "May 24", v: 42000 }, { d: "May 25", v: 52000 }, { d: "May 26", v: 60000 },
  { d: "May 27", v: 58000 }, { d: "May 28", v: 66000 }, { d: "May 29", v: 72000 },
  { d: "May 30", v: 68000 }, { d: "May 31", v: 78000 }, { d: "Jun 1", v: 84000 },
  { d: "Jun 2", v: 92000 }, { d: "Jun 3", v: 88000 }, { d: "Jun 4", v: 98000 },
  { d: "Jun 5", v: 105000 }, { d: "Jun 6", v: 108000 }, { d: "Jun 7", v: 112480 },
  { d: "Jun 8", v: 96000 }, { d: "Jun 9", v: 82000 }, { d: "Jun 10", v: 74000 },
  { d: "Jun 11", v: 70000 }, { d: "Jun 12", v: 68000 }, { d: "Jun 13", v: 66000 },
];

const spark = (seed: number) =>
  Array.from({ length: 14 }, (_, i) => ({
    x: i,
    y: 50 + Math.sin(i * 0.9 + seed) * 18 + Math.cos(i * 1.4 + seed) * 8,
  }));

const topPrompts = [
  { rank: "01", title: "Cyber Noir", views: "12.4k views", color: "#ff2d87", data: spark(1) },
  { rank: "02", title: "Velvet Dusk", views: "9.8k views", color: "#ff8a3d", data: spark(3) },
  { rank: "03", title: "Neon Reverie", views: "7.2k views", color: "#ff2d87", data: spark(5) },
];

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

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background:
          "radial-gradient(1200px 700px at 15% -10%, rgba(255,90,40,0.10), transparent 60%), radial-gradient(900px 700px at 95% 20%, rgba(255,45,135,0.10), transparent 60%), radial-gradient(1000px 800px at 50% 110%, rgba(140,50,220,0.10), transparent 60%), #08060a",
        fontFamily: "'InterVariable', Inter, system-ui, sans-serif",
      }}
    >
      <TopNav avatarUrl={avatarUrl} onSignOut={signOut} />
      <main className="mx-auto max-w-[1200px] px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <HeroSection username={username} avatarUrl={avatarUrl} />
        <StatsRow />
        <AnalyticsCard />
        <StudioHighlights />
        <BottomRow />
        <MilestoneBanner />
      </main>
    </div>
  );
}

function TopNav({ avatarUrl, onSignOut }: { avatarUrl: string; onSignOut: () => void }) {
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
          <button className="relative grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.03] transition hover:bg-white/[0.06]">
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#ff2d87] shadow-[0_0_8px_#ff2d87]" />
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

function HeroSection({ username, avatarUrl }: { username: string; avatarUrl: string }) {
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
          This is your
          <br />
          <span
            style={{
              background: "linear-gradient(90deg, #ff8a3d, #ff2d87)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            best
          </span>{" "}
          month yet.
          <Sparkles className="ml-2 inline h-8 w-8 text-[#ff8a3d]" />
        </h1>
        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
          <span className="inline-flex items-center gap-2 text-[#f5c76e]">
            <Trophy className="h-4 w-4" /> Top 3% globally
          </span>
          <span className="h-4 w-px bg-white/20" />
          <span className="text-white/60">Keep creating. You're inspiring millions.</span>
        </div>
      </div>
    </motion.section>
  );
}

function StatsRow() {
  return (
    <section className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
      <PrimaryStat />
      <SecondaryStat icon={Users} label="Creators reached" value="840k" delta="14%" color="#ff2d87" />
      <SecondaryStat icon={DollarSign} label="Earned this month" value="$12,480" delta="22%" color="#ff8a3d" />
      <SecondaryStat icon={Users} label="Followers" value="3.2k" delta="9%" color="#ff2d87" />
    </section>
  );
}

function PrimaryStat() {
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
        <span className="text-sm">Creations generated</span>
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
        2.1M
      </div>
      <p className="mt-2 text-sm">
        <span className="text-[#ff8a3d]">↗ 18%</span>{" "}
        <span className="text-white/50">vs last month</span>
      </p>
    </motion.div>
  );
}

function SecondaryStat({
  icon: Icon, label, value, delta, color,
}: {
  icon: typeof Users; label: string; value: string; delta: string; color: string;
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
        {value}
      </div>
      <p className="mt-2 text-xs">
        <span style={{ color: "#ff8a3d" }}>↗ {delta}</span>{" "}
        <span className="text-white/50">vs last month</span>
      </p>
    </motion.div>
  );
}

function AnalyticsCard() {
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
          <h3 className="text-xl font-semibold">Renders overview</h3>
          <p className="mt-1 text-sm text-white/50">Last 30 days</p>
        </div>
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#ff2d87] hover:opacity-90">
          View full analytics report <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-6 h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trendData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
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
              ticks={["May 15", "May 22", "May 29", "Jun 5", "Jun 12"]}
            />
            <YAxis
              stroke="rgba(255,255,255,0.35)" fontSize={11}
              tickLine={false} axisLine={false} width={44}
              tickFormatter={(v) => (v === 0 ? "0" : `${v / 1000}k`)}
              ticks={[0, 30000, 60000, 90000, 120000]}
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
      <div className="text-xs text-white/50">renders</div>
    </div>
  );
}

function StudioHighlights() {
  return (
    <section className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-xl font-semibold">
          <Sparkles className="h-5 w-5 text-[#ff8a3d]" /> Studio highlights
        </h2>
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-[#ff2d87]">
          View all highlights <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.7fr_1fr_1fr]">
        <TrendingCard />
        <AchievementCard />
        <RankCard />
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

function TrendingCard() {
  return (
    <HighlightShell glow="rgba(255,45,135,0.10)">
      <div className="grid grid-cols-[140px_1fr] gap-5 sm:grid-cols-[180px_1fr]">
        <div className="relative h-[200px] overflow-hidden rounded-2xl">
          <img src={cyberImg} alt="Cyber Noir" className="h-full w-full object-cover" loading="lazy" />
          <div className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/50 backdrop-blur">
            <TrendingUp className="h-4 w-4 text-[#ff2d87]" />
          </div>
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="inline-flex items-center gap-1.5 text-xs text-[#ff2d87]">
            <Sparkles className="h-3 w-3" /> Your prompt is trending
          </span>
          <h4 className="mt-2 text-2xl font-bold">Cyber Noir</h4>
          <p className="mt-2 text-sm text-white/60">
            Exploded this week and loved by the community.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-4 text-white">
            <MiniStat value="12.4k" label="views" />
            <MiniStat value="2.1k" label="uses" />
            <MiniStat value="18%" label="engagement" />
          </div>
          <div className="mt-auto flex items-center justify-between pt-4">
            <div className="flex gap-1.5">
              <span className="h-1 w-6 rounded-full bg-[#ff8a3d]" />
              <span className="h-1 w-6 rounded-full bg-white/15" />
              <span className="h-1 w-6 rounded-full bg-white/15" />
            </div>
            <button className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-[#ff2d87] transition hover:bg-white/[0.06]">
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
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

function AchievementCard() {
  return (
    <HighlightShell glow="rgba(255,138,61,0.14)">
      <div className="flex h-full flex-col">
        <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: "rgba(255,138,61,0.18)" }}>
          <Award className="h-4 w-4 text-[#ff8a3d]" />
        </span>
        <p className="mt-6 text-sm text-[#ff8a3d]">New achievement</p>
        <div
          className="mt-1 text-4xl font-extrabold"
          style={{
            background: "linear-gradient(180deg,#ff8a3d,#ff5a28)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          1M
        </div>
        <p className="mt-3 text-sm text-white/70">
          Total renders<br />milestone reached
        </p>
        <div className="mt-auto flex justify-end pt-4">
          <button className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-[#ff8a3d] transition hover:bg-white/[0.06]">
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </HighlightShell>
  );
}

function RankCard() {
  return (
    <HighlightShell glow="rgba(255,45,135,0.14)">
      <div className="flex h-full flex-col">
        <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: "rgba(255,45,135,0.18)" }}>
          <Sparkles className="h-4 w-4 text-[#ff2d87]" />
        </span>
        <p className="mt-6 text-sm text-white/70">You ranked up</p>
        <div
          className="mt-1 text-4xl font-extrabold"
          style={{
            background: "linear-gradient(180deg,#ff2d87,#c026d3)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Top 3%
        </div>
        <p className="mt-3 text-sm text-white/70">
          Among all creators<br />this month
        </p>
        <div className="mt-auto flex justify-end pt-4">
          <button className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-[#ff2d87] transition hover:bg-white/[0.06]">
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </HighlightShell>
  );
}

function BottomRow() {
  return (
    <section className="mt-6 grid gap-6 lg:grid-cols-2">
      <TopPromptsCard />
      <QuickActionsCard />
    </section>
  );
}

function TopPromptsCard() {
  return (
    <div className="rounded-[22px] p-6" style={{ background: "#100b0f", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Top performing prompts</h3>
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-[#ff2d87]">
          See all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <ul className="mt-5 divide-y divide-white/5">
        {topPrompts.map((p) => (
          <li key={p.rank} className="grid grid-cols-[28px_56px_1fr_120px] items-center gap-4 py-3">
            <span className="text-sm font-semibold text-[#ff2d87]">{p.rank}</span>
            <div className="h-12 w-14 overflow-hidden rounded-lg">
              <img src={cyberImg} alt={p.title} className="h-full w-full object-cover" loading="lazy" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{p.title}</p>
              <p className="text-xs text-white/50">{p.views}</p>
            </div>
            <div className="h-10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={p.data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                  <Line type="monotone" dataKey="y" stroke={p.color} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuickActionsCard() {
  const actions = [
    { icon: Plus, title: "Create new", desc: "Start from scratch", color: "#ff2d87", to: "/studio" as const },
    { icon: Box, title: "View my prompts", desc: "Manage your library", color: "#ff8a3d", to: "/dashboard" as const },
    { icon: BarChart3, title: "Analytics report", desc: "Deep dive insights", color: "#ff2d87", to: "/dashboard" as const },
    { icon: DollarSign, title: "Payouts", desc: "View earnings", color: "#ff8a3d", to: "/dashboard" as const },
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

function MilestoneBanner() {
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
            <p className="font-semibold">You reached 2 new milestones this month</p>
            <p className="text-sm text-white/50">Keep going — your journey is just getting started.</p>
          </div>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-[#ff8a3d]/50 px-5 py-2.5 text-sm font-medium text-[#ff8a3d] transition hover:bg-[#ff8a3d]/10"
        >
          See milestones <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </motion.section>
  );
}
