import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  ssr: false,
  head: () => ({ meta: [{ title: "Your dashboard — XeomX" }] }),
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
        <section className="relative overflow-hidden flex flex-col gap-6 rounded-3xl border border-border/60 bg-surface/40 p-6 backdrop-blur-xl sm:flex-row sm:items-center sm:p-8">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-30"
            style={{
              background: "radial-gradient(ellipse 60% 80% at 0% 50%, oklch(0.45 0.25 340 / 0.4), transparent 70%)",
            }}
          />
          <div className="flex items-center gap-4">
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
              <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                {displayName}
              </h1>
              <p className="text-sm text-muted-foreground">
                {profile?.username ? `@${profile.username}` : user.email}
              </p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface/60 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                <Sparkles className="h-3 w-3 text-magenta" /> {m.dashboard_free_plan()}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:ms-auto">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white"
              style={{ background: "var(--gradient-magenta)", boxShadow: "var(--shadow-glow)" }}
            >
              <Plus className="h-4 w-4" /> {m.dashboard_publish_prompt()}
            </Link>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-4 py-2 text-sm text-foreground transition hover:border-magenta/40"
            >
              <LogOut className="h-4 w-4" /> {m.nav_sign_out()}
            </button>
          </div>
        </section>

        {/* Main Stats */}
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: m.dashboard_stat_copied(), value: 0, icon: Copy, color: "text-magenta" },
            { label: m.dashboard_stat_bought(), value: 0, icon: ShoppingBag, color: "text-gold" },
            { label: m.dashboard_stat_sold(), value: 0, icon: Tag, color: "text-green-400" },
            { label: m.dashboard_stat_nfts(), value: 0, icon: Hexagon, color: "text-purple-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border/60 bg-surface/40 p-5 backdrop-blur-xl">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <div className="mt-3 font-display text-2xl font-semibold text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </section>

        {/* Subscription & Wallet */}
        <section className="mt-4 grid gap-4 sm:grid-cols-2">

          {/* Subscription Card */}
          <div className="rounded-2xl border border-border/60 bg-surface/40 p-6 backdrop-blur-xl">
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
          <div className="rounded-2xl border border-border/60 bg-surface/40 p-6 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-magenta" />
              <span className="text-sm font-medium text-foreground">{m.dashboard_wallet()}</span>
              <span className="ms-auto rounded-full border border-magenta/30 bg-magenta/10 px-2.5 py-0.5 text-[11px] text-magenta">
                {m.common_coming_soon()}
              </span>
            </div>
            <div className="mt-4">
              <p className="font-display text-3xl font-semibold text-foreground">$0.00</p>
              <p className="text-xs text-muted-foreground">{m.dashboard_total_earnings()}</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border/40 bg-surface/60 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{m.dashboard_pending()}</p>
                <p className="mt-1 font-display text-lg">$0.00</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-surface/60 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{m.dashboard_withdrawn()}</p>
                <p className="mt-1 font-display text-lg">$0.00</p>
              </div>
            </div>
          </div>
        </section>

        {/* Activity Cards */}
        <section className="mt-4 grid gap-4 lg:grid-cols-3">
          {[
            { title: m.dashboard_saved_prompts(), icon: Bookmark, empty: m.dashboard_saved_empty() },
            { title: m.dashboard_liked(), icon: Heart, empty: m.dashboard_liked_empty() },
            { title: m.dashboard_your_drops(), icon: Sparkles, empty: m.dashboard_your_drops_empty() },
          ].map((c) => (
            <div key={c.title} className="rounded-2xl border border-border/60 bg-surface/40 p-5 backdrop-blur-xl">
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
