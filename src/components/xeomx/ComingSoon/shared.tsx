import { Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { useState } from "react";

export function BackToExplore() {
  return (
    <Link to="/explore" className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1.5 text-xs text-foreground backdrop-blur transition hover:border-amber-300/40">
      <ArrowLeft className="h-3.5 w-3.5" /> All sections
    </Link>
  );
}

export function NotifyForm({ label = "Notify Me", sectionSlug = "" }: { label?: string; sectionSlug?: string }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || loading || done) return;

    const key = `xeomx_waitlist_${sectionSlug || "general"}`;
    const last = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    if (last && Date.now() - parseInt(last) < 60000) {
      setError("Please wait a moment before submitting again.");
      return;
    }

    setLoading(true);
    setError("");
    await new Promise((r) => setTimeout(r, 800));
    if (typeof window !== "undefined") localStorage.setItem(key, Date.now().toString());
    setDone(true);
    setEmail("");
    setLoading(false);
  };

  if (done) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-4">
        <CheckCircle className="h-5 w-5 text-emerald-300" />
        <span className="text-sm text-emerald-200">You're on the list! We'll reach out when it's ready.</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        required
        placeholder="you@domain.com"
        className="flex-1 rounded-full border border-white/10 bg-surface/60 px-5 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-amber-300/40 focus:outline-none"
      />
      <button
        type="submit"
        disabled={loading}
        className="flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-70"
        style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-glow)" }}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
      </button>
      {error && <p className="w-full text-xs text-destructive">{error}</p>}
    </form>
  );
}