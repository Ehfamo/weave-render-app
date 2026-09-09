import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Bot,
  Braces,
  ChevronRight,
  CircleDot,
  Code2,
  FileSearch,
  FolderKanban,
  GitBranch,
  Grip,
  Library,
  LockKeyhole,
  MessageSquare,
  PanelRight,
  PauseCircle,
  Play,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Store,
  TestTube2,
  type LucideIcon,
} from "lucide-react";
import { FeatureStatusBadge } from "@/components/xeomx/status/FeatureStatusBadge";
import { SystemState } from "@/components/xeomx/os/SystemState";
import { JobStatusPanel } from "@/components/xeomx/product/JobStatusPanel";
import { ModelIntelligenceWorkspace } from "@/components/xeomx/product/ModelIntelligenceWorkspace";
import { PaymentSafetyPanel } from "@/components/xeomx/product/PaymentSafetyPanel";
import { PersonalOSOverview } from "@/components/xeomx/product/PersonalOSOverview";
import { PermissionPreviewPanel } from "@/components/xeomx/product/PermissionPreviewPanel";
import { SecurityIncidentPanel } from "@/components/xeomx/product/SecurityIncidentPanel";
import type { ProductComplexityMode } from "@/hooks/use-product-complexity-mode";
import type {
  ProductEnvironment,
  ProductFeature,
  ProductSubpage,
} from "@/lib/product-architecture";
import { m } from "@/paraglide/messages.js";

export function ProductWorkspacePreview({
  environment,
  subpage,
  mode,
}: {
  environment: ProductEnvironment;
  subpage: ProductSubpage;
  mode: ProductComplexityMode;
}) {
  if (environment.id === "settings" && subpage.key === "profile") {
    return <PersonalOSOverview mode={mode} />;
  }

  if (environment.id === "models" || environment.id === "model-intelligence") {
    return <ModelIntelligenceWorkspace environment={environment} subpage={subpage} mode={mode} />;
  }

  switch (environment.layout) {
    case "conversation":
      return <ConversationWorkspace subpage={subpage} />;
    case "catalog":
      return <CatalogWorkspace subpage={subpage} />;
    case "evidence":
      return <EvidenceWorkspace subpage={subpage} />;
    case "commerce":
    case "billing":
      return <CommerceWorkspace subpage={subpage} />;
    case "studio":
      return <StudioWorkspace subpage={subpage} />;
    case "code":
    case "developer":
      return <CodeWorkspace subpage={subpage} />;
    case "builder":
      return <BuilderWorkspace subpage={subpage} />;
    case "agent":
      return <AgentWorkspace subpage={subpage} />;
    case "workflow":
      return <WorkflowWorkspace subpage={subpage} />;
    case "knowledge":
      return <KnowledgeWorkspace subpage={subpage} />;
    case "project":
      return <ProjectWorkspace subpage={subpage} />;
    case "collaboration":
      return <CollaborationWorkspace subpage={subpage} />;
    case "creator":
      return <CreatorWorkspace subpage={subpage} />;
    case "community":
    case "editorial":
    case "academy":
    case "support":
      return <EditorialWorkspace subpage={subpage} layout={environment.layout} />;
    case "research":
      return <ResearchWorkspace subpage={subpage} />;
    case "governance":
    case "settings":
      return <GovernanceWorkspace subpage={subpage} />;
    case "security":
      return <SecurityWorkspace subpage={subpage} />;
  }
}

function WorkspaceFrame({
  icon: Icon,
  label,
  subpage,
  children,
  toolbar,
}: {
  icon: LucideIcon;
  label: string;
  subpage: ProductSubpage;
  children: ReactNode;
  toolbar?: ReactNode;
}) {
  return (
    <section
      className="overflow-hidden rounded-2xl border border-border bg-background"
      aria-labelledby="workspace-preview-title"
    >
      <header className="flex min-h-14 flex-wrap items-center gap-3 border-b border-border px-4 sm:px-5">
        <Icon className="size-4 text-[var(--environment-accent)]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <h2
            id="workspace-preview-title"
            className="truncate font-sans text-sm font-semibold tracking-normal"
          >
            {subpage.label}
          </h2>
        </div>
        <FeatureStatusBadge status={subpage.state} size="xs" />
        {toolbar}
      </header>
      {children}
    </section>
  );
}

