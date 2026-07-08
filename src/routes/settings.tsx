import { createFileRoute, Link } from "@tanstack/react-router";
import { pageUrl } from "@/lib/seo";
import { useState } from "react";
import { motion } from "motion/react";
import { User, ShieldCheck, Bell, CreditCard, Languages, Palette, KeyRound, ChevronRight, Lock } from "lucide-react";
import { Header } from "@/components/xeomx/Header";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: m.settings_head_title() },
      { name: "description", content: m.settings_head_desc() },
      { property: "og:title", content: m.settings_head_title() },
      { property: "og:description", content: m.settings_head_desc() },
      { property: "og:type", content: "website" },
      { property: "og:url", content: pageUrl("/settings") },
    ],
    links: [{ rel: "canonical", href: pageUrl("/settings") }],
  }),
  component: SettingsPage,
});

type SectionKey = "profile" | "account" | "privacy" | "notifications" | "billing" | "language" | "appearance";

function SettingsPage() {
  const [active, setActive] = useState<SectionKey>("account");

  const nav: { key: SectionKey; label: string; icon: typeof User }[] = [
    { key: "profile", label: m.settings_nav_profile(), icon: User },
    { key: "account", label: m.settings_nav_account(), icon: KeyRound },
    { key: "privacy", label: m.settings_nav_privacy(), icon: Lock },
    { key: "notifications", label: m.settings_nav_notifications(), icon: Bell },
    { key: "billing", label: m.settings_nav_billing(), icon: CreditCard },
    { key: "language", label: m.settings_nav_language(), icon: Languages },
    { key: "appearance", label: m.settings_nav_appearance(), icon: Palette },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <div
        className="mx-auto max-w-[1200px]"
        style={{ paddingInline: "var(--space-4)", paddingBlock: "var(--space-8)" }}
      >
        <h1
          className="font-display font-semibold tracking-tight"
          style={{ fontSize: "clamp(2rem, 4vw, var(--font-size-h1))", marginBottom: "var(--space-7)" }}
        >
          {m.settings_title()}
        </h1>

        <div
          className="grid lg:grid-cols-[240px_minmax(0,1fr)]"
          style={{ gap: "var(--space-7)" }}
        >
          <aside>
            <nav
              className="flex flex-col"
              style={{ gap: "var(--space-1)" }}
              aria-label="Settings navigation"
            >
              {nav.map((item) => {
                const isActive = active === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setActive(item.key)}
                    className="group flex items-center text-start transition"
                    style={{
                      gap: "var(--space-3)",
                      paddingInline: "var(--space-4)",
                      paddingBlock: "var(--space-3)",
                      borderInlineStart: `2px solid ${isActive ? "var(--action-primary)" : "transparent"}`,
                      borderRadius: "var(--radius-sm)",
                      color: isActive ? "var(--action-primary)" : "var(--text-secondary)",
                      fontSize: "var(--font-size-body)",
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          <motion.section
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {active === "account" ? <AccountSection /> : <StubSection label={nav.find((n) => n.key === active)!.label} />}
          </motion.section>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <header style={{ marginBottom: "var(--space-6)" }}>
      <h2
        className="font-display font-semibold tracking-tight"
        style={{ fontSize: "var(--font-size-h2)" }}
      >
        {title}
      </h2>
      {desc && (
        <p
          style={{
            marginTop: "var(--space-2)",
            fontSize: "var(--font-size-body)",
            color: "var(--text-muted)",
          }}
        >
          {desc}
        </p>
      )}
    </header>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  desc,
  value,
  action,
}: {
  icon: typeof User;
  label: string;
  desc: string;
  value?: string;
  action: React.ReactNode;
}) {
  return (
    <div
      className="surface-raised flex flex-wrap items-center justify-between"
      style={{
        padding: "var(--space-5)",
        borderRadius: "var(--radius-lg)",
        gap: "var(--space-4)",
      }}
    >
      <div className="flex items-start" style={{ gap: "var(--space-4)" }}>
        <span
          className="grid place-items-center"
          style={{
            width: 40,
            height: 40,
            borderRadius: "var(--radius-sm)",
            background: "var(--surface-elevated)",
            color: "var(--text-secondary)",
          }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p style={{ fontSize: "var(--font-size-body)", fontWeight: 500 }}>{label}</p>
          <p
            style={{
              marginTop: "var(--space-1)",
              fontSize: "var(--font-size-caption)",
              color: "var(--text-muted)",
            }}
          >
            {desc}
          </p>
          {value && (
            <p
              style={{
                marginTop: "var(--space-2)",
                fontSize: "var(--font-size-caption)",
                color: "var(--text-secondary)",
              }}
            >
              {value}
            </p>
          )}
        </div>
      </div>
      <div>{action}</div>
    </div>
  );
}

function AccountSection() {
  return (
    <div>
      <SectionHeader title={m.settings_account_title()} desc={m.settings_account_desc()} />
      <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
        <SettingsRow
          icon={Languages}
          label={m.settings_language_label()}
          desc={m.settings_language_desc()}
          action={
            <Link
              to="/"
              className="inline-flex items-center transition hover:text-foreground"
              style={{
                gap: "var(--space-2)",
                fontSize: "var(--font-size-caption)",
                color: "var(--text-muted)",
              }}
            >
              {m.settings_security_action()} <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <SettingsRow
          icon={ShieldCheck}
          label={m.settings_security_label()}
          desc={m.settings_security_desc()}
          action={
            <button
              className="inline-flex items-center text-foreground transition hover:bg-surface"
              style={{
                gap: "var(--space-2)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)",
                paddingInline: "var(--space-4)",
                paddingBlock: "var(--space-2)",
                fontSize: "var(--font-size-caption)",
              }}
            >
              {m.settings_security_action()}
            </button>
          }
        />
        <SettingsRow
          icon={CreditCard}
          label={m.settings_subscription_label()}
          desc={m.settings_subscription_free()}
          action={
            <Link
              to="/pricing"
              className="inline-flex items-center font-medium text-white transition hover:opacity-90"
              style={{
                background: "var(--action-primary)",
                borderRadius: "var(--radius-sm)",
                paddingInline: "var(--space-4)",
                paddingBlock: "var(--space-2)",
                fontSize: "var(--font-size-caption)",
              }}
            >
              {m.settings_subscription_manage()}
            </Link>
          }
        />
      </div>
    </div>
  );
}

function StubSection({ label }: { label: string }) {
  return (
    <div>
      <SectionHeader title={label} />
      <div
        className="surface-raised"
        style={{
          padding: "var(--space-7)",
          borderRadius: "var(--radius-lg)",
          fontSize: "var(--font-size-body)",
          color: "var(--text-muted)",
          textAlign: "center",
        }}
      >
        {m.settings_section_stub()}
      </div>
    </div>
  );
}