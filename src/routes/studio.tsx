import { createFileRoute } from "@tanstack/react-router";
import { pageUrl } from "@/lib/seo";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles } from "lucide-react";
import { Header } from "@/components/xeomx/Header";
import { PreviewNotice } from "@/components/xeomx/status/PreviewNotice";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: m.studio_head_title() },
      { name: "description", content: m.studio_head_desc() },
      { property: "og:title", content: m.studio_head_title() },
      { property: "og:description", content: m.studio_head_desc() },
      { property: "og:type", content: "website" },
      { property: "og:url", content: pageUrl("/studio") },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [{ rel: "canonical", href: pageUrl("/studio") }],
  }),
  component: StudioPage,
});

type StudioState = "empty" | "generating" | "result";

const PRESETS = [
  { id: "cinematic", label: () => m.studio_preset_cinematic(), gradient: "linear-gradient(135deg, #ff6b1a, #b40f5b)" },
  { id: "anime", label: () => m.studio_preset_anime(), gradient: "linear-gradient(135deg, #ff2e8a, #4da3ff)" },
  { id: "editorial", label: () => m.studio_preset_editorial(), gradient: "linear-gradient(135deg, #ffc14d, #ff6b1a)" },
];

const HISTORY = [
  "linear-gradient(135deg, #ff6b1a, #890a44)",
  "linear-gradient(135deg, #4da3ff, #b40f5b)",
  "linear-gradient(135deg, #ffc14d, #e8570d)",
  "linear-gradient(135deg, #ff2e8a, #1b1b1b)",
];

const RESULT_GRADIENT = "linear-gradient(135deg, #ff6b1a 0%, #ff2e8a 50%, #4da3ff 100%)";

function StudioPage() {
  const [state, setState] = useState<StudioState>("result");
  const [activePreset, setActivePreset] = useState<string>("cinematic");
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (state !== "generating") return;
    setPct(0);
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(100, Math.round(((now - t0) / 1200) * 100));
      setPct(p);
      if (p < 100) raf = requestAnimationFrame(tick);
      else setState("result");
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-primary)" }}>
      <Header />
      <div style={{ paddingInline: "var(--space-6)", paddingTop: "var(--space-4)" }}>
        <PreviewNotice status="preview" />
      </div>

      {/* Studio sub-header */}
      <div
        style={{
          borderBlockEnd: "1px solid var(--border-subtle)",
          paddingBlock: "var(--space-4)",
          paddingInline: "var(--space-6)",
        }}
        className="flex items-center justify-between"
      >
        <h1 style={{ fontSize: "var(--font-size-h3)", color: "var(--text-primary)" }} className="font-semibold">
          {m.studio_title()}
        </h1>
        <div className="flex items-center" style={{ gap: "var(--space-4)" }}>
          <span
            style={{
              fontSize: "var(--font-size-caption)",
              color: "var(--color-orange-500)",
              paddingInline: "var(--space-3)",
              paddingBlock: "var(--space-1)",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface-glass)",
              border: "1px solid var(--border-default)",
            }}
          >
            {m.studio_credits({ count: 480 })}
          </span>
          <div
            style={{ background: "var(--gradient-magenta)" }}
            className="grid h-8 w-8 place-items-center rounded-full text-xs font-semibold text-white"
          >
            U
          </div>
        </div>
      </div>

      {/* 3-column workspace */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: "300px 1fr 300px",
          minHeight: "calc(100vh - 140px)",
        }}
      >
        {/* LEFT RAIL */}
        <aside
          style={{
            background: "var(--surface-primary)",
            borderInlineEnd: "1px solid var(--border-subtle)",
            padding: "var(--space-5)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-5)",
          }}
        >
          <Section label={m.studio_prompt_label()}>
            <textarea
              defaultValue=""
              placeholder={m.studio_prompt_placeholder()}
              className="surface-elevated w-full resize-none focus:outline-none"
              style={{
                minHeight: 140,
                padding: "var(--space-3)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-primary)",
                fontSize: "var(--font-size-caption)",
                border: "1px solid var(--border-default)",
                lineHeight: 1.5,
              }}
            />
          </Section>

          <Section label={m.studio_presets_label()}>
            <div className="flex flex-wrap" style={{ gap: "var(--space-2)" }}>
              {PRESETS.map((p) => {
                const active = activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setActivePreset(p.id)}
                    style={{
                      paddingInline: "var(--space-3)",
                      paddingBlock: "var(--space-2)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "var(--font-size-caption)",
                      background: active ? "var(--action-primary)" : "var(--surface-glass)",
                      color: active ? "#fff" : "var(--text-secondary)",
                      border: `1px solid ${active ? "var(--action-primary)" : "var(--border-default)"}`,
                      transition: `all var(--motion-duration-fast) var(--motion-ease)`,
                    }}
                  >
                    {p.label()}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section label={m.studio_parameters_label()}>
            <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
              <ParamRow label={m.studio_param_aspect()} value="3:4" />
              <ParamRow label={m.studio_param_style()} value="72%" />
              <ParamRow label={m.studio_param_seed()} value={m.studio_seed_random()} />
            </div>
          </Section>

          <div style={{ marginBlockStart: "auto" }}>
            <button
              onClick={() => setState("generating")}
              className="w-full font-semibold text-white transition"
              style={{
                background: "var(--action-primary)",
                borderRadius: "var(--radius-sm)",
                paddingBlock: "var(--space-3)",
                fontSize: "var(--font-size-body)",
                boxShadow: "var(--elevation-elevated)",
              }}
            >
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> {m.studio_generate()}
              </span>
            </button>
          </div>
        </aside>

        {/* CENTER CANVAS */}
        <section
          className="relative flex items-center justify-center"
          style={{
            padding: "var(--space-6)",
            background: `radial-gradient(60% 60% at 50% 40%, var(--surface-elevated) 0%, var(--surface-primary) 80%)`,
          }}
        >
          <div
            className="relative overflow-hidden"
            style={{
              width: "min(560px, 100%)",
              aspectRatio: "3 / 4",
              borderRadius: "var(--radius-lg)",
              background: "var(--surface-tertiary)",
              border: "1px solid var(--border-default)",
              boxShadow: "var(--elevation-floating)",
            }}
          >
            <AnimatePresence mode="wait">
              {state === "empty" && <EmptyCanvas key="empty" />}
              {state === "generating" && <GeneratingCanvas key="gen" pct={pct} />}
              {state === "result" && <ResultCanvas key="res" />}
            </AnimatePresence>
          </div>

          {/* Dev state toggles */}
          <div
            className="absolute flex"
            style={{
              insetBlockEnd: "var(--space-5)",
              gap: "var(--space-2)",
              padding: "var(--space-1)",
              background: "var(--surface-overlay)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {(["empty", "generating", "result"] as StudioState[]).map((s) => (
              <button
                key={s}
                onClick={() => setState(s)}
                style={{
                  paddingInline: "var(--space-3)",
                  paddingBlock: "var(--space-1)",
                  borderRadius: "var(--radius-xs)",
                  fontSize: "var(--font-size-micro)",
                  color: state === s ? "#fff" : "var(--text-muted)",
                  background: state === s ? "var(--action-primary)" : "transparent",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {s === "empty" ? m.studio_state_empty() : s === "generating" ? m.studio_state_generating() : m.studio_state_result()}
              </button>
            ))}
          </div>
        </section>

        {/* RIGHT RAIL */}
        <aside
          style={{
            background: "var(--surface-primary)",
            borderInlineStart: "1px solid var(--border-subtle)",
            padding: "var(--space-5)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
          }}
        >
          <Section label={m.studio_history_label()}>
            <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
              {HISTORY.map((g, i) => (
                <motion.button
                  key={i}
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="surface-raised w-full overflow-hidden"
                  style={{
                    height: 90,
                    borderRadius: "var(--radius-md)",
                    background: g,
                    border: "1px solid var(--border-default)",
                  }}
                  aria-label={`history-${i + 1}`}
                />
              ))}
            </div>
          </Section>
        </aside>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
      <span
        style={{
          fontSize: "var(--font-size-micro)",
          color: "var(--text-muted)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function ParamRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        paddingInline: "var(--space-3)",
        paddingBlock: "var(--space-2)",
        borderRadius: "var(--radius-sm)",
        background: "var(--surface-glass)",
        border: "1px solid var(--border-subtle)",
        fontSize: "var(--font-size-caption)",
      }}
    >
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ color: "var(--text-primary)" }} className="font-medium">
        {value}
      </span>
    </div>
  );
}

