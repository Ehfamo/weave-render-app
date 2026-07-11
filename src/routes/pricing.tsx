import { createFileRoute, Link } from "@tanstack/react-router";
import { pageUrl } from "@/lib/seo";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { Header } from "@/components/xeomx/Header";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: m.pricing_head_title() },
      { name: "description", content: m.pricing_head_desc() },
      { property: "og:title", content: m.pricing_head_title() },
      { property: "og:description", content: m.pricing_head_desc() },
      { property: "og:type", content: "website" },
      { property: "og:url", content: pageUrl("/pricing") },
    ],
    links: [{ rel: "canonical", href: pageUrl("/pricing") }],
  }),
  component: PricingPage,
});

type Plan = {
  id: "free" | "pro" | "premium";
  name: string;
  price: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

function PricingPage() {
  const plans: Plan[] = [
    {
      id: "free",
      name: m.pricing_plan_free(),
      price: m.pricing_price_free(),
      cta: m.pricing_cta_free(),
      features: [
        m.pricing_free_f1(),
        m.pricing_free_f2(),
        m.pricing_free_f3(),
        m.pricing_free_f4(),
      ],
    },
    {
      id: "pro",
      name: m.pricing_plan_pro(),
      price: m.pricing_price_pro(),
      cta: m.pricing_cta_pro(),
      featured: true,
      features: [
        m.pricing_pro_f1(),
        m.pricing_pro_f2(),
        m.pricing_pro_f3(),
        m.pricing_pro_f4(),
        m.pricing_pro_f5(),
      ],
    },
    {
      id: "premium",
      name: m.pricing_plan_premium(),
      price: m.pricing_price_premium(),
      cta: m.pricing_cta_premium(),
      features: [
        m.pricing_premium_f1(),
        m.pricing_premium_f2(),
        m.pricing_premium_f3(),
        m.pricing_premium_f4(),
        m.pricing_premium_f5(),
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <section
        className="mx-auto max-w-[1200px] text-center"
        style={{ paddingInline: "var(--space-4)", paddingTop: "var(--space-9)", paddingBottom: "var(--space-7)" }}
      >
        <p
          className="uppercase tracking-[0.28em]"
          style={{ fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}
        >
          {m.pricing_eyebrow()}
        </p>
        <h1
          className="mx-auto font-display font-semibold tracking-tight"
          style={{
            marginTop: "var(--space-3)",
            fontSize: "clamp(2.25rem, 5vw, var(--font-size-h1))",
            maxWidth: "720px",
          }}
        >
          {m.pricing_title_1()} <span className="text-gradient-magenta italic">{m.pricing_title_2()}</span>
        </h1>
        <p
          className="mx-auto"
          style={{
            marginTop: "var(--space-4)",
            maxWidth: "560px",
            fontSize: "var(--font-size-body-lg)",
            color: "var(--text-muted)",
          }}
        >
          {m.pricing_subtitle()}
        </p>
      </section>

      <motion.section
        className="mx-auto grid max-w-[1200px] md:grid-cols-3"
        style={{
          paddingInline: "var(--space-4)",
          paddingBottom: "var(--space-9)",
          gap: "var(--space-5)",
        }}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        variants={{ show: { transition: { staggerChildren: 0.05 } } }}
      >
        {plans.map((plan) => (
          <motion.div
            key={plan.id}
            variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <PlanCard plan={plan} />
          </motion.div>
        ))}
      </motion.section>
    </div>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const featured = plan.featured;
  return (
    <div
      className="surface-raised relative flex h-full flex-col"
      style={{
        padding: "var(--space-6)",
        borderRadius: "var(--radius-lg)",
        border: featured
          ? "1px solid var(--action-primary)"
          : "1px solid var(--border-default)",
        boxShadow: featured ? "0 0 0 4px rgba(255,107,26,0.10)" : undefined,
      }}
    >
      {featured && (
        <span
          className="absolute -top-3 uppercase tracking-[0.22em]"
          style={{
            insetInlineStart: "50%",
            transform: "translateX(-50%)",
            background: "var(--color-gold-500)",
            color: "oklch(0.18 0.02 60)",
            paddingInline: "var(--space-3)",
            paddingBlock: "var(--space-1)",
            borderRadius: "var(--radius-sm)",
            fontSize: "var(--font-size-micro)",
            fontWeight: 600,
          }}
        >
          {m.pricing_most_popular()}
        </span>
      )}

      <h3
        className="font-display font-semibold"
        style={{ fontSize: "var(--font-size-h3)" }}
      >
        {plan.name}
      </h3>

      <div
        className="flex items-baseline"
        style={{ marginTop: "var(--space-4)", gap: "var(--space-2)" }}
      >
        <span
          className="font-display font-bold tracking-tight"
          style={{ fontSize: "var(--font-size-h1)" }}
        >
          {plan.price}
        </span>
        <span
          style={{
            fontSize: "var(--font-size-caption)",
            color: "var(--text-muted)",
          }}
        >
          {m.pricing_period()}
        </span>
      </div>

      <ul
        className="flex flex-col"
        style={{ marginTop: "var(--space-6)", gap: "var(--space-3)" }}
      >
        {plan.features.map((f) => (
          <li
            key={f}
            className="flex items-start"
            style={{ gap: "var(--space-3)", fontSize: "var(--font-size-body)" }}
          >
            <Check
              className="mt-0.5 h-4 w-4 shrink-0"
              style={{ color: featured ? "var(--action-primary)" : "var(--text-secondary)" }}
            />
            <span style={{ color: "var(--text-secondary)" }}>{f}</span>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: "var(--space-7)" }}>
        <Link
          to="/auth"
          search={{ next: undefined }}
          className="flex w-full items-center justify-center font-medium transition hover:opacity-90"
          style={
            featured
              ? {
                  background: "var(--action-primary)",
                  color: "#fff",
                  borderRadius: "var(--radius-sm)",
                  paddingBlock: "var(--space-3)",
                  fontSize: "var(--font-size-body)",
                }
              : {
                  border: "1px solid var(--border-default)",
                  color: "var(--text-secondary)",
                  borderRadius: "var(--radius-sm)",
                  paddingBlock: "var(--space-3)",
                  fontSize: "var(--font-size-body)",
                }
          }
        >
          {plan.cta}
        </Link>
      </div>
    </div>
  );
}