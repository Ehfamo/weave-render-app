import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { pageUrl } from "@/lib/seo";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Upload, Check, X, Globe, MapPin, Languages, Clock, ArrowLeft, Sparkles, Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import avatarImg from "@/assets/dashboard-avatar.jpg";
import {
  validateUsernameFormat,
  validateDisplayName,
  validateBio,
  validateWebsite,
  validateAvatarFile,
  normalizeUsername,
} from "@/lib/auth-validation";

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

type Availability = "idle" | "checking" | "available" | "taken" | "invalid";

function ProfileEdit() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [initialUsername, setInitialUsername] = useState("");
  const [avatar, setAvatar] = useState<string>(avatarImg);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("");
  const [timezone, setTimezone] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [availability, setAvailability] = useState<Availability>("idle");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { next: "/profile-edit" } });
  }, [loading, user, navigate]);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username, display_name, bio, avatar_url, website, country, timezone, language")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (data) {
        setUsername(data.username ?? "");
        setInitialUsername(data.username ?? "");
        setDisplayName(data.display_name ?? "");
        setBio(data.bio ?? "");
        setWebsite(data.website ?? "");
        setCountry(data.country ?? "");
        setLanguage(data.language ?? "");
        setTimezone(data.timezone ?? tz);
        if (data.avatar_url) setAvatar(data.avatar_url);
      } else {
        setTimezone(tz);
      }
      setProfileLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    const norm = normalizeUsername(username);
    if (!norm) { setAvailability("idle"); return; }
    if (validateUsernameFormat(norm)) { setAvailability("invalid"); return; }
    if (norm === normalizeUsername(initialUsername)) { setAvailability("available"); return; }
    setAvailability("checking");
    const handle = setTimeout(async () => {
      const { data, error } = await supabase.rpc("username_available", { _username: norm });
      if (error) return;
      setAvailability(data ? "available" : "taken");
    }, 350);
    return () => clearTimeout(handle);
  }, [username, initialUsername]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const err = validateAvatarFile(f);
    if (err) {
      toast.error(err);
      e.target.value = "";
      return;
    }
    setAvatarFile(f);
    setAvatar(URL.createObjectURL(f));
  }

  async function uploadAvatarIfNeeded(): Promise<string | null> {
    if (!avatarFile || !user) return null;
    setUploading(true);
    try {
      const ext = avatarFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, avatarFile, { cacheControl: "3600", upsert: false, contentType: avatarFile.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      return data.publicUrl;
    } finally {
      setUploading(false);
    }
  }

  const fieldErrors = useMemo(() => ({
    displayName: validateDisplayName(displayName),
    username: validateUsernameFormat(normalizeUsername(username)),
    bio: validateBio(bio),
    website: validateWebsite(website.trim()),
  }), [displayName, username, bio, website]);

  const canSave = !saving && !uploading && !fieldErrors.displayName && !fieldErrors.username
    && !fieldErrors.bio && !fieldErrors.website
    && (availability === "available" || availability === "idle");

  async function save() {
    if (!user) return;
    if (!canSave) { toast.error("Please fix the highlighted fields."); return; }
    setSaving(true);
    try {
      let avatarUrl: string | null = null;
      try {
        avatarUrl = await uploadAvatarIfNeeded();
      } catch (e) {
        toast.error((e as Error).message || "Could not upload avatar");
        setSaving(false);
        return;
      }

      const patch = {
        display_name: displayName.trim(),
        username: normalizeUsername(username),
        bio: bio.trim() || null,
        website: website.trim() || null,
        country: country.trim() || null,
        language: language.trim() || null,
        timezone: timezone.trim() || null,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      };

      const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
      if (error) {
        if (error.code === "23505") {
          setAvailability("taken");
          toast.error("That username was just taken. Please choose another.");
        } else if (error.code === "23514") {
          toast.error("One of the fields didn't pass validation. Please review and retry.");
        } else {
          toast.error(error.message || "Could not save. Please try again.");
        }
        setSaving(false);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      toast.success("Profile updated");
      navigate({ to: "/dashboard" });
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
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to dashboard
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

        {profileLoading ? (
          <div className="mt-8 flex items-center gap-2 text-white/60" role="status" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading your profile…
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <Card>
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="absolute -inset-2 rounded-full opacity-70 blur-xl" style={{ background: "radial-gradient(circle, #ff5a28, transparent 70%)" }} />
                  <div className="relative h-24 w-24 overflow-hidden rounded-full" style={{ boxShadow: "0 0 0 2px #ff5a28" }}>
                    <img src={avatar} alt="Your avatar" className="h-full w-full object-cover" />
                  </div>
                </div>
                <div>
                  <p className="font-semibold">Profile picture</p>
                  <p className="mt-1 text-sm text-white/50">PNG, JPG or WebP. Max 2 MB.</p>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm hover:bg-white/[0.05] disabled:opacity-60"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
                    {uploading ? "Uploading…" : "Upload new"}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    hidden
                    onChange={onFile}
                    aria-label="Upload a new avatar"
                  />
                </div>
              </div>
            </Card>

            <Card>
              <Field label="Display name" hint={fieldErrors.displayName ? <ErrText>{fieldErrors.displayName}</ErrText> : null}>
                <Input value={displayName} onChange={setDisplayName} placeholder="Your name" autoComplete="name" />
              </Field>
              <Field label="Username" hint={<UsernameHint state={availability} format={fieldErrors.username} />}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40">@</span>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                    aria-invalid={availability === "taken" || availability === "invalid"}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-3 pl-9 pr-4 text-sm outline-none focus:border-[#ff8a3d]"
                  />
                </div>
              </Field>
              <Field label="Bio" hint={fieldErrors.bio ? <ErrText>{fieldErrors.bio}</ErrText> : null}>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  maxLength={300}
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm outline-none focus:border-[#ff8a3d]"
                />
                <p className="mt-1 text-right text-xs text-white/40" aria-live="polite">{bio.length}/300</p>
              </Field>
            </Card>

            <Card>
              <Field label="Website" icon={Globe} hint={fieldErrors.website ? <ErrText>{fieldErrors.website}</ErrText> : null}>
                <Input value={website} onChange={setWebsite} placeholder="https://…" autoComplete="url" />
              </Field>
              <Field label="Country" icon={MapPin}>
                <Input value={country} onChange={setCountry} autoComplete="country-name" />
              </Field>
              <Field label="Language" icon={Languages}>
                <Input value={language} onChange={setLanguage} autoComplete="language" />
              </Field>
              <Field label="Timezone" icon={Clock}>
                <Input value={timezone} onChange={setTimezone} />
              </Field>
            </Card>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <Link
                to="/dashboard"
                className="rounded-full border border-white/15 px-6 py-2.5 text-sm hover:bg-white/[0.05]"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={save}
                disabled={!canSave}
                className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
                style={{ background: "linear-gradient(90deg,#ff8a3d,#ff2d87)", boxShadow: "0 8px 24px rgba(255,90,40,0.35)" }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        )}
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
          {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />} {label}
        </label>
        {hint && <span className="text-xs">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Input({
  value, onChange, placeholder, autoComplete,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm outline-none transition focus:border-[#ff8a3d]"
    />
  );
}

function ErrText({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 text-rose-400"><X className="h-3 w-3" aria-hidden /> {children}</span>;
}

function UsernameHint({ state, format }: { state: Availability; format: string | null }) {
  if (format) return <ErrText>{format}</ErrText>;
  if (state === "checking") return <span className="inline-flex items-center gap-1 text-white/50"><Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Checking…</span>;
  if (state === "available") return <span className="inline-flex items-center gap-1 text-emerald-400"><Check className="h-3 w-3" aria-hidden /> Available</span>;
  if (state === "taken") return <ErrText>Already taken</ErrText>;
  if (state === "invalid") return <ErrText>Not a valid username</ErrText>;
  return null;
}