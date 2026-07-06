import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/xeomx/Header";
import { motion } from "motion/react";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: m.privacy_head_title() },
      { name: "description", content: m.privacy_head_desc() },
      { property: "og:title", content: m.privacy_head_title() },
      { property: "og:description", content: m.privacy_head_desc() },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-svh bg-background">
      <Header />
      <motion.article
        className="mx-auto"
        style={{ maxWidth: "700px", paddingInline: "var(--space-4)", paddingBlock: "var(--space-12)" }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <Link
          to="/"
          className="inline-flex items-center gap-2 transition hover:text-foreground"
          style={{ marginBottom: "var(--space-8)", fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {m.explore_hero_back()}
        </Link>
        <h1
          className="font-display font-bold tracking-tight"
          style={{ fontSize: "clamp(2rem, 4vw, var(--font-size-h1))" }}
        >
          {m.privacy_title()}
        </h1>
        <p
          className="uppercase tracking-[0.2em]"
          style={{ marginTop: "var(--space-3)", fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}
        >
          {m.legal_updated()}
        </p>
        <div
          className="whitespace-pre-line"
          style={{ marginTop: "var(--space-8)", fontSize: "var(--font-size-body)", lineHeight: 1.7, color: "var(--text-muted)" }}
        >
          {m.privacy_body()}
        </div>
      </motion.article>
    </div>
  );
}