function EmptyCanvas() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-full w-full flex-col items-center justify-center"
      style={{ padding: "var(--space-6)", gap: "var(--space-5)" }}
    >
      <p
        style={{
          fontSize: "var(--font-size-body-lg)",
          color: "var(--text-secondary)",
          textAlign: "center",
          maxWidth: 320,
        }}
      >
        {m.studio_empty_title()}
      </p>
      <div className="grid grid-cols-3" style={{ gap: "var(--space-3)", width: "100%", maxWidth: 380 }}>
        {PRESETS.map((p) => (
          <div
            key={p.id}
            className="surface-raised overflow-hidden"
            style={{
              aspectRatio: "3 / 4",
              borderRadius: "var(--radius-md)",
              background: p.gradient,
              border: "1px solid var(--border-default)",
            }}
          >
            <div
              className="flex h-full w-full items-end"
              style={{ padding: "var(--space-2)", background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.55) 100%)" }}
            >
              <span style={{ fontSize: "var(--font-size-micro)", color: "#fff" }} className="font-semibold">
                {p.label()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function GeneratingCanvas({ pct }: { pct: number }) {
  const bands = 6;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="relative h-full w-full"
      style={{ background: "var(--surface-secondary)" }}
    >
      <div className="absolute inset-0 flex flex-col">
        {Array.from({ length: bands }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: (i * 1.2) / bands, ease: [0.22, 1, 0.36, 1] }}
            style={{
              flex: 1,
              background: RESULT_GRADIENT,
              filter: `blur(${12 - i}px)`,
              opacity: 0.55 + i * 0.06,
            }}
          />
        ))}
      </div>
      <div
        className="absolute"
        style={{
          insetBlockStart: "var(--space-3)",
          insetInlineStart: "var(--space-3)",
          paddingInline: "var(--space-3)",
          paddingBlock: "var(--space-1)",
          borderRadius: "var(--radius-xs)",
          background: "var(--surface-overlay)",
          fontSize: "var(--font-size-caption)",
          color: "var(--color-orange-400)",
        }}
      >
        {m.studio_rendering({ pct })}
      </div>
    </motion.div>
  );
}

function ResultCanvas() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative h-full w-full"
      style={{ background: RESULT_GRADIENT }}
    >
      <div
        className="absolute h-full w-full"
        style={{ background: "radial-gradient(80% 60% at 30% 30%, rgba(255,255,255,0.18), transparent 60%)" }}
      />
      <div
        className="absolute"
        style={{
          insetBlockStart: "var(--space-3)",
          insetInlineStart: "var(--space-3)",
          paddingInline: "var(--space-3)",
          paddingBlock: "var(--space-1)",
          borderRadius: "var(--radius-xs)",
          background: "var(--surface-overlay)",
          fontSize: "var(--font-size-caption)",
          color: "var(--text-primary)",
        }}
      >
        {m.studio_result_label()}
      </div>
    </motion.div>
  );
}