function ConversationWorkspace({ subpage }: { subpage: ProductSubpage }) {
  const [draft, setDraft] = useState("");
  return (
    <WorkspaceFrame icon={MessageSquare} label="Conversation environment" subpage={subpage}>
      <div className="grid min-h-[34rem] lg:grid-cols-[1fr_15rem]">
        <div className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-e">
          <div className="flex flex-1 items-center justify-center p-5 sm:p-8">
            <SystemState
              variant="provider-unavailable"
              title={m.product_no_verified_data()}
              description={m.product_honest_boundary_description()}
              className="w-full max-w-xl"
            />
          </div>
          <div className="border-t border-border p-3 sm:p-4">
            <label className="sr-only" htmlFor="ai-preview-input">
              {subpage.label}
            </label>
            <div className="flex items-end gap-2 rounded-xl border border-border bg-surface/35 p-2">
              <textarea
                id="ai-preview-input"
                value={draft}
                onChange={(event) => setDraft(event.target.value.slice(0, 600))}
                placeholder={m.os_command_ask()}
                rows={2}
                className="min-h-12 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0"
              />
              <button
                type="button"
                disabled
                aria-label={m.product_honest_boundary()}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-foreground text-background opacity-45"
              >
                <Play className="size-4 rtl:rotate-180" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
        <FeatureRail features={subpage.features} />
      </div>
    </WorkspaceFrame>
  );
}

