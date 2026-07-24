import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchCreators, toggleFollow } from "@/lib/marketplace";
import { Header } from "@/components/xeomx/Header";
import { CreatorCard } from "@/components/xeomx/CreatorCard";
import { pageUrl } from "@/lib/seo";
import { useEffect, useState } from "react";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/creators")({
  head: () => ({
    meta: [
      { title: "Creators — XeomX" },
      { name: "description", content: "Founder & elite prompt engineers earning from copies, saves, and remixes." },
      { property: "og:title", content: "Creators — XeomX" },
      { property: "og:description", content: "Founder & elite prompt engineers earning from copies, saves, and remixes." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: pageUrl("/creators") },
    ],
    links: [{ rel: "canonical", href: pageUrl("/creators") }],
  }),
  component: CreatorsPage,
});

function CreatorsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then((r) => setUid(r.data.user?.id ?? null));
  }, []);
  const { data, isLoading, error } = useQuery({
    queryKey: ["creators"],
    queryFn: () => fetchCreators(48),
    staleTime: 60_000,
  });
  const { data: followingIds = [] } = useQuery({
    queryKey: ["following", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase.from("follows").select("followee_id").eq("follower_id", uid!);
      return (data ?? []).map((r) => r.followee_id);
    },
  });
  const follow = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => toggleFollow(id, on),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["following", uid] }),
  });
  const creators = data?.creators ?? [];
  const ids = data?.ids ?? [];
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <section
        className="mx-auto max-w-[1400px]"
        style={{ paddingInline: "var(--space-4)", paddingBlock: "var(--space-6)" }}
      >
        <p
          className="uppercase tracking-[0.28em] text-magenta/80"
          style={{ fontSize: "var(--font-size-micro)" }}
        >
          {m.creators_eyebrow()}
        </p>
        <h1
          className="font-display font-bold tracking-tight"
          style={{ marginTop: "var(--space-2)", fontSize: "clamp(2rem, 5vw, var(--font-size-h1))" }}
        >
          {m.creators_title_1()} <span className="text-gradient-magenta italic">{m.creators_title_2()}</span>
        </h1>
        <p
          className="max-w-xl"
          style={{ marginTop: "var(--space-3)", fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}
        >
          {m.creators_subtitle()}
        </p>
        {isLoading ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-80 animate-pulse rounded-3xl border border-border/60 bg-surface/40" />
            ))}
          </div>
        ) : error ? (
          <p className="mt-8 text-sm text-destructive">Failed to load creators.</p>
        ) : creators.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-border/60 p-10 text-center">
            <h2 className="font-display text-2xl">No creators yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">Publish your first prompt to appear here.</p>
          </div>
        ) : (
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.04 } },
          }}
          className="grid sm:grid-cols-2 lg:grid-cols-3"
          style={{ marginTop: "var(--space-6)", gap: "var(--space-5)" }}
        >
          {creators.map((c, idx) => {
            const authorId = ids[idx];
            const following = !!authorId && followingIds.includes(authorId);
            return (
            <motion.div
              key={authorId ?? c.handle}
              variants={{
                hidden: { opacity: 0, y: 12 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
                },
              }}
              className="w-full [&>div]:w-full"
            >
              <CreatorCard
                c={c}
                following={following}
                disabled={!authorId || follow.isPending || (!!uid && uid === authorId)}
                onFollow={() => {
                  if (!authorId) return;
                  if (!uid) { navigate({ to: "/auth", search: { next: "/creators" } }); return; }
                  follow.mutate({ id: authorId, on: !following });
                }}
              />
            </motion.div>
            );
          })}
        </motion.div>
        )}

        <div
          className="surface-elevated rounded-3xl"
          style={{ marginTop: "var(--space-8)", padding: "var(--space-6)" }}
        >
          <p
            className="uppercase tracking-[0.28em] text-gold/80"
            style={{ fontSize: "var(--font-size-micro)" }}
          >
            {m.creators_earnings_eyebrow()}
          </p>
          <h2
            className="font-display font-semibold tracking-tight"
            style={{ marginTop: "var(--space-2)", fontSize: "clamp(1.5rem, 3vw, var(--font-size-h2))" }}
          >
            {m.creators_earnings_formula()}
          </h2>
          <p
            className="max-w-2xl"
            style={{ marginTop: "var(--space-4)", fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}
          >
            {m.creators_earnings_desc()}
          </p>
        </div>
      </section>
    </div>
  );
}