import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, Heart, Sparkles, TrendingUp, Plus, LogOut } from "lucide-react";
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

  const stats = [
    { label: "Saved", value: 0, icon: Bookmark },
    { label: "Liked", value: 0, icon: Heart },
    { label: "Published", value: 0, icon: Sparkles },
    { label: "Total views", value: 0, icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-[1400px] px-4 py-10 sm:px-8">
        <section className="flex flex-col gap-6 rounded-3xl border border-border/60 bg-surface/40 p-6 backdrop-blur-xl sm:flex-row sm:items-center sm:p-8">
          <div className="flex items-center gap-4">
            {avatar ? (
              <img
                src={avatar}
                alt={displayName}
                className="h-16 w-16 rounded-full border border-border object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-full text-lg font-semibold text-white" style={{ background: "var(--gradient-magenta)" }}>
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

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-border/60 bg-surface/40 p-5 backdrop-blur-xl">
              <s.icon className="h-4 w-4 text-magenta" />
              <div className="mt-3 font-display text-2xl font-semibold text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          <Card title="Saved prompts" empty="Save prompts from Discover to build your library." />
          <Card title="Liked" empty="Tap the heart on any prompt to like it." />
          <Card title="Your drops" empty="Publish your first prompt to start earning." />
        </section>
      </main>
    </div>
  );
}

function Card({ title, empty }: { title: string; empty: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-surface/40 p-5 backdrop-blur-xl">
      <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
    </div>
  );
}
