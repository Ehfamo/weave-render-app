import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, Apple, Github, ArrowLeft, MessageSquare } from "lucide-react";
import { Logo } from "@/components/xeomx/Logo";
import { motion } from "motion/react";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { pageUrl } from "@/lib/seo";
import { scorePassword, friendlyAuthError } from "@/lib/auth-validation";
import { StrengthMeter } from "@/routes/reset-password";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  head: () => ({
    meta: [
      { title: m.auth_head_title() },
      { name: "description", content: m.auth_head_desc() },
      { property: "og:title", content: m.auth_head_title() },
      { property: "og:description", content: m.auth_head_desc() },
      { property: "og:type", content: "website" },
      { property: "og:url", content: pageUrl("/auth") },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: pageUrl("/auth") }],
  }),
});

type View = "root" | "email" | "password";

function sanitizeNext(next: string | undefined): string {
  if (!next) return "/dashboard";
  // Only allow same-origin relative paths, no protocol-relative or external.
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

function AuthPage() {
  const navigate = useNavigate();
  const { next } = useSearch({ from: "/auth" });
  const dest = useMemo(() => sanitizeNext(next), [next]);
  const [loading, setLoading] = useState<string | null>(null);
  const [view, setView] = useState<View>("root");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: dest });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: dest });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, dest]);

  async function signInOAuth(provider: "google") {
    setLoading(provider);
    setError(null);
    const result = await lovable.auth.signInWithOAuth(provider, {
      // Public callback URL — the app-level session listener redirects to `dest`
      // once Supabase reports a hydrated session.
      redirect_uri: `${window.location.origin}/auth${dest !== "/dashboard" ? `?next=${encodeURIComponent(dest)}` : ""}`,
    });
    if (result.error) {
      const msg = friendlyAuthError((result.error as { message?: string }).message);
      setError(msg);
      toast.error(msg);
      setLoading(null);
      return;
    }
    if (result.redirected) return;
    const { data } = await supabase.auth.getSession();
    if (data.session) navigate({ to: dest });
    else setLoading(null);
  }

  // Apple and Discord OAuth intentionally disabled — surfaced as "Coming
  // soon" chips per the Feature Status registry. GitHub is a supported
  // provider; if the Supabase project has it configured the flow succeeds,
  // otherwise Supabase returns a friendly error surfaced via toast.
  async function signInGithub() {
    setLoading("github");
    setError(null);
    const redirectTo = `${window.location.origin}/auth${
      dest !== "/dashboard" ? `?next=${encodeURIComponent(dest)}` : ""
    }`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo },
    });
    if (error) {
      const msg = friendlyAuthError(error.message);
      setError(msg);
      toast.error(msg);
      setLoading(null);
    }
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading("magic");
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth${dest !== "/dashboard" ? `?next=${encodeURIComponent(dest)}` : ""}` },
    });
    setLoading(null);
    if (error) {
      const msg = friendlyAuthError(error.message);
      setError(msg);
      toast.error(msg);
      return;
    }
    toast.success(m.auth_magic_link_sent());
  }

  const pwStrength = useMemo(() => scorePassword(password), [password]);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (isSignUp && !pwStrength.ok) {
      setError("Please choose a stronger password.");
      return;
    }
    setLoading("password");
    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth${dest !== "/dashboard" ? `?next=${encodeURIComponent(dest)}` : ""}` },
      });
      setLoading(null);
      if (error) {
        const msg = friendlyAuthError(error.message);
        setError(msg);
        toast.error(msg);
        return;
      }
      if (!data.session) {
        setAwaitingConfirm(true);
        toast.success(m.auth_check_email());
      }
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(null);
    if (error) {
      const msg = friendlyAuthError(error.message);
      setError(msg);
      toast.error(msg);
      return;
    }
  }

  async function resendConfirmation() {
    if (!email) return;
    if (resendCooldown > 0) return;
    setLoading("resend");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth${dest !== "/dashboard" ? `?next=${encodeURIComponent(dest)}` : ""}` },
    });
    setLoading(null);
    if (error) {
      toast.error(friendlyAuthError(error.message));
      return;
    }
    setResendCooldown(60);
    toast.success("Verification email sent again.");
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
      <div
        className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center"
        style={{ paddingInline: "var(--space-5)" }}
      >
        <Link
          to="/"
          aria-label="XEOMX — Home"
          className="flex items-center"
          style={{ marginBottom: "var(--space-6)" }}
        >
          <Logo variant="full" size={36} ariaLabel="XEOMX" />
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="surface-elevated w-full rounded-3xl"
          style={{ padding: "var(--space-6)" }}
        >
          {view !== "root" && (
            <button
              type="button"
              onClick={() => setView("root")}
              className="inline-flex items-center gap-1 transition hover:text-foreground"
              style={{ marginBottom: "var(--space-4)", fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}
            >
              <ArrowLeft className="h-3 w-3" /> {m.auth_back_options()}
            </button>
          )}
          <h1
            className="font-display font-bold tracking-tight text-foreground"
            style={{ fontSize: "clamp(1.75rem, 4vw, var(--font-size-h1))" }}
          >
            {m.auth_welcome()}
          </h1>
          <p style={{ marginTop: "var(--space-2)", fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}>
            {m.auth_subtitle()}
          </p>

          {view === "root" && (
            <div className="flex flex-col" style={{ marginTop: "var(--space-6)", gap: "var(--space-3)" }}>
              <OAuthButton onClick={() => signInOAuth("google")} loading={loading === "google"} label={m.auth_continue_google()}>
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C17 3.4 14.7 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
                </svg>
              </OAuthButton>
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="inline-flex w-full items-center justify-center gap-3 text-sm font-medium text-muted-foreground opacity-60 cursor-not-allowed"
                style={{
                  border: "1px solid var(--border-default)",
                  backgroundColor: "var(--surface-glass)",
                  borderRadius: "var(--radius-sm)",
                  paddingInline: "var(--space-5)",
                  paddingBlock: "var(--space-3)",
                }}
              >
                <Apple className="h-4 w-4" />
                {m.auth_continue_apple()}
                <span className="ms-1 rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                  {m.auth_coming_soon()}
                </span>
              </button>
              <OAuthButton onClick={signInGithub} loading={loading === "github"} label={m.auth_continue_github()}>
                <Github className="h-4 w-4" />
              </OAuthButton>

              <button
                type="button"
                disabled
                aria-disabled="true"
                className="inline-flex w-full items-center justify-center gap-3 text-sm font-medium text-muted-foreground opacity-60 cursor-not-allowed"
                style={{
                  border: "1px solid var(--border-default)",
                  backgroundColor: "var(--surface-glass)",
                  borderRadius: "var(--radius-sm)",
                  paddingInline: "var(--space-5)",
                  paddingBlock: "var(--space-3)",
                }}
              >
                <MessageSquare className="h-4 w-4" />
                {m.auth_continue_discord()}
                <span className="ms-1 rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                  {m.auth_coming_soon()}
                </span>
              </button>

              <div
                className="flex items-center uppercase tracking-[0.2em] text-muted-foreground"
                style={{ marginBlock: "var(--space-2)", gap: "var(--space-3)", fontSize: "var(--font-size-micro)" }}
              >
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
            <form
              onSubmit={sendMagicLink}
              className="flex flex-col"
              style={{ marginTop: "var(--space-6)", gap: "var(--space-3)" }}
            >
              <label className="text-xs font-medium text-muted-foreground" htmlFor="email-ml">
                {m.auth_email_label()}
              </label>
              <input
                id="email-ml"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-sm text-foreground outline-none transition focus:border-magenta/60"
                style={{
                  border: "1px solid var(--border-default)",
                  backgroundColor: "var(--surface-secondary)",
                  borderRadius: "var(--radius-sm)",
                  paddingInline: "var(--space-4)",
                  paddingBlock: "var(--space-3)",
                }}
                placeholder="you@example.com"
              />
              <button
                type="submit"
                disabled={loading === "magic"}
                className="inline-flex items-center justify-center gap-2 text-sm font-medium text-white disabled:opacity-60"
                style={{
                  marginTop: "var(--space-2)",
                  backgroundColor: "var(--action-primary)",
                  borderRadius: "var(--radius-sm)",
                  paddingInline: "var(--space-5)",
                  paddingBlock: "var(--space-3)",
                }}
              >
                {loading === "magic" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {m.auth_send_magic_link()}
              </button>
              <p className="text-center" style={{ fontSize: "var(--font-size-micro)", color: "var(--text-muted)" }}>{m.auth_magic_link_desc()}</p>
              <button
                type="button"
                onClick={() => setView("password")}
                className="transition hover:text-foreground"
                style={{ marginTop: "var(--space-1)", fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}
              >
                {m.auth_use_password()}
              </button>
            </form>
          )}

          {view === "password" && (
            <form
              onSubmit={submitPassword}
              className="flex flex-col"
              style={{ marginTop: "var(--space-6)", gap: "var(--space-3)" }}
              noValidate
            >
              <label className="text-xs font-medium text-muted-foreground" htmlFor="email-pw">
                {m.auth_email_label()}
              </label>
              <input
                id="email-pw"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-sm text-foreground outline-none transition focus:border-magenta/60"
                style={{
                  border: "1px solid var(--border-default)",
                  backgroundColor: "var(--surface-secondary)",
                  borderRadius: "var(--radius-sm)",
                  paddingInline: "var(--space-4)",
                  paddingBlock: "var(--space-3)",
                }}
              />
              <label className="text-xs font-medium text-muted-foreground" htmlFor="pw">
                {m.auth_password_label()}
              </label>
              <input
                id="pw"
                type="password"
                required
                minLength={isSignUp ? 8 : 6}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-sm text-foreground outline-none transition focus:border-magenta/60"
                style={{
                  border: "1px solid var(--border-default)",
                  backgroundColor: "var(--surface-secondary)",
                  borderRadius: "var(--radius-sm)",
                  paddingInline: "var(--space-4)",
                  paddingBlock: "var(--space-3)",
                }}
              />
              {isSignUp && password.length > 0 && <StrengthMeter strength={pwStrength} />}
              {error && (
                <p role="alert" style={{ fontSize: "var(--font-size-micro)", color: "var(--action-secondary)" }}>{error}</p>
              )}
              {awaitingConfirm && (
                <div role="status" style={{ fontSize: "var(--font-size-micro)", color: "var(--text-muted)" }}>
                  Verification email sent — check your inbox.{" "}
                  <button
                    type="button"
                    onClick={resendConfirmation}
                    disabled={resendCooldown > 0 || loading === "resend"}
                    className="underline hover:text-foreground disabled:no-underline disabled:opacity-60"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend"}
                  </button>
                </div>
              )}
              <button
                type="submit"
                disabled={loading === "password" || (isSignUp && !pwStrength.ok)}
                className="inline-flex items-center justify-center gap-2 text-sm font-medium text-white disabled:opacity-60"
                style={{
                  marginTop: "var(--space-2)",
                  backgroundColor: "var(--action-primary)",
                  borderRadius: "var(--radius-sm)",
                  paddingInline: "var(--space-5)",
                  paddingBlock: "var(--space-3)",
                }}
              >
                {loading === "password" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isSignUp ? m.auth_sign_up() : m.auth_sign_in()}
              </button>
              {!isSignUp && (
                <Link
                  to="/forgot-password"
                  className="text-center transition hover:text-foreground"
                  style={{ marginTop: "var(--space-1)", fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}
                >
                  Forgot your password?
                </Link>
              )}
              <button
                type="button"
                onClick={() => { setIsSignUp((v) => !v); setError(null); }}
                className="transition hover:text-foreground"
                style={{ marginTop: "var(--space-1)", fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}
              >
                {isSignUp ? m.auth_toggle_signin() : m.auth_toggle_signup()}
              </button>
              <button
                type="button"
                onClick={() => setView("email")}
                className="transition hover:text-foreground"
                style={{ fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}
              >
                {m.auth_use_magic_link()}
              </button>
            </form>
          )}

          <p
            className="text-center"
            style={{ marginTop: "var(--space-5)", fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}
          >
            {m.auth_terms()}
          </p>
        </motion.div>

        <Link
          to="/"
          className="hover:text-foreground"
          style={{ marginTop: "var(--space-5)", fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}
        >
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
      className="inline-flex w-full items-center justify-center gap-3 text-sm font-medium text-foreground transition hover:border-magenta/40 disabled:opacity-60"
      style={{
        border: "1px solid var(--border-default)",
        backgroundColor: "var(--surface-glass)",
        borderRadius: "var(--radius-sm)",
        paddingInline: "var(--space-5)",
        paddingBlock: "var(--space-3)",
        transitionDuration: "var(--motion-duration-fast)",
        transitionTimingFunction: "var(--motion-ease)",
      }}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
      {label}
    </button>
  );
}