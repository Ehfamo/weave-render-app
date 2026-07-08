import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { pageUrl } from "@/lib/seo";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bookmark, Heart, Sparkles, TrendingUp, Plus, LogOut,
  Copy, ShoppingBag, Tag, Hexagon, Wallet, Crown,
  Clock, ChevronRight, Zap, Image, BookOpen, Users
} from "lucide-react";
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

const COMING_SOON_FEATURES = [
  { icon: Hexagon, labelKey: "feature_nft" as const, descKey: "feature_nft_desc" as const, color: "text-gold" },
  { icon: Wallet, labelKey: "feature_wallet" as const, descKey: "feature_wallet_desc" as const, color: "text-magenta" },
  { icon: Users, labelKey: "feature_social" as const, descKey: "feature_social_desc" as const, color: "text-blue-400" },
  { icon: BookOpen, labelKey: "feature_magazine" as const, descKey: "feature_magazine_desc" as const, color: "text-green-400" },
  { icon: Image, labelKey: "feature_model_hub" as const, descKey: "feature_model_hub_desc" as const, color: "text-purple-400" },
  { icon: Zap, labelKey: "feature_prompt_marketing" as const, descKey: "feature_prompt_marketing_desc" as const, color: "text-orange-400" },
];

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
  const avatar = profile?.avatar_url || user.user_metadata?.avatar_url;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-[1400px] px-4 py-10 sm:px-8">

        {/* Profile Hero */}
        <motion.section
          initial="hidden"
          animate="show"
          variants={metricContainerVariants}
          className="surface-elevated relative overflow-hidden flex flex-col rounded-3xl sm:flex-row sm:items-center"
          style={{ gap: "var(--space-5)", padding: "var(--space-5)" }}
        >
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-30"
            style={{
              background: "radial-gradient(ellipse 60% 80% at 0% 50%, oklch(0.45 0.25 340 / 0.4), transparent 70%)",
            }}
          />
          <motion.div variants={metricItemVariants} className="flex items-center" style={{ gap: "var(--space-4)" }}>
            {avatar ? (
              <img
                src={avatar}
                alt={displayName}
                className="h-20 w-20 rounded-full border-2 border-magenta/40 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="grid h-20 w-20 place-items-center rounded-full text-2xl font-semibold text-white" style={{ background: "var(--gradient-magenta)" }}>
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <h1
                className="font-display font-bold tracking-tight text-foreground"
                style={{ fontSize: "clamp(2rem, 5vw, var(--font-size-display))", lineHeight: 1 }}
              >
                {displayName}
              </h1>
              <p style={{ marginTop: "var(--space-2)", fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}>
                {profile?.username ? `@${profile.username}` : user.email}
              </p>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] text-muted-foreground"
                style={{ marginTop: "var(--space-2)", border: "1px solid var(--border-default)", backgroundColor: "var(--surface-glass)" }}
              >
                <Sparkles className="h-3 w-3 text-magenta" /> {m.dashboard_free_plan()}
              </span>
            </div>
          </motion.div>
          <motion.div variants={metricItemVariants} className="flex flex-wrap sm:ms-auto" style={{ gap: "var(--space-2)" }}>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-white"
              style={{
                backgroundColor: "var(--action-primary)",
                borderRadius: "var(--radius-sm)",
                paddingInline: "var(--space-4)",
                paddingBlock: "var(--space-2)",
              }}
            >
              <Plus className="h-4 w-4" /> {m.dashboard_publish_prompt()}
            </Link>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 text-sm text-foreground transition hover:border-magenta/40"
              style={{
                border: "1px solid var(--border-default)",
                backgroundColor: "var(--surface-glass)",
                borderRadius: "var(--radius-sm)",
                paddingInline: "var(--space-4)",
                paddingBlock: "var(--space-2)",
              }}
            >
              <LogOut className="h-4 w-4" /> {m.nav_sign_out()}
            </button>
          </motion.div>
        </motion.section>

        {/* Main Stats */}
        <motion.section
          initial="hidden"
          animate="show"
          variants={metricContainerVariants}
          className="grid grid-cols-2 sm:grid-cols-4"
          style={{ marginTop: "var(--space-5)", gap: "var(--space-3)" }}
        >
          {[
            { label: m.dashboard_stat_copied(), value: 0, icon: Copy, color: "var(--color-magenta-500)" },
            { label: m.dashboard_stat_bought(), value: 0, icon: ShoppingBag, color: "var(--color-orange-500)" },
            { label: m.dashboard_stat_sold(), value: 0, icon: Tag, color: "var(--color-success)" },
            { label: m.dashboard_stat_nfts(), value: 0, icon: Hexagon, color: "var(--color-gold-500)" },
          ].map((s) => (
            <motion.div
              key={s.label}
              variants={metricItemVariants}
              className="surface-raised rounded-2xl"
              style={{ padding: "var(--space-4)" }}
            >
              <s.icon className="h-4 w-4" style={{ color: s.color }} />
              <div
                className="font-display font-bold text-foreground"
                style={{ marginTop: "var(--space-3)", fontSize: "var(--font-size-h2)", color: s.color }}
              >
                {s.value}
              </div>
              <div style={{ fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}>{s.label}</div>
            </motion.div>
          ))}
        </motion.section>

        {/* Subscription & Wallet */}
        <section
          className="grid sm:grid-cols-2"
          style={{ marginTop: "var(--space-4)", gap: "var(--space-4)" }}
        >

          {/* Subscription Card */}
          <div className="surface-raised rounded-2xl" style={{ padding: "var(--space-5)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-gold" />
                <span className="text-sm font-medium text-foreground">{m.dashboard_subscription()}</span>
              </div>
              <span className="rounded-full border border-border/60 bg-surface/60 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                {m.common_free()}
              </span>
            </div>
            <div className="mt-4">
              <p className="text-xs text-muted-foreground">{m.dashboard_no_active_sub()}</p>
              <div className="mt-3 h-1.5 w-full rounded-full bg-border/40">
                <div className="h-1.5 w-0 rounded-full" style={{ background: "var(--gradient-magenta)" }} />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{m.dashboard_days_remaining()}</p>
            </div>
            <Link
              to="/auth"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white"
              style={{ background: "var(--gradient-gold)", color: "oklch(0.18 0.02 60)" }}
            >
              <Crown className="h-3.5 w-3.5" /> {m.dashboard_upgrade_pro()}
            </Link>
          </div>

          {/* Wallet Card */}
          <div className="surface-raised rounded-2xl" style={{ padding: "var(--space-5)" }}>
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-magenta" />
              <span className="text-sm font-medium text-foreground">{m.dashboard_wallet()}</span>
              <span className="ms-auto rounded-full border border-magenta/30 bg-magenta/10 px-2.5 py-0.5 text-[11px] text-magenta">
                {m.common_coming_soon()}
              </span>
            </div>
            <div className="mt-4">
              <p
                className="font-display font-bold"
                style={{ fontSize: "var(--font-size-h2)", color: "var(--color-orange-500)" }}
              >
                $0.00
              </p>
              <p className="text-xs text-muted-foreground">{m.dashboard_total_earnings()}</p>
            </div>
            <div className="mt-4 grid grid-cols-2" style={{ gap: "var(--space-2)" }}>
              <div className="rounded-xl p-3" style={{ backgroundColor: "var(--surface-tertiary)" }}>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{m.dashboard_pending()}</p>
                <p className="mt-1 font-display text-lg">$0.00</p>
              </div>
              <div className="rounded-xl p-3" style={{ backgroundColor: "var(--surface-tertiary)" }}>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{m.dashboard_withdrawn()}</p>
                <p className="mt-1 font-display text-lg">$0.00</p>
              </div>
            </div>
          </div>
        </section>

        {/* Activity Cards */}
        <section className="grid lg:grid-cols-3" style={{ marginTop: "var(--space-4)", gap: "var(--space-4)" }}>
          {[
            { title: m.dashboard_saved_prompts(), icon: Bookmark, empty: m.dashboard_saved_empty() },
            { title: m.dashboard_liked(), icon: Heart, empty: m.dashboard_liked_empty() },
            { title: m.dashboard_your_drops(), icon: Sparkles, empty: m.dashboard_your_drops_empty() },
          ].map((c) => (
            <div key={c.title} className="surface-raised rounded-2xl" style={{ padding: "var(--space-4)" }}>
              <div className="flex items-center gap-2">
                <c.icon className="h-4 w-4 text-magenta" />
                <h3 className="font-display text-lg font-semibold text-foreground">{c.title}</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{c.empty}</p>
            </div>
          ))}
        </section>

        {/* Coming Soon Features */}
        <section className="mt-8">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-magenta" />
            <h2 className="font-display text-xl font-semibold text-foreground">{m.dashboard_soon_heading()}</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {COMING_SOON_FEATURES.map((f) => (
              <div
                key={f.labelKey}
                className="flex items-center gap-4 rounded-2xl border border-border/60 bg-surface/40 p-4 backdrop-blur-xl"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border/60 bg-surface/60">
                  <f.icon className={`h-5 w-5 ${f.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{m[f.labelKey]()}</p>
                  <p className="text-xs text-muted-foreground truncate">{m[f.descKey]()}</p>
                </div>
                <span className="shrink-0 rounded-full border border-border/60 bg-surface/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  {m.common_soon()}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Links */}
        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            { label: m.dashboard_browse_marketplace(), to: "/", icon: TrendingUp },
            { label: m.dashboard_explore_collections(), to: "/collections", icon: BookOpen },
          ].map((l) => (
            <Link
              key={l.label}
              to={l.to}
              className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/40 p-4 backdrop-blur-xl transition hover:border-magenta/40"
            >
              <l.icon className="h-4 w-4 text-magenta" />
              <span className="text-sm font-medium text-foreground">{l.label}</span>
              <ChevronRight className="ms-auto h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </section>

      </main>
    </div>
  );
}
