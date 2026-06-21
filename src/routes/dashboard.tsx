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

export const Route = createFileRoute("/dashboard")({
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
  { icon: Hexagon, label: "NFT Marketplace", desc: "Mint and trade your prompts as NFTs", color: "text-gold" },
  { icon: Wallet, label: "Crypto Wallet", desc: "Earn and withdraw in crypto", color: "text-magenta" },
  { icon: Users, label: "Social Feed", desc: "Follow creators, comment, collab", color: "text-blue-400" },
  { icon: BookOpen, label: "AI Magazine", desc: "Expert guides on advanced models", color: "text-green-400" },
  { icon: Image, label: "AI Model Hub", desc: "Subscribe to top AI model plans", color: "text-purple-400" },
  { icon: Zap, label: "Prompt Marketing", desc: "Boost your prompts to millions", color: "text-orange-400" },
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
    toast.success("Signed out");
    navigate({ to: "/" });
  }

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Loading…
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
                <Sparkles className="h-3 w-3 text-magenta" /> Free plan
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white"
              style={{ background: "var(--gradient-magenta)", boxShadow: "var(--shadow-glow)" }}
            >
              <Plus className="h-4 w-4" /> Publish prompt
            </Link>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-4 py-2 text-sm text-foreground transition hover:border-magenta/40"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </section>

        {/* Main Stats */}
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Prompts Copied", value: 0, icon: Copy, color: "text-magenta" },
            { label: "Prompts Bought", value: 0, icon: ShoppingBag, color: "text-gold" },
            { label: "Prompts Sold", value: 0, icon: Tag, color: "text-green-400" },
            { label: "NFTs Owned", value: 0, icon: Hexagon, color: "text-purple-400" },
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
                <span className="text-sm font-medium text-foreground">Subscription</span>
              </div>
              <span className="rounded-full border border-border/60 bg-surface/60 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                Free
              </span>
            </div>
            <div className="mt-4">
              <p className="text-xs text-muted-foreground">No active subscription</p>
              <div className="mt-3 h-1.5 w-full rounded-full bg-border/40">
                <div className="h-1.5 w-0 rounded-full" style={{ background: "var(--gradient-magenta)" }} />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">0 days remaining</p>
            </div>
            <Link
              to="/auth"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white"
              style={{ background: "var(--gradient-gold)", color: "oklch(0.18 0.02 60)" }}
            >
              <Crown className="h-3.5 w-3.5" /> Upgrade to Pro
            </Link>
          </div>

          {/* Wallet Card */}
          <div className="rounded-2xl border border-border/60 bg-surface/40 p-6 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-magenta" />
              <span className="text-sm font-medium text-foreground">Wallet</span>
              <span className="ml-auto rounded-full border border-magenta/30 bg-magenta/10 px-2.5 py-0.5 text-[11px] text-magenta">
                Coming Soon
              </span>
            </div>
            <div className="mt-4">
              <p className="font-display text-3xl font-semibold text-foreground">$0.00</p>
              <p className="text-xs text-muted-foreground">Total earnings</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border/40 bg-surface/60 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Pending</p>
                <p className="mt-1 font-display text-lg">$0.00</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-surface/60 p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Withdrawn</p>
                <p className="mt-1 font-display text-lg">$0.00</p>
              </div>
            </div>
          </div>
        </section>

        {/* Activity Cards */}
        <section className="mt-4 grid gap-4 lg:grid-cols-3">
          {[
            { title: "Saved Prompts", icon: Bookmark, empty: "Save prompts from Discover to build your library." },
            { title: "Liked", icon: Heart, empty: "Tap the heart on any prompt to like it." },
            { title: "Your Drops", icon: Sparkles, empty: "Publish your first prompt to start earning." },
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
            <h2 className="font-display text-xl font-semibold text-foreground">Coming Soon</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {COMING_SOON_FEATURES.map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-4 rounded-2xl border border-border/60 bg-surface/40 p-4 backdrop-blur-xl"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border/60 bg-surface/60">
                  <f.icon className={`h-5 w-5 ${f.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{f.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{f.desc}</p>
                </div>
                <span className="shrink-0 rounded-full border border-border/60 bg-surface/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  Soon
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Links */}
        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            { label: "Browse Prompt Marketplace", to: "/", icon: TrendingUp },
            { label: "Explore Collections", to: "/collections", icon: BookOpen },
          ].map((l) => (
            <Link
              key={l.label}
              to={l.to}
              className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/40 p-4 backdrop-blur-xl transition hover:border-magenta/40"
            >
              <l.icon className="h-4 w-4 text-magenta" />
              <span className="text-sm font-medium text-foreground">{l.label}</span>
              <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </section>

      </main>
    </div>
  );
}
