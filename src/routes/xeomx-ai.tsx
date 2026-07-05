import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles, ChevronDown, Command, Bell, Wand2, Info, RefreshCw,
  Filter, CheckCircle2, Orbit, CircleDot, Activity, RotateCcw,
  Shuffle, Maximize2, MoveRight, Pencil, Code2, Eye, Terminal, FileText,
} from "lucide-react";
import { Header } from "@/components/xeomx/Header";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/xeomx-ai")({
  head: () => ({
    meta: [
      { title: m.xai_head_title() },
      { name: "description", content: m.xai_head_desc() },
      { property: "og:title", content: m.xai_head_title() },
      { property: "og:description", content: m.xai_head_desc() },
    ],
  }),
  component: XeomxAIPage,
});

const CHIPS = [
  { id: "cinematic", label: () => m.xai_chip_cinematic() },
  { id: "prototype", label: () => m.xai_chip_prototype() },
  { id: "shortfilm", label: () => m.xai_chip_shortfilm() },
  { id: "story", label: () => m.xai_chip_story() },
  { id: "identity", label: () => m.xai_chip_identity() },
  { id: "code", label: () => m.xai_chip_code() },
  { id: "more", label: () => m.xai_chip_more() },
];

const ASPECTS = ["16:9", "21:9", "4:5", "1:1", "9:16"];

const SCENE_GRADIENT =
  "radial-gradient(80% 60% at 30% 30%, #ff8b3d 0%, transparent 55%), radial-gradient(70% 60% at 75% 55%, #ff2e8a 0%, transparent 60%), radial-gradient(60% 60% at 50% 90%, #4da3ff 0%, transparent 60%), linear-gradient(180deg, #0e0e0e 0%, #1b0a14 100%)";

const VARIANT_GRADIENTS = [
  SCENE_GRADIENT,
  "linear-gradient(135deg, #ff6b1a, #890a44)",
  "linear-gradient(135deg, #4da3ff, #b40f5b)",
  "linear-gradient(135deg, #ffc14d, #ff2e8a)",
  "linear-gradient(135deg, #ff2e8a, #1b1b1b)",
];

type ThreadType = "visual" | "code" | "narrative" | "motion";
type ThreadItem = {
  type: ThreadType;
  title: string;
  time: string;
  desc: string;
  tag?: string;
  thumb?: string;
  color: string;
};

