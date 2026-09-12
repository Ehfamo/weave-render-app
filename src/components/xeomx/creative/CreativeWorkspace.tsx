import { useMemo, useState } from "react";
import { Image, Film, Music, Mic2, Play, Sparkles, SlidersHorizontal } from "lucide-react";
import { m } from "@/paraglide/messages.js";
const assets = [
  { id: "a1", name: "Product hero", type: "image" },
  { id: "a2", name: "Character reference", type: "image" },
  { id: "a3", name: "Voice guide", type: "voice" },
];
const shots = [
  { id: "s1", name: "Opening", duration: 4 },
  { id: "s2", name: "Product", duration: 7 },
  { id: "s3", name: "Closing", duration: 4 },
];
export function CreativeWorkspace() {
  const [selected, setSelected] = useState("a1"),
    [prompt, setPrompt] = useState(() => m.creative_prompt_default()),
    [advanced, setAdvanced] = useState(false),
    [playing, setPlaying] = useState(false);
  const duration = useMemo(() => shots.reduce((n, s) => n + s.duration, 0), []);
  return (
    <main className="min-h-screen bg-background text-foreground" dir="auto">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <div>
          <h1 className="text-sm font-semibold">{m.creative_title()}</h1>
          <p className="text-xs text-muted-foreground">
            {m.creative_project()} · {duration}s
          </p>
        </div>
        <button className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          <Sparkles className="size-4" />
          {m.creative_generate()}
        </button>
      </header>
      <div className="grid min-h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-[15rem_1fr_18rem] lg:grid-rows-[1fr_11rem]">
        <aside className="border-b p-3 lg:row-span-2 lg:border-b-0 lg:border-e">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {m.creative_assets()}
            </h2>
            <button className="text-xs text-primary">{m.creative_add()}</button>
          </div>
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
            {assets.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelected(a.id)}
                className={`flex min-w-0 items-center gap-2 rounded-md border p-2 text-start text-xs ${selected === a.id ? "border-primary bg-primary/5" : "border-border"}`}
              >
                {a.type === "voice" ? <Mic2 className="size-4" /> : <Image className="size-4" />}
                <span className="truncate">{a.name}</span>
              </button>
            ))}
          </div>
        </aside>
        <section className="flex min-h-80 items-center justify-center bg-muted/20 p-5">
          <div className="flex aspect-video w-full max-w-3xl items-center justify-center rounded-lg border bg-background shadow-sm">
            <button
              onClick={() => setPlaying((x) => !x)}
              aria-label={playing ? m.creative_pause() : m.creative_play()}
              className="grid size-14 place-items-center rounded-full bg-primary text-primary-foreground"
            >
              <Play className="size-5" />
            </button>
          </div>
        </section>
        <aside className="border-t p-4 lg:row-span-2 lg:border-s lg:border-t-0">
          <h2 className="mb-3 text-sm font-semibold">{m.creative_create()}</h2>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-28 w-full resize-none rounded-md border bg-background p-3 text-sm"
          />
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              [Image, m.creative_image()],
              [Film, m.creative_video()],
              [Music, m.creative_audio()],
            ].map(([Icon, label]) => (
              <button
                key={label as string}
                className="flex flex-col items-center gap-1 rounded-md border p-2 text-xs"
              >
                <Icon className="size-4" />
                {label as string}
              </button>
            ))}
          </div>
          <button
            onClick={() => setAdvanced((x) => !x)}
            className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"
          >
            <SlidersHorizontal className="size-4" />
            {m.creative_advanced()}
          </button>
          {advanced ? (
            <div className="mt-3 rounded-md border p-3 text-xs">
              <label className="block">
                {m.creative_quality()}
                <select className="mt-1 h-8 w-full rounded border bg-background px-2">
                  <option>Balanced</option>
                  <option>Fast</option>
                  <option>Best</option>
                </select>
              </label>
            </div>
          ) : null}
        </aside>
        <section className="overflow-x-auto border-t p-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold">{m.creative_timeline()}</span>
            <span className="text-muted-foreground">00:{duration}</span>
          </div>
          <div className="flex min-w-[34rem] gap-2">
            {shots.map((s, i) => (
              <button
                key={s.id}
                className="h-20 rounded-md border bg-muted/30 p-3 text-start"
                style={{ width: `${Math.max(8, s.duration * 2.2)}rem` }}
              >
                <span className="block text-xs font-medium">
                  {i + 1}. {s.name}
                </span>
                <span className="text-[11px] text-muted-foreground">{s.duration}s</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
