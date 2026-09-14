import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, FolderOpen, History, Send } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Header } from "@/components/xeomx/Header";
import { m } from "@/paraglide/messages.js";

const continuations = ["Product launch plan", "Website copy refresh", "Market research brief"];
const projects = ["Brand refresh", "Q2 campaign", "Customer research"];
const MarketplaceHomeCta = lazy(() =>
  import("@/components/xeomx/os/MarketplaceHomeCta").then((module) => ({
    default: module.MarketplaceHomeCta,
  })),
);

export function HomeExperience() {
  const navigate = useNavigate();
  const [goal, setGoal] = useState("");
  const marketRef = useRef<HTMLDivElement>(null);
  const [marketVisible, setMarketVisible] = useState(false);
  useEffect(() => {
    const node = marketRef.current;
    if (!node || !("IntersectionObserver" in window)) {
      setMarketVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setMarketVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const submit = () => {
    const value = goal.trim();
    if (value.length >= 2) navigate({ to: "/xeomx-ai", search: { goal: value } });
  };
  return (
    <div className="min-h-screen bg-background text-foreground" dir="auto">
      <Header />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-16">
        <section aria-labelledby="goal-title" className="mx-auto max-w-4xl text-center">
          <h1
            id="goal-title"
            className="text-balance text-3xl font-semibold tracking-tight sm:text-5xl"
          >
            {m.p8_goal_title()}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">{m.p8_goal_subtitle()}</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
            className="mt-8 rounded-2xl border bg-background p-2 text-start shadow-sm focus-within:ring-2 focus-within:ring-primary/25"
          >
            <label htmlFor="universal-goal" className="sr-only">
              {m.p8_goal_title()}
            </label>
            <div className="flex items-end gap-2">
              <textarea
                id="universal-goal"
                rows={2}
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                placeholder={m.p8_goal_placeholder()}
                className="min-h-20 min-w-0 flex-1 resize-none bg-transparent p-3 text-base outline-none sm:text-lg"
              />
              <button
                type="submit"
                aria-label={m.p8_start()}
                disabled={goal.trim().length < 2}
                className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-primary text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
              >
                <Send className="size-5 rtl:rotate-180" />
              </button>
            </div>
            <div className="border-t px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">{m.p8_using()}</span>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button type="button" className="min-h-11 rounded-lg border px-3">
                  {m.p8_project()}: {m.p8_general()}
                </button>
                <button type="button" className="min-h-11 rounded-lg border px-3">
                  {m.p8_character()}: {m.p8_default()}
                </button>
                <button type="button" className="min-h-11 rounded-lg border px-3">
                  {m.p8_format()}: {m.p8_auto()}
                </button>
                <button
                  type="button"
                  className="min-h-11 px-2 text-primary underline-offset-4 hover:underline"
                >
                  {m.p8_edit()}
                </button>
              </div>
            </div>
            <details className="border-t px-3 py-3">
              <summary className="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {m.p8_more_control()}
              </summary>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                <label>
                  {m.p8_quality()}
                  <select className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3">
                    <option>{m.p8_balanced()}</option>
                  </select>
                </label>
                <label>
                  {m.p8_budget()}
                  <input
                    className="mt-1 min-h-11 w-full rounded-lg border px-3"
                    inputMode="numeric"
                    placeholder={m.p8_automatic()}
                  />
                </label>
                <label>
                  {m.p8_output()}
                  <select className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3">
                    <option>{m.p8_auto()}</option>
                  </select>
                </label>
              </div>
              <div className="mt-3 rounded-lg bg-muted/45 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">{m.p9_routing_details()}</p>
                <p className="mt-1">{m.p9_auto_routing_summary()}</p>
                <p className="mt-1">{m.p9_context_provenance()}</p>
                <p className="mt-1">{m.p9_approval_boundary()}</p>
              </div>
            </details>
          </form>
        </section>
        <section aria-labelledby="continue-title" className="mt-12">
          <div className="flex items-center justify-between">
            <h2 id="continue-title" className="text-xl font-semibold">
              {m.p8_continue()}
            </h2>
            <Link to="/dashboard" className="min-h-11 py-3 text-sm text-primary">
              {m.p8_view_all()}
            </Link>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {continuations.map((item) => (
              <Link
                key={item}
                to="/xeomx-ai"
                className="flex min-h-20 items-center gap-3 rounded-xl border p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <History className="size-5 text-primary" />
                <span className="min-w-0 flex-1 truncate font-medium">{item}</span>
                <ArrowRight className="size-4 rtl:rotate-180" />
              </Link>
            ))}
          </div>
        </section>
        <section aria-labelledby="projects-title" className="mt-10">
          <div className="flex items-center justify-between">
            <h2 id="projects-title" className="text-xl font-semibold">
              {m.p8_recent_projects()}
            </h2>
            <Link to="/dashboard" className="min-h-11 py-3 text-sm text-primary">
              {m.p8_view_all()}
            </Link>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {projects.map((item) => (
              <Link
                key={item}
                to="/workspace"
                className="flex min-h-20 items-center gap-3 rounded-xl border p-4"
              >
                <FolderOpen className="size-5 text-primary" />
                <span className="font-medium">{item}</span>
              </Link>
            ))}
            <button
              type="button"
              onClick={() => document.getElementById("universal-goal")?.focus()}
              className="min-h-20 rounded-xl border border-dashed p-4 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {m.p8_new_project()}
            </button>
          </div>
        </section>
        <div ref={marketRef}>
          {marketVisible ? (
            <Suspense
              fallback={
                <div role="status" className="mt-10 min-h-24 rounded-2xl border p-5">
                  {m.common_loading()}
                </div>
              }
            >
              <MarketplaceHomeCta />
            </Suspense>
          ) : null}
        </div>
      </main>
    </div>
  );
}
