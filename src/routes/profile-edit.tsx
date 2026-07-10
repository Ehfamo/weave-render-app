import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { pageUrl } from "@/lib/seo";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Upload, Check, X, Globe, MapPin, Languages, Clock, ArrowLeft, Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import avatarImg from "@/assets/dashboard-avatar.jpg";

export const Route = createFileRoute("/profile-edit")({
  component: ProfileEdit,
  ssr: false,
  head: () => ({
    meta: [
      { title: "Edit profile — XeomX" },
      { name: "robots", content: "noindex" },
      { property: "og:url", content: pageUrl("/profile-edit") },
    ],
    links: [{ rel: "canonical", href: pageUrl("/profile-edit") }],
  }),
});

function ProfileEdit() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [avatar, setAvatar] = useState<string>(avatarImg);
  const [displayName, setDisplayName] = useState("Nocturne");
  const [username, setUsername] = useState("nocturne");
  const [bio, setBio] = useState("Cinematic prompt architect. Building neon-lit worlds one render at a time.");
  const [website, setWebsite] = useState("https://xeomx.app");
  const [country, setCountry] = useState("United States");
  const [language, setLanguage] = useState("English");
  const [timezone, setTimezone] = useState("America/Los_Angeles");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const usernameOk = /^[a-z0-9_]{3,20}$/.test(username);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setAvatar(URL.createObjectURL(f));
  }

  async function save() {
    if (!usernameOk) {
      toast.error("Username must be 3–20 chars, lowercase, letters/digits/_");
      return;
    }
    setSaving(true);
    try {
      if (user) {
        await supabase.from("profiles").upsert({
          id: user.id,
          username,
          display_name: displayName,
          bio,
        });
      }
      toast.success("Profile updated");
      navigate({ to: "/dashboard" });
    } catch {
      toast.error("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background:
          "radial-gradient(1000px 600px at 15% -10%, rgba(255,90,40,0.10), transparent 60%), radial-gradient(800px 600px at 95% 20%, rgba(255,45,135,0.10), transparent 60%), #08060a",
      }}
    >
      <header className="sticky top-0 z-40 backdrop-blur-xl" style={{ background: "rgba(8,6,10,0.55)" }}>
        <div className="mx-auto flex max-w-[900px] items-center justify-between px-4 py-5 sm:px-6">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
          <span className="text-xl font-bold">
            Xeom<span style={{ color: "#ff2d87" }}>X</span>
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[900px] px-4 pb-16 pt-6 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-4xl font-bold tracking-tight">Edit profile</h1>
          <p className="mt-2 text-white/60">Update how you appear across XeomX.</p>
        </motion.div>

        <div className="mt-8 space-y-6">
          {/* Avatar */}
          <Card>
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="absolute -inset-2 rounded-full opacity-70 blur-xl" style={{ background: "radial-gradient(circle, #ff5a28, transparent 70%)" }} />
                <div className="relative h-24 w-24 overflow-hidden rounded-full" style={{ boxShadow: "0 0 0 2px #ff5a28" }}>
                  <img src={avatar} alt="Avatar" className="h-full w-full object-cover" />
                </div>
              </div>
              <div>
                <p className="font-semibold">Profile picture</p>
                <p className="mt-1 text-sm text-white/50">PNG, JPG or WebP. Max 2 MB.</p>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm hover:bg-white/[0.05]"
                >
                  <Upload className="h-4 w-4" /> Upload new
                </button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
              </div>
            </div>
          </Card>

          {/* Identity */}
          <Card>
            <Field label="Display name">
              <Input value={displayName} onChange={setDisplayName} placeholder="Your name" />
            </Field>
            <Field label="Username" hint={
              usernameOk
                ? <span className="inline-flex items-center gap-1 text-emerald-400"><Check className="h-3 w-3" /> Available</span>
                : <span className="inline-flex items-center gap-1 text-rose-400"><X className="h-3 w-3" /> 3–20 chars, a–z, 0–9, _</span>
            }>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40">@</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-3 pl-9 pr-4 text-sm outline-none focus:border-[#ff8a3d]"
                />
              </div>
            </Field>
            <Field label="Bio">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                maxLength={200}
                className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm outline-none focus:border-[#ff8a3d]"
              />
              <p className="mt-1 text-right text-xs text-white/40">{bio.length}/200</p>
            </Field>
          </Card>

          {/* Locale */}
          <Card>
            <Field label="Website" icon={Globe}>
              <Input value={website} onChange={setWebsite} placeholder="https://…" />
            </Field>
            <Field label="Country" icon={MapPin}>
              <Input value={country} onChange={setCountry} />
            </Field>
            <Field label="Language" icon={Languages}>
              <Input value={language} onChange={setLanguage} />
            </Field>
            <Field label="Timezone" icon={Clock}>
              <Input value={timezone} onChange={setTimezone} />
            </Field>
          </Card>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link
              to="/dashboard"
              className="rounded-full border border-white/15 px-6 py-2.5 text-sm hover:bg-white/[0.05]"
            >
              Cancel
            </Link>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
              style={{ background: "linear-gradient(90deg,#ff8a3d,#ff2d87)", boxShadow: "0 8px 24px rgba(255,90,40,0.35)" }}
            >
              <Sparkles className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5 rounded-[22px] p-6" style={{ background: "#100b0f", border: "1px solid rgba(255,255,255,0.06)" }}>
      {children}
    </div>
  );
}

function Field({
  label, hint, icon: Icon, children,
}: {
  label: string; hint?: React.ReactNode; icon?: typeof Globe; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <label className="inline-flex items-center gap-2 font-medium uppercase tracking-wider text-white/60">
          {Icon && <Icon className="h-3.5 w-3.5" />} {label}
        </label>
        {hint && <span className="text-xs">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm outline-none transition focus:border-[#ff8a3d]"
    />
  );
}