function CatalogWorkspace({ subpage }: { subpage: ProductSubpage }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return needle
      ? subpage.features.filter((feature) => feature.label.toLocaleLowerCase().includes(needle))
      : subpage.features;
  }, [query, subpage.features]);

  return (
    <WorkspaceFrame icon={SlidersHorizontal} label="Model decision surface" subpage={subpage}>
      <div className="border-b border-border p-3 sm:p-4">
        <label className="relative block max-w-lg">
          <span className="sr-only">{m.product_directory_search()}</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={m.product_directory_search()}
            className="min-h-11 w-full rounded-lg border border-border bg-surface/30 ps-10 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>
      <div className="divide-y divide-border md:hidden">
        {filtered.map((feature) => (
          <div key={feature.key} className="space-y-3 px-4 py-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{feature.label}</p>
              <FeatureStatusBadge status={feature.state} size="xs" />
            </div>
            <p className="text-xs leading-5 text-muted-foreground">{feature.dependency}</p>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[42rem] border-collapse text-start text-sm">
          <thead className="bg-surface/35 text-xs text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-start font-medium">{m.product_feature()}</th>
              <th className="px-5 py-3 text-start font-medium">{m.product_route_state()}</th>
              <th className="px-5 py-3 text-start font-medium">{m.product_dependency()}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((feature) => (
              <tr key={feature.key} id={feature.key} className="hover:bg-white/[0.02]">
                <td className="px-5 py-4 font-medium">{feature.label}</td>
                <td className="px-5 py-4">
                  <FeatureStatusBadge status={feature.state} size="xs" />
                </td>
                <td className="max-w-md px-5 py-4 text-xs leading-5 text-muted-foreground">
                  {feature.dependency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 ? (
        <p className="border-t border-border px-5 py-10 text-center text-sm text-muted-foreground">
          {m.product_no_results()}
        </p>
      ) : null}
    </WorkspaceFrame>
  );
}

function EvidenceWorkspace({ subpage }: { subpage: ProductSubpage }) {
  return (
    <WorkspaceFrame icon={FileSearch} label="Provenance and evidence" subpage={subpage}>
      <div className="grid min-h-[32rem] lg:grid-cols-[13rem_1fr_16rem]">
        <div className="border-b border-border p-4 lg:border-b-0 lg:border-e">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {m.product_live_dependencies()}
          </p>
          <div className="mt-4 space-y-2">
            {subpage.features.slice(0, 5).map((feature) => (
              <div key={feature.key} className="flex items-center gap-2 py-2 text-xs">
                <CircleDot className="size-3 text-[var(--environment-accent)]" />
                <span className="min-w-0 flex-1 truncate">{feature.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative grid min-h-72 place-items-center overflow-hidden p-6">
          <SystemState
            variant="empty"
            title={m.product_no_verified_data()}
            description={m.product_no_verified_data_desc()}
            className="relative w-full max-w-lg bg-background/90"
          />
        </div>
        <FeatureRail features={subpage.features} />
      </div>
    </WorkspaceFrame>
  );
}

function CommerceWorkspace({ subpage }: { subpage: ProductSubpage }) {
  const lifecycle = ["Discover", "Compare", "Evidence", "Payment confirmation", "Entitlement"];
  return (
    <WorkspaceFrame icon={Store} label="Commerce and entitlement" subpage={subpage}>
      <div className="p-4 sm:p-6">
        <ol className="grid overflow-hidden rounded-xl border border-border sm:grid-cols-5">
          {lifecycle.map((item, index) => (
            <li
              key={item}
              className="flex min-h-24 items-center gap-3 border-b border-border p-4 last:border-b-0 sm:border-b-0 sm:border-e sm:last:border-e-0"
            >
              <span className="text-xs tabular-nums text-[var(--environment-accent)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-xs font-medium">{item}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6">
          <PaymentSafetyPanel />
        </div>
        <div className="mt-6">
          <FeatureRail features={subpage.features} bordered />
        </div>
      </div>
    </WorkspaceFrame>
  );
}

function StudioWorkspace({ subpage }: { subpage: ProductSubpage }) {
  return (
    <WorkspaceFrame icon={Sparkles} label="Resumable generation studio" subpage={subpage}>
      <div className="grid min-h-[36rem] grid-cols-[3.5rem_1fr] lg:grid-cols-[3.5rem_1fr_17rem]">
        <ToolRail icons={[Sparkles, Grip, SlidersHorizontal, PanelRight]} />
        <div className="relative grid min-h-80 place-items-center overflow-hidden bg-surface/15 p-5">
          <SystemState
            variant="provider-unavailable"
            title={m.product_no_verified_data()}
            description={m.product_honest_boundary_description()}
            className="relative max-w-lg bg-background/90"
          />
        </div>
        <div className="col-span-2 border-t border-border lg:col-span-1 lg:border-s lg:border-t-0">
          <FeatureRail features={subpage.features} />
        </div>
      </div>
      <div className="px-4 pb-5 sm:px-6">
        <JobStatusPanel capability="generation-jobs" />
      </div>
    </WorkspaceFrame>
  );
}

function CodeWorkspace({ subpage }: { subpage: ProductSubpage }) {
  return (
    <WorkspaceFrame icon={Code2} label="Build lifecycle workspace" subpage={subpage}>
      <div className="grid min-h-[34rem] lg:grid-cols-[13rem_1fr_16rem]">
        <div className="border-b border-border p-3 lg:border-b-0 lg:border-e">
          <p className="px-2 py-2 text-xs font-semibold text-muted-foreground">{subpage.label}</p>
          {subpage.features.slice(0, 7).map((feature) => (
            <div
              key={feature.key}
              className="flex min-h-10 items-center gap-2 rounded-md px-2 text-xs"
            >
              <Braces className="size-3.5 text-muted-foreground" />
              <span className="truncate">{feature.label}</span>
            </div>
          ))}
        </div>
        <div className="min-w-0 bg-[#0b0d10] p-4 font-mono text-xs leading-7 text-slate-300 sm:p-6">
          <p className="text-slate-500">// {m.product_read_only_preview()}</p>
          <p className="mt-4">
            <span className="text-sky-300">workflow</span> {"{"}
          </p>
          {subpage.features.slice(0, 5).map((feature) => (
            <p key={feature.key} className="ps-4">
              <span className="text-emerald-300">{feature.key || "capability"}</span>: {'"'}
              {feature.state}
              {'",'}
            </p>
          ))}
          <p>{"}"}</p>
        </div>
        <FeatureRail features={subpage.features} />
      </div>
      <div className="px-4 pb-5 sm:px-6">
        <JobStatusPanel
          capability={subpage.adapter === "deployment" ? "deployment" : "generation-jobs"}
        />
      </div>
    </WorkspaceFrame>
  );
}

function BuilderWorkspace({ subpage }: { subpage: ProductSubpage }) {
  return (
    <WorkspaceFrame icon={PanelRight} label="App and site builder" subpage={subpage}>
      <div className="grid min-h-[34rem] lg:grid-cols-[12rem_1fr_16rem]">
        <div className="border-b border-border p-3 lg:border-b-0 lg:border-e">
          <FeatureRail features={subpage.features.slice(0, 5)} />
        </div>
        <div className="relative grid min-h-80 place-items-center overflow-hidden bg-surface/20 p-5">
          <SystemState
            variant="provider-unavailable"
            title={m.product_no_verified_data()}
            description={m.product_honest_boundary_description()}
            className="relative max-w-lg bg-background/90"
          />
        </div>
        <FeatureRail features={subpage.features} />
      </div>
      <div className="px-4 pb-5 sm:px-6">
        <JobStatusPanel capability="generation-jobs" />
      </div>
    </WorkspaceFrame>
  );
}

function AgentWorkspace({ subpage }: { subpage: ProductSubpage }) {
  const stages = [
    "Objective",
    "Tools",
    "Scopes",
    "Credentials",
    "Budget and time limit",
    "Risk preview",
    "Human approval",
    "Run",
    "Monitor",
    "Pause or stop",
    "Retry",
    "Audit trail",
    "Recovery",
  ];
  return (
    <WorkspaceFrame icon={Bot} label="Agent control plane" subpage={subpage}>
      <div className="p-4 sm:p-6">
        <StageFlow labels={stages} approvalIndex={6} />
        <div className="mt-6">
          <PermissionPreviewPanel
            target={subpage.label}
            action={m.platform_agent_run_action()}
            scopes={subpage.features.slice(0, 4).map((feature) => feature.key)}
            consequence={m.platform_agent_consequence()}
            reversible
          />
        </div>
        <div className="mt-6">
          <FeatureRail features={subpage.features} bordered />
        </div>
        <div className="mt-6">
          <JobStatusPanel capability="generation-jobs" />
        </div>
      </div>
    </WorkspaceFrame>
  );
}

function WorkflowWorkspace({ subpage }: { subpage: ProductSubpage }) {
  return (
    <WorkspaceFrame icon={GitBranch} label="Automation graph" subpage={subpage}>
      <div className="grid min-h-[34rem] lg:grid-cols-[1fr_17rem]">
        <div className="relative overflow-hidden p-5 sm:p-8">
          <div className="relative mx-auto flex max-w-3xl flex-col items-stretch gap-5 sm:flex-row sm:items-center">
            {subpage.features.slice(0, 4).map((feature, index) => (
              <div key={feature.key} className="contents">
                <div className="min-h-24 flex-1 rounded-xl border border-border bg-background p-4">
                  <span className="text-xs text-[var(--environment-accent)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-4 text-xs font-medium">{feature.label}</p>
                </div>
                {index < Math.min(subpage.features.length, 4) - 1 ? (
                  <ChevronRight className="mx-auto size-4 rotate-90 text-muted-foreground sm:rotate-0 rtl:sm:rotate-180" />
                ) : null}
              </div>
            ))}
          </div>
          <p className="relative mt-8 text-center text-xs text-muted-foreground">
            {m.product_approval_required()}
          </p>
        </div>
        <FeatureRail features={subpage.features} />
      </div>
      <div className="px-5 pb-6 sm:px-8">
        <PermissionPreviewPanel
          target={subpage.label}
          action={m.platform_workflow_run_action()}
          scopes={subpage.features.slice(0, 4).map((feature) => feature.key)}
          consequence={m.platform_workflow_consequence()}
          reversible
        />
        <div className="mt-6">
          <JobStatusPanel capability="generation-jobs" />
        </div>
      </div>
    </WorkspaceFrame>
  );
}

function KnowledgeWorkspace({ subpage }: { subpage: ProductSubpage }) {
  return (
    <WorkspaceFrame icon={Library} label="Permission-aware knowledge" subpage={subpage}>
      <div className="divide-y divide-border md:hidden">
        {subpage.features.map((feature) => (
          <div key={feature.key} className="space-y-3 px-4 py-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{feature.label}</p>
              <FeatureStatusBadge status={feature.state} size="xs" />
            </div>
            <dl className="grid gap-2 text-xs text-muted-foreground">
              <div className="flex justify-between gap-4">
                <dt>{m.product_permissions()}</dt>
                <dd className="text-end">{m.product_policy_filtered()}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>{m.product_dependency()}</dt>
                <dd className="max-w-[65%] text-end">{feature.dependency}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[42rem] border-collapse text-sm">
          <thead className="bg-surface/30 text-xs text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-start font-medium">{m.product_feature()}</th>
              <th className="px-5 py-3 text-start font-medium">{m.product_index_status()}</th>
              <th className="px-5 py-3 text-start font-medium">{m.product_permissions()}</th>
              <th className="px-5 py-3 text-start font-medium">{m.product_dependency()}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {subpage.features.map((feature) => (
              <tr key={feature.key}>
                <td className="px-5 py-4 font-medium">{feature.label}</td>
                <td className="px-5 py-4">
                  <FeatureStatusBadge status={feature.state} size="xs" />
                </td>
                <td className="px-5 py-4 text-xs text-muted-foreground">
                  {m.product_policy_filtered()}
                </td>
                <td className="max-w-xs px-5 py-4 text-xs text-muted-foreground">
                  {feature.dependency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WorkspaceFrame>
  );
}

function ProjectWorkspace({ subpage }: { subpage: ProductSubpage }) {
  return (
    <WorkspaceFrame icon={FolderKanban} label="Persistent project context" subpage={subpage}>
      <div className="grid min-h-[32rem] lg:grid-cols-[1fr_18rem]">
        <div className="p-5 sm:p-7">
          <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
            {subpage.features.slice(0, 6).map((feature) => (
              <div key={feature.key} className="min-h-28 bg-background p-4">
                <FeatureStatusBadge status={feature.state} size="xs" />
                <p className="mt-5 text-sm font-medium">{feature.label}</p>
                <p className="mt-2 text-xs text-muted-foreground">{feature.dependency}</p>
              </div>
            ))}
          </div>
        </div>
        <FeatureRail features={subpage.features} />
      </div>
    </WorkspaceFrame>
  );
}

function CollaborationWorkspace({ subpage }: { subpage: ProductSubpage }) {
  return (
    <WorkspaceFrame icon={MessageSquare} label="Shared work and review" subpage={subpage}>
      <div className="grid min-h-[31rem] lg:grid-cols-[1fr_19rem]">
        <div className="p-5 sm:p-7">
          <div className="border-y border-border">
            {subpage.features.map((feature, index) => (
              <div
                key={feature.key}
                className="flex min-h-20 items-center gap-4 border-b border-border py-4 last:border-b-0"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full border border-border text-xs">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{feature.label}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {feature.dependency}
                  </p>
                </div>
                <FeatureStatusBadge status={feature.state} size="xs" />
              </div>
            ))}
          </div>
        </div>
        <SystemState
          variant="permission-denied"
          title={m.product_approval_required()}
          description={m.product_requires_auth()}
          compact
          className="m-5 self-start lg:m-6"
        />
      </div>
    </WorkspaceFrame>
  );
}

function CreatorWorkspace({ subpage }: { subpage: ProductSubpage }) {
  return (
    <WorkspaceFrame icon={Store} label="Creator rights and listings" subpage={subpage}>
      <div className="p-5 sm:p-7">
        <StageFlow
          labels={["Create", "Rights", "Preview", "Review", "Publish", "Purchase", "Entitlement"]}
          approvalIndex={3}
        />
        <div className="mt-7 border-y border-border">
          <FeatureRows features={subpage.features} />
        </div>
      </div>
    </WorkspaceFrame>
  );
}

function EditorialWorkspace({
  subpage,
  layout,
}: {
  subpage: ProductSubpage;
  layout: "community" | "editorial" | "academy" | "support";
}) {
  const icons = {
    community: MessageSquare,
    editorial: FileSearch,
    academy: TestTube2,
    support: ShieldCheck,
  };
  const Icon = icons[layout];
  return (
    <WorkspaceFrame icon={Icon} label={`${layout} surface`} subpage={subpage}>
      <div className="grid gap-10 p-5 sm:p-8 lg:grid-cols-[0.7fr_1.3fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--environment-accent)]">
            {m.product_current_view()}
          </p>
          <h3 className="mt-4 font-display text-3xl font-semibold">{subpage.label}</h3>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            {m.product_honest_boundary_description()}
          </p>
        </div>
        <div className="border-y border-border">
          <FeatureRows features={subpage.features} />
        </div>
      </div>
    </WorkspaceFrame>
  );
}

function ResearchWorkspace({ subpage }: { subpage: ProductSubpage }) {
  return (
    <WorkspaceFrame icon={FileSearch} label="Cited research workspace" subpage={subpage}>
      <div className="p-5 sm:p-7">
        <StageFlow
          labels={[
            "Question",
            "Plan",
            "Sources",
            "Evidence",
            "Contradictions",
            "Synthesis",
            "Cited report",
          ]}
          approvalIndex={4}
        />
        <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_17rem]">
          <SystemState
            variant="empty"
            title={m.product_no_verified_data()}
            description={m.product_no_verified_data_desc()}
          />
          <FeatureRail features={subpage.features} bordered />
        </div>
        {subpage.adapter === "research-jobs" ? (
          <div className="mt-7">
            <JobStatusPanel capability={subpage.adapter} />
          </div>
        ) : null}
      </div>
    </WorkspaceFrame>
  );
}

function GovernanceWorkspace({ subpage }: { subpage: ProductSubpage }) {
  return (
    <WorkspaceFrame icon={ShieldCheck} label="Policy and governance" subpage={subpage}>
      <div className="p-5 sm:p-7">
        <StageFlow
          labels={[
            "Policy",
            "Simulation",
            "Impact preview",
            "Approval",
            "Staged rollout",
            "Enforcement",
            "Audit",
            "Rollback",
          ]}
          approvalIndex={3}
        />
        <div className="mt-7 overflow-hidden rounded-xl border border-border">
          <FeatureRows features={subpage.features} />
        </div>
        <div className="mt-7">
          <PermissionPreviewPanel
            target={subpage.label}
            action={m.platform_policy_action()}
            scopes={subpage.features.slice(0, 4).map((feature) => feature.key)}
            consequence={m.platform_policy_consequence()}
            reversible
          />
        </div>
      </div>
    </WorkspaceFrame>
  );
}

function SecurityWorkspace({ subpage }: { subpage: ProductSubpage }) {
  return (
    <WorkspaceFrame icon={LockKeyhole} label="AI security operations" subpage={subpage}>
      <div className="p-5 sm:p-7">
        <StageFlow
          labels={[
            "Detect",
            "Evidence",
            "Confidence",
            "Scope",
            "Blast radius",
            "Recommended action",
            "Impact preview",
            "Reversibility",
            "Human approval",
            "Containment",
            "Recovery",
            "Audit trail",
            "Postmortem",
          ]}
          approvalIndex={8}
          danger
        />
        <div className="mt-7">
          <SecurityIncidentPanel />
        </div>
        <div className="mt-7">
          <PermissionPreviewPanel
            target={subpage.label}
            action={m.platform_security_containment_action()}
            scopes={subpage.features.slice(0, 4).map((feature) => feature.key)}
            consequence={m.platform_security_consequence()}
            reversible
          />
        </div>
        <div className="mt-7">
          <FeatureRail features={subpage.features} bordered />
        </div>
      </div>
    </WorkspaceFrame>
  );
}

function ToolRail({ icons }: { icons: readonly LucideIcon[] }) {
  return (
    <div className="flex flex-col items-center gap-2 border-e border-border bg-surface/20 p-2">
      {icons.map((Icon, index) => (
        <button
          key={index}
          type="button"
          disabled
          aria-label={m.product_surface_preview()}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground first:bg-foreground first:text-background"
        >
          <Icon className="size-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

function FeatureRail({
  features,
  bordered = false,
}: {
  features: readonly ProductFeature[];
  bordered?: boolean;
}) {
  return (
    <aside className={bordered ? "rounded-xl border border-border p-4" : "p-4"}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {m.product_features()}
      </p>
      <div className="mt-3 divide-y divide-border">
        {features.map((feature) => (
          <div key={feature.key} className="flex min-h-12 items-center gap-3 text-xs">
            <span className="min-w-0 flex-1 truncate">{feature.label}</span>
            <FeatureStatusBadge status={feature.state} size="xs" />
          </div>
        ))}
      </div>
    </aside>
  );
}

function FeatureRows({ features }: { features: readonly ProductFeature[] }) {
  return features.map((feature) => (
    <div
      key={feature.key}
      id={feature.key}
      className="flex min-h-16 items-center gap-4 border-b border-border px-3 py-3 last:border-b-0"
    >
      <CircleDot className="size-3.5 shrink-0 text-[var(--environment-accent)]" />
      <span className="min-w-0 flex-1 text-sm font-medium">{feature.label}</span>
      <FeatureStatusBadge status={feature.state} size="xs" />
    </div>
  ));
}

function StageFlow({
  labels,
  approvalIndex,
  danger = false,
}: {
  labels: readonly string[];
  approvalIndex: number;
  danger?: boolean;
}) {
  return (
    <ol className="scrollbar-hidden flex gap-0 overflow-x-auto border-y border-border">
      {labels.map((label, index) => {
        const isApproval = index === approvalIndex;
        const Icon = isApproval
          ? danger
            ? AlertTriangle
            : ShieldCheck
          : index > approvalIndex
            ? PauseCircle
            : CircleDot;
        return (
          <li
            key={label}
            className="flex min-w-36 flex-1 items-center gap-3 border-e border-border px-4 py-5 last:border-e-0"
          >
            <Icon
              className={`size-4 shrink-0 ${isApproval ? "text-amber-300" : "text-muted-foreground"}`}
              aria-hidden="true"
            />
            <span className="text-xs font-medium">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
