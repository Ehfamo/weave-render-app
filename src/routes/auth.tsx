import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — XeomX" },
      { name: "description", content: "Sign in to XeomX to save prompts, follow creators, and unlock premium drops." },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function signInGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result.error) {
      toast.error(result.error.message ?? "Sign-in failed");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, oklch(0.45 0.25 340 / 0.35), transparent 60%), radial-gradient(ellipse 60% 40% at 80% 80%, oklch(0.6 0.18 60 / 0.2), transparent 60%)",
        }}
      />
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
        <Link to="/" className="mb-10 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: "var(--gradient-magenta)" }}>
            <Sparkles className="h-4 w-4 text-white" />
          </span>
          <span className="font-display text-2xl font-bold tracking-tight">
            Xeom<span className="text-gradient-magenta">X</span>
          </span>
        </Link>

        <div className="w-full rounded-3xl border border-border/60 bg-surface/40 p-8 backdrop-blur-xl">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">Welcome</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to save prompts, follow creators and access premium drops.
          </p>

          <button
            onClick={signInGoogle}
            disabled={loading}
            className="mt-8 inline-flex w-full items-center justify-center gap-3 rounded-full border border-border bg-background px-5 py-3 text-sm font-medium text-foreground transition hover:border-magenta/40 hover:bg-surface disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C17 3.4 14.7 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
              </svg>
            )}
            Continue with Google
          </button>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing you agree to our Terms and Privacy.
          </p>
        </div>

        <Link to="/" className="mt-6 text-xs text-muted-foreground hover:text-foreground">
          ← Back to discover
        </Link>
      </div>
    </main>
  );
}