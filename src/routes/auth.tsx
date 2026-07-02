import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Loader2, Mail, Apple, Github, ArrowLeft } from "lucide-react";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  ssr: false,
  head: () => ({
    meta: [
      { title: m.auth_head_title() },
      { name: "description", content: m.auth_head_desc() },
    ],
  }),
});

type View = "root" | "email" | "password";

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const [view, setView] = useState<View>("root");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/dashboard" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function signInOAuth(provider: "google" | "apple") {
    setLoading(provider);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(m.auth_signin_failed());
      setLoading(null);
      return;
    }
    if (result.redirected) return;
    const { data } = await supabase.auth.getSession();
    if (data.session) navigate({ to: "/dashboard" });
    else setLoading(null);
  }

  async function signInGithub() {
    setLoading("github");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      toast.error(m.auth_signin_failed());
      setLoading(null);
    }
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading("magic");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(null);
    if (error) {
      toast.error(m.auth_signin_failed());
      return;
    }
    toast.success(m.auth_magic_link_sent());
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading("password");
    const fn = isSignUp ? supabase.auth.signUp : supabase.auth.signInWithPassword;
    const { error } = await fn.call(supabase.auth, {
      email,
      password,
      ...(isSignUp && { options: { emailRedirectTo: window.location.origin } }),
    } as never);
    setLoading(null);
    if (error) {
      toast.error(m.auth_signin_failed());
      return;
    }
    if (isSignUp) toast.success(m.auth_check_email());
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
          {view !== "root" && (
            <button
              type="button"
              onClick={() => setView("root")}
              className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> {m.auth_back_options()}
            </button>
          )}
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">{m.auth_welcome()}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{m.auth_subtitle()}</p>

          {view === "root" && (
            <div className="mt-8 flex flex-col gap-3">
              <OAuthButton onClick={() => signInOAuth("google")} loading={loading === "google"} label={m.auth_continue_google()}>
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C17 3.4 14.7 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
                </svg>
              </OAuthButton>
              <OAuthButton onClick={() => signInOAuth("apple")} loading={loading === "apple"} label={m.auth_continue_apple()}>
                <Apple className="h-4 w-4" />
              </OAuthButton>
              <OAuthButton onClick={signInGithub} loading={loading === "github"} label={m.auth_continue_github()}>
                <Github className="h-4 w-4" />
              </OAuthButton>

              <div className="my-2 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                <span className="h-px flex-1 bg-border/60" />
                {m.auth_or()}
                <span className="h-px flex-1 bg-border/60" />
              </div>

              <OAuthButton onClick={() => setView("email")} loading={false} label={m.auth_continue_email()}>
                <Mail className="h-4 w-4" />
              </OAuthButton>
            </div>
          )}

          {view === "email" && (
            <form onSubmit={sendMagicLink} className="mt-8 flex flex-col gap-3">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="email-ml">
                {m.auth_email_label()}
              </label>
              <input
                id="email-ml"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-magenta/60"
                placeholder="you@example.com"
              />
              <button
                type="submit"
                disabled={loading === "magic"}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
                style={{ background: "var(--gradient-magenta)" }}
              >
                {loading === "magic" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {m.auth_send_magic_link()}
              </button>
              <p className="text-center text-[11px] text-muted-foreground">{m.auth_magic_link_desc()}</p>
              <button
                type="button"
                onClick={() => setView("password")}
                className="mt-1 text-xs text-muted-foreground transition hover:text-foreground"
              >
                {m.auth_use_password()}
              </button>
            </form>
          )}

          {view === "password" && (
            <form onSubmit={submitPassword} className="mt-8 flex flex-col gap-3">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="email-pw">
                {m.auth_email_label()}
              </label>
              <input
                id="email-pw"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-magenta/60"
              />
              <label className="text-xs font-medium text-muted-foreground" htmlFor="pw">
                {m.auth_password_label()}
              </label>
              <input
                id="pw"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-magenta/60"
              />
              <button
                type="submit"
                disabled={loading === "password"}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
                style={{ background: "var(--gradient-magenta)" }}
              >
                {loading === "password" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isSignUp ? m.auth_sign_up() : m.auth_sign_in()}
              </button>
              <button
                type="button"
                onClick={() => setIsSignUp((v) => !v)}
                className="mt-1 text-xs text-muted-foreground transition hover:text-foreground"
              >
                {isSignUp ? m.auth_toggle_signin() : m.auth_toggle_signup()}
              </button>
              <button
                type="button"
                onClick={() => setView("email")}
                className="text-xs text-muted-foreground transition hover:text-foreground"
              >
                {m.auth_use_magic_link()}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {m.auth_terms()}
          </p>
        </div>

        <Link to="/" className="mt-6 text-xs text-muted-foreground hover:text-foreground">
          {m.auth_back()}
        </Link>
      </div>
    </main>
  );
}

function OAuthButton({
  onClick,
  loading,
  label,
  children,
}: {
  onClick: () => void;
  loading: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-border bg-background px-5 py-3 text-sm font-medium text-foreground transition hover:border-magenta/40 hover:bg-surface disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
      {label}
    </button>
  );
}