function XeomxAIPage() {
  const [chip, setChip] = useState("cinematic");
  const [aspect, setAspect] = useState("16:9");
  const [tab, setTab] = useState<"code" | "preview" | "console" | "files">("preview");
  const [filter, setFilter] = useState<"all" | ThreadType>("all");
  const [intention, setIntention] = useState<string>(m.xai_intention_example());

  const thread: ThreadItem[] = [
    { type: "narrative", title: m.xai_thread_intent(), time: "00:00", desc: m.xai_thread_intent_desc(), tag: m.xai_chip_cinematic(), color: "var(--color-magenta-500)" },
    { type: "visual", title: m.xai_thread_image(), time: "00:04", desc: m.xai_thread_image_desc(), thumb: SCENE_GRADIENT, color: "var(--color-orange-500)" },
    { type: "narrative", title: m.xai_thread_narrative(), time: "00:12", desc: m.xai_thread_narrative_desc(), tag: m.xai_chip_story(), color: "var(--color-magenta-500)" },
    { type: "visual", title: m.xai_thread_ui(), time: "00:24", desc: m.xai_thread_ui_desc(), tag: m.xai_chip_prototype(), color: "var(--color-success)" },
    { type: "code", title: m.xai_thread_code(), time: "00:31", desc: m.xai_thread_code_desc(), tag: m.xai_chip_code(), color: "var(--color-info)" },
    { type: "motion", title: m.xai_thread_video(), time: "00:44", desc: m.xai_thread_video_desc(), tag: m.xai_chip_shortfilm(), color: "var(--color-error)" },
  ];
  const visibleThread = filter === "all" ? thread : thread.filter((t) => t.type === filter);

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-primary)" }}>
      <Header />

      {/* Sub-header: wordmark + intent bar + chips */}
      <div
        style={{
          borderBlockEnd: "1px solid var(--border-subtle)",
          paddingInline: "var(--space-6)",
          paddingBlock: "var(--space-4)",
          background: "var(--surface-primary)",
        }}
        className="flex flex-col"
      >
        <div className="flex items-center" style={{ gap: "var(--space-5)" }}>
          <button className="inline-flex items-center gap-1 font-semibold" style={{ fontSize: "var(--font-size-body-lg)", color: "var(--text-primary)" }}>
            {m.nav_xeomx_ai()} <ChevronDown className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
          </button>

          {/* Intent bar */}
          <div className="relative flex-1" style={{ maxWidth: 640, marginInline: "auto" }}>
            <input
              placeholder={m.xai_intent_placeholder()}
              className="w-full"
              style={{
                paddingInline: "var(--space-4)",
                paddingBlock: "var(--space-3)",
                borderRadius: "var(--radius-md)",
                background: "var(--surface-elevated)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
                fontSize: "var(--font-size-body)",
                outline: "none",
              }}
            />
            <span
              className="absolute inline-flex items-center"
              style={{
                insetInlineEnd: "var(--space-3)",
                insetBlockStart: "50%",
                transform: "translateY(-50%)",
                gap: "var(--space-1)",
                paddingInline: "var(--space-2)",
                paddingBlock: 2,
                borderRadius: "var(--radius-xs)",
                background: "var(--surface-glass)",
                border: "1px solid var(--border-default)",
                fontSize: "var(--font-size-micro)",
                color: "var(--text-muted)",
              }}
            >
              <Command className="h-3 w-3" /> K
            </span>
          </div>

          {/* Right cluster */}
          <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
            <IconBtn><Command className="h-4 w-4" /></IconBtn>
            <IconBtn><Sparkles className="h-4 w-4" /></IconBtn>
            <IconBtn><Wand2 className="h-4 w-4" /></IconBtn>
            <div className="relative">
              <IconBtn><Bell className="h-4 w-4" /></IconBtn>
              <span
                className="absolute grid place-items-center rounded-full font-semibold text-white"
                style={{
                  insetBlockStart: -2, insetInlineEnd: -2, width: 16, height: 16,
                  fontSize: 10, background: "var(--action-primary)",
                }}
              >3</span>
            </div>
            <div
              className="grid place-items-center rounded-full text-xs font-semibold text-white"
              style={{ width: 32, height: 32, background: "var(--gradient-magenta)" }}
            >U</div>
          </div>
        </div>

        {/* Chips */}
        <div className="flex flex-wrap items-center" style={{ gap: "var(--space-2)", marginBlockStart: "var(--space-4)" }}>
          {CHIPS.map((c) => {
            const active = chip === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setChip(c.id)}
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
                {c.label()}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3-column workspace */}
      <div className="grid" style={{ gridTemplateColumns: "300px 1fr 320px", minHeight: "calc(100vh - 200px)" }}>

        {/* LEFT RAIL */}
        <aside style={leftRailStyle}>
          {/* Section header */}
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center" style={{ gap: "var(--space-2)" }}>
              <span style={labelStyle}>{m.xai_left_title()}</span>
              <Info className="h-3 w-3" style={{ color: "var(--text-muted)" }} />
            </div>
            <button
              className="inline-flex items-center gap-1"
              style={{
                paddingInline: "var(--space-2)", paddingBlock: 4, borderRadius: "var(--radius-xs)",
                background: "var(--surface-glass)", border: "1px solid var(--border-default)",
                fontSize: "var(--font-size-micro)", color: "var(--text-secondary)",
              }}
            >
              <Sparkles className="h-3 w-3" style={{ color: "var(--color-orange-500)" }} /> {m.xai_auto_enhance()}
            </button>
          </div>

          {/* Intention textarea */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={microLabel}>{m.xai_your_intention()}</span>
            <div className="relative">
              <textarea
                value={intention}
                onChange={(e) => setIntention(e.target.value.slice(0, 500))}
                className="surface-elevated w-full resize-none focus:outline-none"
                style={{
                  minHeight: 96, padding: "var(--space-3)", borderRadius: "var(--radius-sm)",
                  color: "var(--text-primary)", fontSize: "var(--font-size-caption)",
                  border: "1px solid var(--border-default)", lineHeight: 1.5,
                }}
              />
              <span
                className="absolute"
                style={{
                  insetBlockEnd: "var(--space-2)", insetInlineEnd: "var(--space-2)",
                  fontSize: "var(--font-size-micro)", color: "var(--text-muted)",
                }}
              >{m.xai_char_count({ count: intention.length })}</span>
            </div>
          </div>

          {/* Mode Guidance */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={microLabel}>{m.xai_mode_guidance()}</span>
            <div
              className="surface-elevated"
              style={{
                padding: "var(--space-3)", borderRadius: "var(--radius-sm)",
                borderInlineStart: "2px solid var(--action-primary)",
              }}
            >
              <div style={{ fontSize: "var(--font-size-caption)", color: "var(--text-primary)", fontWeight: 600 }}>
                {m.xai_mode_cinematic_title()}
              </div>
              <div style={{ fontSize: "var(--font-size-micro)", color: "var(--text-muted)", marginBlockStart: 4, lineHeight: 1.5 }}>
                {m.xai_mode_cinematic_desc()}
              </div>
            </div>
          </div>

          {/* Visual settings */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <div className="flex items-center justify-between">
              <span style={labelStyle}>{m.xai_visual_settings()}</span>
              <RefreshCw className="h-3 w-3" style={{ color: "var(--text-muted)" }} />
            </div>

            <div>
              <div style={microLabel}>{m.xai_aspect_ratio()}</div>
              <div className="flex flex-wrap" style={{ gap: 4, marginBlockStart: 6 }}>
                {ASPECTS.map((a) => {
                  const active = aspect === a;
                  return (
                    <button
                      key={a}
                      onClick={() => setAspect(a)}
                      style={{
                        paddingInline: "var(--space-2)", paddingBlock: 4,
                        borderRadius: "var(--radius-xs)",
                        fontSize: "var(--font-size-micro)",
                        background: active ? "var(--action-primary)" : "var(--surface-glass)",
                        color: active ? "#fff" : "var(--text-secondary)",
                        border: `1px solid ${active ? "var(--action-primary)" : "var(--border-default)"}`,
                      }}
                    >{a}</button>
                  );
                })}
              </div>
            </div>

            <DropdownRow label={m.xai_style()} value={m.xai_style_value()} />
            <DropdownRow label={m.xai_lighting()} value={m.xai_lighting_value()} />
            <DropdownRow label={m.xai_mood()} value={m.xai_mood_value()} />

            {/* Color tone gradient slider */}
            <div>
              <div style={microLabel}>{m.xai_color_tone()}</div>
              <div
                className="relative"
                style={{
                  height: 8, borderRadius: 999, marginBlockStart: 8,
                  background: "linear-gradient(90deg, #ff6b1a, #ff2e8a, #b40f5b, #4da3ff)",
                }}
              >
                <div
                  className="absolute rounded-full"
                  style={{
                    insetBlockStart: -4, insetInlineStart: "42%",
                    width: 16, height: 16, background: "#fff",
                    boxShadow: "var(--elevation-elevated)", border: "2px solid var(--surface-primary)",
                  }}
                />
              </div>
            </div>

            {/* Detail intensity slider */}
            <div>
              <div className="flex items-center justify-between">
                <span style={microLabel}>{m.xai_detail_intensity()}</span>
                <span style={{ fontSize: "var(--font-size-micro)", color: "var(--color-orange-400)" }}>90%</span>
              </div>
              <div className="relative" style={{ height: 4, borderRadius: 999, background: "var(--surface-glass)", marginBlockStart: 8 }}>
                <div style={{ width: "90%", height: "100%", borderRadius: 999, background: "var(--action-primary)" }} />
                <div
                  className="absolute rounded-full"
                  style={{
                    insetBlockStart: -4, insetInlineStart: "calc(90% - 6px)",
                    width: 12, height: 12, background: "#fff",
                    boxShadow: "var(--elevation-raised)",
                  }}
                />
              </div>
            </div>

            <DropdownRow label={m.xai_camera_language()} value={m.xai_camera_value()} />
            <DropdownRow label={m.xai_depth()} value={m.xai_depth_value()} />
          </div>

          {/* Advanced collapsible */}
          <button
            className="flex w-full items-center justify-between"
            style={{
              paddingBlock: "var(--space-2)",
              borderBlockStart: "1px solid var(--border-subtle)",
              borderBlockEnd: "1px solid var(--border-subtle)",
              fontSize: "var(--font-size-micro)",
              color: "var(--text-muted)",
              letterSpacing: "0.12em",
            }}
          >
            {m.xai_advanced()}
            <ChevronDown className="h-3 w-3" />
          </button>

          {/* Generate + Surprise Me */}
          <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
            <button
              className="w-full font-semibold text-white"
              style={{
                background: "var(--action-primary)",
                borderRadius: "var(--radius-sm)",
                paddingBlock: "var(--space-3)",
                fontSize: "var(--font-size-body)",
                boxShadow: "var(--elevation-elevated)",
              }}
            >
              <span className="inline-flex w-full items-center justify-center" style={{ gap: "var(--space-2)" }}>
                <Sparkles className="h-4 w-4" /> {m.xai_generate()}
                <span
                  style={{
                    marginInlineStart: "auto",
                    paddingInline: 6, paddingBlock: 2,
                    borderRadius: "var(--radius-xs)",
                    background: "rgba(0,0,0,0.25)",
                    fontSize: "var(--font-size-micro)",
                  }}
                >{m.xai_shortcut_cmdenter()}</span>
              </span>
            </button>
            <button
              className="w-full"
              style={{
                background: "transparent",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)",
                paddingBlock: "var(--space-2)",
                fontSize: "var(--font-size-caption)",
                color: "var(--text-secondary)",
              }}
            >{m.xai_surprise()}</button>
          </div>
        </aside>

        {/* CENTER */}
        <section style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          {/* Engine strip */}
          <div
            className="flex items-center justify-between"
            style={{
              padding: "var(--space-3) var(--space-4)",
              borderRadius: "var(--radius-md)",
              background: "var(--surface-secondary)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
              <EnginePulse />
              <div>
                <div className="inline-flex items-center" style={{ gap: 6, fontSize: "var(--font-size-caption)", color: "var(--text-primary)" }}>
                  <span className="font-semibold">{m.xai_engine()}</span>
                  <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--color-info)" }} />
                </div>
                <div className="inline-flex items-center" style={{ gap: 6, marginBlockStart: 2, fontSize: "var(--font-size-micro)", color: "var(--text-muted)" }}>
                  <motion.span
                    style={{ width: 6, height: 6, borderRadius: 999, background: "var(--color-success)" }}
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                  />
                  {m.xai_engine_status()}
                </div>
              </div>
            </div>

            <div className="hidden items-center md:flex" style={{ gap: "var(--space-4)" }}>
              <EngineIndicator icon={<Orbit className="h-3.5 w-3.5" />} label={m.xai_reasoning()} dotColor="var(--color-magenta-500)" />
              <EngineIndicator icon={<CircleDot className="h-3.5 w-3.5" />} label={m.xai_memory()} dotColor="var(--color-orange-500)" />
              <EngineIndicator icon={<Activity className="h-3.5 w-3.5" />} label={m.xai_world_state()} dotColor="var(--color-info)" />
            </div>
          </div>

          {/* Main canvas */}
          <div
            className="relative overflow-hidden"
            style={{
              width: "100%", aspectRatio: "16 / 9",
              borderRadius: "var(--radius-lg)",
              background: SCENE_GRADIENT,
              border: "1px solid var(--border-default)",
              boxShadow: "var(--elevation-floating)",
            }}
          >
            {/* Cinematic overlays */}
            <div className="absolute inset-0" style={{ background: "radial-gradient(70% 60% at 30% 30%, rgba(255,255,255,0.12), transparent 60%)" }} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.55) 100%)" }} />

            {/* Floating toolbar */}
            <div
              className="absolute flex items-center"
              style={{
                insetBlockEnd: "var(--space-4)", insetInlineStart: "50%",
                transform: "translateX(-50%)",
                gap: "var(--space-1)",
                padding: "var(--space-1)",
                borderRadius: 999,
                background: "var(--surface-overlay)",
                border: "1px solid var(--border-subtle)",
                backdropFilter: "blur(12px)",
              }}
            >
              <ToolBtn icon={<RotateCcw className="h-3.5 w-3.5" />} label={m.xai_tool_rerun()} />
              <ToolBtn icon={<Shuffle className="h-3.5 w-3.5" />} label={m.xai_tool_vary()} />
              <ToolBtn icon={<Maximize2 className="h-3.5 w-3.5" />} label={m.xai_tool_upscale()} />
              <ToolBtn icon={<MoveRight className="h-3.5 w-3.5" />} label={m.xai_tool_extend()} />
              <ToolBtn icon={<Pencil className="h-3.5 w-3.5" />} label={m.xai_tool_edit()} />
            </div>
          </div>

          {/* Filmstrip */}
          <div className="grid" style={{ gridTemplateColumns: "repeat(5, 1fr)", gap: "var(--space-2)" }}>
            {VARIANT_GRADIENTS.map((g, i) => (
              <div
                key={i}
                className="overflow-hidden"
                style={{
                  aspectRatio: "16 / 10",
                  borderRadius: "var(--radius-sm)",
                  background: g,
                  border: i === 0 ? "2px solid var(--action-primary)" : "1px solid var(--border-subtle)",
                }}
              />
            ))}
          </div>

          {/* Tabs + workspace panel */}
          <div
            style={{
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
              background: "var(--surface-secondary)",
              overflow: "hidden",
            }}
          >
            <div
              className="flex items-center"
              style={{
                gap: "var(--space-1)",
                paddingInline: "var(--space-3)",
                borderBlockEnd: "1px solid var(--border-subtle)",
              }}
            >
              {([
                { id: "code", label: m.xai_tab_code(), icon: <Code2 className="h-3.5 w-3.5" /> },
                { id: "preview", label: m.xai_tab_preview(), icon: <Eye className="h-3.5 w-3.5" /> },
                { id: "console", label: m.xai_tab_console(), icon: <Terminal className="h-3.5 w-3.5" /> },
                { id: "files", label: m.xai_tab_files(), icon: <FileText className="h-3.5 w-3.5" /> },
              ] as const).map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className="inline-flex items-center"
                    style={{
                      gap: 6,
                      paddingInline: "var(--space-3)", paddingBlock: "var(--space-2)",
                      fontSize: "var(--font-size-caption)",
                      color: active ? "var(--text-primary)" : "var(--text-muted)",
                      borderBlockEnd: `2px solid ${active ? "var(--action-primary)" : "transparent"}`,
                    }}
                  >
                    {t.icon} {t.label}
                  </button>
                );
              })}
            </div>

            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", minHeight: 260 }}>
              {/* Code editor mock */}
              <div
                style={{
                  padding: "var(--space-4)",
                  fontFamily: "ui-monospace, 'JetBrains Mono', 'Menlo', monospace",
                  fontSize: 12, lineHeight: 1.7,
                  background: "var(--surface-primary)",
                  borderInlineEnd: "1px solid var(--border-subtle)",
                }}
              >
                {CODE_LINES.map((line, i) => (
                  <div key={i} className="flex">
                    <span style={{ width: 24, color: "var(--text-disabled)", textAlign: "end", paddingInlineEnd: 8, userSelect: "none" }}>{i + 1}</span>
                    <span style={{ color: "var(--text-primary)" }} dangerouslySetInnerHTML={{ __html: line }} />
                  </div>
                ))}
              </div>

              {/* Preview mock */}
              <div
                className="relative overflow-hidden"
                style={{ background: SCENE_GRADIENT, minHeight: 260 }}
              >
                <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.6) 100%)" }} />
                <div
                  className="relative flex h-full flex-col items-center justify-center"
                  style={{ padding: "var(--space-6)", gap: "var(--space-3)", textAlign: "center" }}
                >
                  <h3 className="font-display font-bold" style={{ fontSize: "var(--font-size-h1)", color: "#fff", lineHeight: 1.05 }}>
                    {m.xai_preview_headline()}
                  </h3>
                  <button
                    className="inline-flex items-center font-semibold text-white"
                    style={{
                      gap: "var(--space-2)",
                      paddingInline: "var(--space-5)", paddingBlock: "var(--space-2)",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--action-primary)",
                      fontSize: "var(--font-size-body)",
                    }}
                  >
                    {m.xai_preview_cta()} <MoveRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT RAIL — CREATIVE THREAD */}
        <aside style={rightRailStyle}>
          <div className="flex items-center justify-between">
            <span style={labelStyle}>{m.xai_thread_title()}</span>
            <Filter className="h-3 w-3" style={{ color: "var(--text-muted)" }} />
          </div>

          <div className="flex flex-wrap" style={{ gap: 4 }}>
            {[
              { id: "all", label: m.xai_filter_all() },
              { id: "visual", label: m.xai_filter_visual() },
              { id: "code", label: m.xai_filter_code() },
              { id: "narrative", label: m.xai_filter_narrative() },
              { id: "motion", label: m.xai_filter_motion() },
            ].map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id as typeof filter)}
                  style={{
                    paddingInline: "var(--space-2)", paddingBlock: 3,
                    borderRadius: "var(--radius-xs)",
                    fontSize: "var(--font-size-micro)",
                    background: active ? "var(--surface-elevated)" : "transparent",
                    color: active ? "var(--text-primary)" : "var(--text-muted)",
                    border: `1px solid ${active ? "var(--border-strong)" : "var(--border-subtle)"}`,
                  }}
                >{f.label}</button>
              );
            })}
          </div>

          {/* Timeline */}
          <div className="relative" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", marginBlockStart: "var(--space-2)" }}>
            <div
              aria-hidden
              className="absolute"
              style={{
                insetInlineStart: 5, insetBlockStart: 4, insetBlockEnd: 4,
                width: 1, background: "var(--border-default)",
              }}
            />
            {visibleThread.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                className="relative"
                style={{ paddingInlineStart: "var(--space-5)" }}
              >
                <span
                  className="absolute rounded-full"
                  style={{
                    insetInlineStart: 0, insetBlockStart: 4,
                    width: 11, height: 11,
                    background: item.color,
                    boxShadow: `0 0 0 3px var(--surface-primary)`,
                  }}
                />
                <div className="flex items-start justify-between" style={{ gap: "var(--space-2)" }}>
                  <span style={{ fontSize: "var(--font-size-caption)", color: "var(--text-primary)", fontWeight: 600 }}>
                    {item.title}
                  </span>
                  <span style={{ fontSize: "var(--font-size-micro)", color: "var(--text-muted)" }}>{item.time}</span>
                </div>
                <p style={{ fontSize: "var(--font-size-micro)", color: "var(--text-tertiary)", marginBlockStart: 4, lineHeight: 1.5 }}>
                  {item.desc}
                </p>
                {item.tag && (
                  <span
                    className="inline-block"
                    style={{
                      marginBlockStart: "var(--space-2)",
                      paddingInline: "var(--space-2)", paddingBlock: 2,
                      borderRadius: "var(--radius-xs)",
                      fontSize: "var(--font-size-micro)",
                      background: "var(--surface-glass)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-default)",
                    }}
                  >{item.tag}</span>
                )}
                {item.thumb && (
                  <div
                    style={{
                      marginBlockStart: "var(--space-2)",
                      height: 72,
                      borderRadius: "var(--radius-sm)",
                      background: item.thumb,
                      border: "1px solid var(--border-subtle)",
                    }}
                  />
                )}
              </motion.div>
            ))}
          </div>

          <button
            className="text-start"
            style={{
              marginBlockStart: "var(--space-3)",
              fontSize: "var(--font-size-caption)",
              color: "var(--action-primary)",
            }}
          >{m.xai_view_all()}</button>
        </aside>
      </div>

      {/* Footer bar */}
      <div
        className="flex items-center justify-between"
        style={{
          borderBlockStart: "1px solid var(--border-subtle)",
          paddingInline: "var(--space-6)", paddingBlock: "var(--space-2)",
          fontSize: "var(--font-size-micro)",
          color: "var(--text-muted)",
          background: "var(--surface-primary)",
        }}
      >
        <div className="flex items-center" style={{ gap: "var(--space-5)" }}>
          <StatusDot label={m.xai_status_creative()} />
          <StatusDot label={m.xai_status_autosave()} />
          <StatusDot label={m.xai_status_sync()} />
        </div>
        <div className="flex items-center" style={{ gap: "var(--space-5)" }}>
          <span>{m.xai_footer_feedback()}</span>
          <span>{m.xai_footer_shortcuts()}</span>
          <span>{m.xai_footer_version()}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- shared styles ---------- */
