import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, LifeBuoy, CreditCard, Briefcase, Newspaper, Handshake, Clock, MessageCircle } from "lucide-react";
import { Header } from "@/components/xeomx/Header";
import { SupportDrawer } from "@/components/xeomx/SupportDrawer";
import { buildSeo, SITE_URL, pageUrl } from "@/lib/seo";
import type { ContactCategory } from "@/lib/contact.functions";

export const Route = createFileRoute("/contact")({
  head: () => {
    const seo = buildSeo({
      path: "/contact",
      title: "Contact & Support — XeomX",
      description:
        "Talk to XeomX. Get help from the right team fast — general, technical support, billing, partnerships, press, and careers.",
    });
    return {
      ...seo,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ContactPage",
            name: "Contact XeomX",
            url: pageUrl("/contact"),
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "XeomX",
            url: SITE_URL,
            email: "hello@xeomx.com",
            contactPoint: [
              { "@type": "ContactPoint", contactType: "customer support", email: "hello@xeomx.com", availableLanguage: ["en", "fa", "ar", "zh", "hi"] },
            ],
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
              { "@type": "ListItem", position: 2, name: "Contact", item: pageUrl("/contact") },
            ],
          }),
        },
      ],
    };
  },
  component: ContactPage,
});

const DEPARTMENTS: Array<{
  category: ContactCategory;
  title: string;
  desc: string;
  Icon: typeof Mail;
  sla: string;
}> = [
  { category: "general", title: "General", desc: "Questions, feedback, hello.", Icon: Mail, sla: "≤ 24h" },
  { category: "support", title: "Technical Support", desc: "Bugs, account, prompt issues.", Icon: LifeBuoy, sla: "≤ 12h" },
  { category: "billing", title: "Billing & Payments", desc: "Invoices, refunds, subscriptions.", Icon: CreditCard, sla: "≤ 24h" },
  { category: "partnerships", title: "Partnerships", desc: "Integrations, co-marketing, deals.", Icon: Handshake, sla: "≤ 3d" },
  { category: "press", title: "Press & Media", desc: "Interviews, brand kit, quotes.", Icon: Newspaper, sla: "≤ 3d" },
  { category: "careers", title: "Careers", desc: "Join the team.", Icon: Briefcase, sla: "Rolling" },
];

const FAQS = [
  { q: "How fast will I get a reply?", a: "Support responds within 12 business hours. Other departments within 1–3 business days." },
  { q: "Can I request a refund?", a: "Yes — see our Refund Policy. Contact Billing with your order ID and we'll take it from there." },
  { q: "Do you offer partnerships or affiliate deals?", a: "Absolutely. Reach out via the Partnerships category with a short overview." },
  { q: "Where can I follow XeomX?", a: "@xeomxai on X. More platforms rolling out soon." },
];

function ContactPage() {
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<ContactCategory>("general");

  const openWith = (c: ContactCategory) => {
    setInitial(c);
    setOpen(true);
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-[1100px] px-4 py-16 sm:px-8">
        {/* Hero */}
        <section className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Contact & Support</p>
          <h1 className="mt-3 font-display font-bold" style={{ fontSize: "var(--font-size-display)" }}>
            We're here to help.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
            Pick a department and we'll connect you with the right team. Most replies land in under a day.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => openWith("general")}
              className="inline-flex min-h-11 items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "var(--gradient-magenta)", boxShadow: "var(--shadow-glow)" }}
            >
              <MessageCircle className="h-4 w-4" /> Start a conversation
            </button>
            <a
              href="mailto:hello@xeomx.com"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface/40 px-6 py-3 text-sm font-medium text-foreground transition hover:bg-surface"
            >
              <Mail className="h-4 w-4" /> hello@xeomx.com
            </a>
          </div>
        </section>

        {/* Department cards */}
        <section aria-labelledby="departments" className="mt-16">
          <h2 id="departments" className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Choose a department
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DEPARTMENTS.map(({ category, title, desc, Icon, sla }) => (
              <button
                key={category}
                type="button"
                onClick={() => openWith(category)}
                className="group text-start rounded-2xl border border-border/60 bg-surface/40 p-5 transition hover:border-magenta/50 hover:bg-surface"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg border border-border/60 bg-surface text-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="font-display text-base font-semibold">{title}</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{desc}</p>
                <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" /> Response {sla}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* Business hours + response */}
        <section className="mt-16 grid gap-4 rounded-2xl border border-border/60 bg-surface/30 p-6 sm:grid-cols-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Business hours</h3>
            <p className="mt-2 text-sm text-foreground">Mon–Fri · 9:00–18:00 (UTC)</p>
            <p className="text-xs text-muted-foreground">Closed on major holidays.</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Support SLA</h3>
            <p className="mt-2 text-sm text-foreground">First reply within 12h</p>
            <p className="text-xs text-muted-foreground">Priority given to paid plans.</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Languages</h3>
            <p className="mt-2 text-sm text-foreground">EN · فارسی · العربية · 中文 · हिन्दी</p>
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq" className="mt-16">
          <h2 id="faq" className="font-display text-2xl font-bold">Frequently asked</h2>
          <div className="mt-4 divide-y divide-border/60 rounded-2xl border border-border/60 bg-surface/30">
            {FAQS.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="cursor-pointer list-none text-sm font-medium text-foreground marker:hidden">
                  {f.q}
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Company info */}
        <section className="mt-16 border-t border-border/60 pt-8 text-sm text-muted-foreground">
          <p><span className="text-foreground">XeomX</span> — Cinematic AI prompt marketplace.</p>
          <p className="mt-1">General: <a className="text-foreground hover:underline" href="mailto:hello@xeomx.com">hello@xeomx.com</a></p>
        </section>
      </main>

      <SupportDrawer open={open} onOpenChange={setOpen} initialCategory={initial} />
    </div>
  );
}
