import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, FolderOpen, History, Send } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Header } from "@/components/xeomx/Header";
import { createPendingGoal, savePendingGoal } from "@/lib/core-execution/handoff";
import { useProjectsHome } from "@/hooks/use-projects";
import type { RoutingMode } from "@/lib/model-gateway/contracts";
import { m } from "@/paraglide/messages.js";

const MarketplaceHomeCta = lazy(() =>
  import("@/components/xeomx/os/MarketplaceHomeCta").then((module) => ({
    default: module.MarketplaceHomeCta,
  })),
);

export function HomeExperience() {
  const navigate = useNavigate();
  const recent = useProjectsHome();
  const [durable, setDurable] = useState(false);
  const [goal, setGoal] = useState("");
  const [quality, setQuality] = useState<RoutingMode>("BALANCED");
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
    if (value.length >= 2) {
      savePendingGoal(window.localStorage, { ...createPendingGoal(value, quality), ...(durable ? { createProject: true } : {}), ...(recent.user ? { ownerId: recent.user.id } : {}) });
      if (durable) navigate({ to: "/projects" });
      else navigate({ to: "/xeomx-ai" });
    }
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
              <div
                className="mt-2 flex flex-wrap gap-2 text-xs"
                aria-label={m.fi1_context_unavailable()}
              >
                <span
                  aria-disabled="true"
                  className="inline-flex min-h-11 items-center rounded-lg border px-3 text-muted-foreground"
                >
                  {m.p8_project()}: {m.p8_general()}
                </span>
                <span
                  aria-disabled="true"
                  className="inline-flex min-h-11 items-center rounded-lg border px-3 text-muted-foreground"
                >
                  {m.p8_character()}: {m.p8_default()}
                </span>
                <span
                  aria-disabled="true"
                  className="inline-flex min-h-11 items-center rounded-lg border px-3 text-muted-foreground"
                >
                  {m.p8_format()}: {m.p8_auto()}
                </span>
                <span className="inline-flex min-h-11 items-center px-2 text-muted-foreground">
                  {m.p8_edit()}: {m.fi1_available_later()}
                </span>
              </div>
            </div>
            <label className="flex min-h-11 items-center gap-2 px-3"><input type="checkbox" checked={durable} onChange={(e)=>setDurable(e.target.checked)}/>{m.fi2_durable_goal()}</label>
            <details className="border-t px-3 py-3">
              <summary className="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {m.p8_more_control()}
              </summary>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-1">
                <label>
                  {m.p8_quality()}
                  <select
                    value={quality}
                    onChange={(event) => setQuality(event.target.value as RoutingMode)}
                    className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3"
                  >
                    <option value="FAST">{m.fi1_quality_fast()}</option>
                    <option value="BALANCED">{m.p8_balanced()}</option>
                    <option value="BEST">{m.fi1_quality_best()}</option>
                  </select>
                </label>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {m.p8_budget()} / {m.p8_output()}: {m.fi1_automatic_enforced()}
              </p>
              <div className="mt-3 rounded-lg bg-muted/45 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">{m.p9_routing_details()}</p>
                <p className="mt-1">{m.p9_auto_routing_summary()}</p>
                <p className="mt-1">{m.p9_context_provenance()}</p>
                <p className="mt-1">{m.p9_approval_boundary()}</p>
              </div>
            </details>
          </form>
        </section>
        {recent.loading ? <p role="status" className="mt-10">{m.common_loading()}</p> : null}
        {recent.isError ? <p role="alert" className="mt-10">{m.fi2_error()} <button onClick={()=>void recent.refetch()} className="min-h-11 underline">{m.common_retry()}</button></p> : null}
        <section aria-labelledby="continue-title" className="mt-12">
          <h2 id="continue-title" className="text-xl font-semibold">{m.p8_continue()}</h2>
          {!recent.loading && !recent.data?.continuations.length ? <p className="mt-3 text-muted-foreground">{m.fi2_empty_activity()}</p> : null}
          <div className="mt-3 grid gap-3 md:grid-cols-3">{recent.data?.continuations.map(item=><Link key={item.id} to="/projects/$projectId" params={{projectId:item.projectId}} search={{conversationId:item.id}}
            className="flex min-h-20 items-center gap-3 rounded-xl border p-4 focus-visible:ring-2 focus-visible:ring-ring">
            <History className="size-5 text-primary"/><span className="min-w-0 flex-1"><span className="block truncate font-medium">{item.projectName}</span><span className="block truncate text-sm">{item.title}</span></span><ArrowRight className="size-4 rtl:rotate-180"/>
          </Link>)}</div>
        </section>
        <section aria-labelledby="projects-title" className="mt-10">
          <div className="flex items-center justify-between"><h2 id="projects-title" className="text-xl font-semibold">{m.p8_recent_projects()}</h2><Link to="/projects" className="min-h-11 py-3 text-primary">{m.p8_view_all()}</Link></div>
          {!recent.loading && !recent.data?.projects.length ? <p className="mt-3 text-muted-foreground">{m.fi2_empty_projects()}</p>:null}
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{recent.data?.projects.slice(0,3).map(item=><Link key={item.id} to="/projects/$projectId" params={{projectId:item.id}} className="flex min-h-20 items-center gap-3 rounded-xl border p-4 focus-visible:ring-2"><FolderOpen className="size-5 text-primary"/><span className="font-medium">{item.name}</span></Link>)}
            <Link to="/projects" className="flex min-h-20 items-center justify-center rounded-xl border border-dashed p-4 text-primary focus-visible:ring-2">{m.p8_new_project()}</Link>
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