const leftRailStyle: React.CSSProperties = {
  background: "var(--surface-primary)",
  borderInlineEnd: "1px solid var(--border-subtle)",
  padding: "var(--space-5)",
  display: "flex", flexDirection: "column", gap: "var(--space-4)",
};
const rightRailStyle: React.CSSProperties = {
  background: "var(--surface-primary)",
  borderInlineStart: "1px solid var(--border-subtle)",
  padding: "var(--space-5)",
  display: "flex", flexDirection: "column", gap: "var(--space-3)",
};
const labelStyle: React.CSSProperties = {
  fontSize: "var(--font-size-micro)", color: "var(--text-muted)",
  letterSpacing: "0.12em", textTransform: "uppercase",
};
const microLabel: React.CSSProperties = {
  fontSize: "var(--font-size-micro)", color: "var(--text-muted)",
};

/* ---------- subcomponents ---------- */
function IconBtn({ children }: { children: React.ReactNode }) {
  return (
    <button
      className="grid place-items-center"
      style={{
        width: 32, height: 32, borderRadius: "var(--radius-sm)",
        background: "var(--surface-glass)", border: "1px solid var(--border-default)",
        color: "var(--text-secondary)",
      }}
    >{children}</button>
  );
}

function DropdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={microLabel}>{label}</div>
      <button
        className="flex w-full items-center justify-between"
        style={{
          marginBlockStart: 6,
          paddingInline: "var(--space-3)", paddingBlock: "var(--space-2)",
          borderRadius: "var(--radius-sm)",
          background: "var(--surface-glass)",
          border: "1px solid var(--border-default)",
          fontSize: "var(--font-size-caption)",
          color: "var(--text-primary)",
        }}
      >
        {value}
        <ChevronDown className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
      </button>
    </div>
  );
}

