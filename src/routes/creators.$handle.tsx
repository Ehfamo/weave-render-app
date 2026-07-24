import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Check, ArrowLeft } from "lucide-react";
import { Header } from "@/components/xeomx/Header";
import { PromptCard } from "@/components/xeomx/PromptCard";
import { pageUrl, SITE_URL } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchProfileByUsername,
  fetchPromptsByAuthor,
  fetchIsFollowing,
  toggleFollow,
} from "@/lib/marketplace";

export const Route = createFileRoute("/creators/$handle")({
  loader: async ({ params }) => {
    const clean = params.handle.replace(/^@/, "");
    if (!/^[a-z0-9_]{3,32}$/i.test(clean)) throw notFound();
    const profile = await fetchProfileByUsername(clean);
    if (!profile) throw notFound();
    return { profile };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Creator not found — XeomX" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { profile } = loaderData;
    const name = profile.display_name || profile.username || "Creator";
    const desc = profile.bio || `Prompts and packs by ${name} on XeomX.`;
    const url = pageUrl(`/creators/${params.handle}`);
    const meta: Array<Record<string, string>> = [
      { title: `${name} — XeomX` },
      { name: "description", content: desc.slice(0, 155) },
      { property: "og:title", content: `${name} — XeomX` },
      { property: "og:description", content: desc.slice(0, 155) },
      { property: "og:type", content: "profile" },
      { property: "og:url", content: url },
    ];
    if (profile.avatar_url) {
      const abs = profile.avatar_url.startsWith("http")
        ? profile.avatar_url
        : `${SITE_URL}${profile.avatar_url}`;
      meta.push({ property: "og:image", content: abs });
      meta.push({ name: "twitter:image", content: abs });
    }
    return { meta, links: [{ rel: "canonical", href: url }] };
  },
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-center">
      <div className="max-w-md">
        <h1 className="font-display text-4xl">Creator not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          That handle doesn't match a XeomX creator.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/creators" className="rounded-full bg-magenta px-5 py-2 text-sm font-medium text-white">
            All creators
          </Link>
          <Link to="/" className="rounded-full border border-border px-5 py-2 text-sm">
            Home
          </Link>
        </div>
      </div>
    </div>
  ),
  errorComponent: ({ reset }) => (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-center">
      <div>
        <h1 className="font-display text-2xl">Couldn't load this profile</h1>
        <button onClick={reset} className="mt-4 rounded-full border border-border px-4 py-2 text-sm">
          Retry
        </button>
      </div>
    </div>
  ),
  component: CreatorDetail,
});

function CreatorDetail() {
  const { profile } = Route.useLoaderData();
  const params = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then((r) => setUid(r.data.user?.id ?? null));
  }, []);

  const { data: prompts = [], isLoading, error } = useQuery({
    queryKey: ["creator-prompts", profile.id],
    queryFn: () => fetchPromptsByAuthor(profile.id, 48),
    staleTime: 60_000,
  });

  const { data: following = false } = useQuery({
    queryKey: ["following-one", uid, profile.id],
    enabled: !!uid,
    queryFn: () => fetchIsFollowing(profile.id),
  });

  const follow = useMutation({
    mutationFn: (on: boolean) => toggleFollow(profile.id, on),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["following-one", uid, profile.id] });
    },
  });

  const name = profile.display_name || profile.username || "Creator";
  const handle = profile.username ? `@${profile.username}` : "@creator";
  const isSelf = !!uid && uid === profile.id;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <section
        className="mx-auto max-w-[1400px]"
        style={{ paddingInline: "var(--space-4)", paddingBlock: "var(--space-6)" }}
      >
        <Link
          to="/creators"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All creators
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="surface-elevated mt-5 flex flex-col items-start gap-5 rounded-3xl p-6 sm:flex-row sm:items-center"
        >
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={name}
              width={96}
              height={96}
              className="h-24 w-24 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className="grid h-24 w-24 place-items-center rounded-full text-3xl font-bold text-white"
              style={{ background: "var(--gradient-magenta)" }}
            >
              {name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <h1 className="font-display text-3xl font-bold tracking-tight">{name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{handle}</p>
            {profile.bio && (
              <p className="mt-3 max-w-xl text-sm text-foreground/80">{profile.bio}</p>
            )}
          </div>
          {!isSelf && (
            <button
              type="button"
              disabled={follow.isPending}
              onClick={() => {
                if (!uid) {
                  navigate({
                    to: "/auth",
                    search: { next: `/creators/${params.handle}` },
                  });
                  return;
                }
                follow.mutate(!following);
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-medium text-white transition hover:opacity-95 disabled:opacity-60"
              style={{
                backgroundColor: following ? "var(--surface-secondary)" : "var(--action-secondary)",
              }}
            >
              {following ? (
                <>
                  <Check className="h-4 w-4" /> Following
                </>
              ) : (
                "Follow"
              )}
            </button>
          )}
        </motion.div>

        <div style={{ marginTop: "var(--space-8)" }}>
          <h2 className="mb-4 font-display text-2xl font-semibold tracking-tight">
            Prompts by {name}
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl border border-border/60 bg-surface/40" />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">Couldn't load their prompts.</p>
          ) : prompts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/60 p-10 text-center">
              <p className="text-sm text-muted-foreground">
                {name} hasn't published any prompts yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {prompts.map((p) => (
                <PromptCard key={p.id} prompt={p} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}