function ToolBtn({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      className="inline-flex items-center"
      style={{
        gap: 6,
        paddingInline: "var(--space-3)", paddingBlock: "var(--space-2)",
        borderRadius: 999,
        fontSize: "var(--font-size-micro)",
        color: "var(--text-primary)",
        background: "transparent",
      }}
    >
      {icon} {label}
    </button>
  );
}

function EngineIndicator({ icon, label, dotColor }: { icon: React.ReactNode; label: string; dotColor: string }) {
  return (
    <div className="inline-flex items-center" style={{ gap: 6, fontSize: "var(--font-size-micro)", color: "var(--text-secondary)" }}>
      <span style={{ color: "var(--text-muted)" }}>{icon}</span>
      {label}
      <span style={{ width: 5, height: 5, borderRadius: 999, background: dotColor }} />
    </div>
  );
}

function EnginePulse() {
  return (
    <div className="relative" style={{ width: 36, height: 36 }}>
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background: "conic-gradient(from 0deg, #ff6b1a, #ff2e8a, #4da3ff, #ff6b1a)",
          filter: "blur(0.5px)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
      />
      <div
        className="absolute rounded-full"
        style={{
          inset: 4, background: "var(--surface-secondary)",
          border: "1px solid var(--border-default)",
        }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{ inset: 12, background: "var(--action-primary)", boxShadow: "0 0 12px var(--action-primary)" }}
        animate={{ scale: [0.85, 1.05, 0.85], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

function StatusDot({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center" style={{ gap: 6 }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--color-success)" }} />
      {label}
    </span>
  );
}

/* ---------- code editor mock lines (pre-tinted) ---------- */
const K = "color:var(--color-orange-500)"; // keyword
const S = "color:var(--color-gold-500)";   // string
const C = "color:var(--text-disabled)";    // comment
const P = "color:var(--text-primary)";
const CODE_LINES = [
  `<span style="${C}">// cinematic scene — generated</span>`,
  `<span style="${K}">import</span> <span style="${P}">{ motion }</span> <span style="${K}">from</span> <span style="${S}">"framer-motion"</span>;`,
  ``,
  `<span style="${K}">export function</span> <span style="${P}">Scene</span>() {`,
  `  <span style="${K}">return</span> (`,
  `    <span style="${P}">&lt;motion.section</span>`,
  `      <span style="${P}">initial=</span><span style="${S}">{{ opacity: 0 }}</span>`,
  `      <span style="${P}">animate=</span><span style="${S}">{{ opacity: 1 }}</span>`,
  `      <span style="${P}">className=</span><span style="${S}">"cyber-city"</span>`,
  `    <span style="${P}">/&gt;</span>`,
  `  );`,
  `}`,
];
