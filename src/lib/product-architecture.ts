import type { FeatureStatus } from "@/lib/feature-status";
import type { BackendCapabilityId } from "@/lib/platform-contracts";
import type { EnvironmentTone } from "@/lib/xeomx-os";

export type ProductEnvironmentId =
  | "ai"
  | "models"
  | "model-intelligence"
  | "evidence"
  | "model-store"
  | "create"
  | "build"
  | "app-builder"
  | "agents"
  | "workflows"
  | "knowledge"
  | "projects"
  | "collaboration"
  | "marketplace"
  | "creator-economy"
  | "community"
  | "magazine"
  | "academy"
  | "research"
  | "enterprise"
  | "developer"
  | "cybersecurity"
  | "billing"
  | "support"
  | "settings";

export type ProductLayout =
  | "conversation"
  | "catalog"
  | "evidence"
  | "commerce"
  | "studio"
  | "code"
  | "builder"
  | "agent"
  | "workflow"
  | "knowledge"
  | "project"
  | "collaboration"
  | "creator"
  | "community"
  | "editorial"
  | "academy"
  | "research"
  | "governance"
  | "developer"
  | "security"
  | "billing"
  | "support"
  | "settings";

export type ProductFeature = {
  key: string;
  label: string;
  route: string;
  state: FeatureStatus;
  dependency: string;
  adapter: BackendCapabilityId;
};

export type ProductSubpage = {
  key: string;
  label: string;
  route: string;
  state: FeatureStatus;
  dependency: string;
  adapter: BackendCapabilityId;
  features: readonly ProductFeature[];
};

export type ProductEnvironment = {
  id: ProductEnvironmentId;
  title: string;
  description: string;
  state: FeatureStatus;
  tone: EnvironmentTone;
  layout: ProductLayout;
  requiresAuth: boolean;
  subpages: readonly ProductSubpage[];
};

type RawFeature =
  | string
  | {
      label: string;
      state?: FeatureStatus;
      dependency?: ProductDependency;
    };

type ProductDependency = {
  label: string;
  adapter: BackendCapabilityId;
};

type RawSubpage = {
  key: string;
  label: string;
  state: FeatureStatus;
  dependency: ProductDependency;
  features: readonly RawFeature[];
};

function dependency(adapter: BackendCapabilityId, label: string): ProductDependency {
  return { adapter, label };
}

const ui = dependency("frontend-shell", "Repository UI and routing");
const auth = dependency("identity", "Supabase Auth and verified user session");
const publicData = dependency("database", "Supabase public data with RLS");
const privateData = dependency("database", "User-owned Supabase data with RLS");
const storage = dependency("storage", "Private object storage and signed access");
const provider = dependency("ai-provider", "Provider API, credentials vault and usage policy");
const jobs = dependency(
  "generation-jobs",
  "Durable async job runner, queue and resumable artifacts",
);
const researchJobs = dependency(
  "research-jobs",
  "Durable research runner, source ingestion and resumable cited reports",
);
const evidence = dependency(
  "evidence-datasets",
  "Versioned benchmark dataset and source provenance",
);
const modelBenchmarks = dependency(
  "model-benchmarks",
  "Versioned benchmark dataset with methodology and source provenance",
);
const payments = dependency("payments", "Confirmed payment webhook and order state");
const entitlements = dependency(
  "entitlements",
  "Server-owned entitlement ledger linked to confirmed payments",
);
const approvals = dependency(
  "approvals",
  "Policy engine, approval queue and immutable audit events",
);
const policyDecisions = dependency("policy-decisions", "Server-side RBAC/ABAC policy evaluation");
const auditEvents = dependency("audit-events", "Immutable server-side audit event store");
const credentials = dependency(
  "credentials",
  "Encrypted credential vault with scoped opaque references",
);
const collaboration = dependency(
  "collaboration",
  "Organization roles, membership and realtime presence",
);
const realtime = dependency("realtime", "Authorized realtime channels and presence policy");
const telemetry = dependency("telemetry", "Server-side usage, logs and observability pipeline");
const deployment = dependency(
  "deployment",
  "Verified deployment provider, environment policy and rollback service",
);
const securityEvents = dependency(
  "cybersecurity-events",
  "Authorized security event feed and response control plane",
);

function featureKey(label: string): string {
  return label
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function view(
  key: string,
  label: string,
  state: FeatureStatus,
  dependency: ProductDependency,
  features: readonly RawFeature[],
): RawSubpage {
  return { key, label, state, dependency, features };
}

function product(
  definition: Omit<ProductEnvironment, "subpages"> & { subpages: readonly RawSubpage[] },
): ProductEnvironment {
  const subpages = definition.subpages.map((subpage) => {
    const route = `/os/${definition.id}/${subpage.key}`;
    return {
      ...subpage,
      dependency: subpage.dependency.label,
      adapter: subpage.dependency.adapter,
      route,
      features: subpage.features.map((item) => {
        const input = typeof item === "string" ? { label: item } : item;
        const key = featureKey(input.label);
        return {
          key,
          label: input.label,
          route: `${route}#${key}`,
          state: input.state ?? subpage.state,
          dependency: (input.dependency ?? subpage.dependency).label,
          adapter: (input.dependency ?? subpage.dependency).adapter,
        };
      }),
    };
  });

  return { ...definition, subpages };
}

export const PRODUCT_ENVIRONMENTS: readonly ProductEnvironment[] = [
  product({
    id: "ai",
    title: "XEOMX AI",
    description: "Conversation, multimodal work and project context in one controlled environment.",
    state: "preview",
    tone: "intelligence",
    layout: "conversation",
    requiresAuth: false,
    subpages: [
      view("home", "AI Home", "preview", ui, ["Intent entry", "Recent work", "Project handoff"]),
      view("chat", "Chat", "mock", provider, [
        "Model selector",
        "Citations",
        "Branch conversation",
        "Regenerate",
        "Compare responses",
        "Export and share",
      ]),
      view("multimodal", "Multimodal Chat", "mock", provider, [
        "Attachments",
        "Voice",
        "Image input",
        "Web and research mode",
      ]),
      view("temporary", "Temporary Chat", "planned", auth, [
        "Ephemeral session",
        "Retention boundary",
      ]),
      view("projects", "Projects", "planned", privateData, ["Project context", "Context handoff"]),
      view("history", "History", "planned", privateData, [
        "Conversation history",
        "Branch history",
      ]),
      view("artifacts", "Artifacts", "planned", storage, ["Artifact preview", "Versioned export"]),
      view("files", "Files", "planned", storage, [
        "Universal files",
        "Permission-aware attachments",
      ]),
      view("memory", "Memory", "planned", approvals, ["Memory controls", "Delete and export"]),
      view("tools", "Tools", "planned", approvals, ["Tool scopes", "Human approval"]),
      view("connectors", "Connectors", "planned", provider, [
        "Connected apps",
        "Credential references",
      ]),
    ],
  }),
  product({
    id: "models",
    title: "Models",
    description: "A model catalog organized around suitability, evidence and explicit limitations.",
    state: "preview",
    tone: "intelligence",
    layout: "catalog",
    requiresAuth: false,
    subpages: [
      view("catalog", "Model Catalog", "preview", ui, [
        "Filters",
        "Provider grouping",
        "Use-case tags",
      ]),
      view("detail", "Model Detail", "preview", evidence, [
        "Capabilities",
        "Limitations",
        "Source links",
      ]),
      view("compare", "Compare", "planned", modelBenchmarks, [
        "Quality",
        "Reasoning",
        "Coding",
        "Multimodal",
        "Context",
        "Latency",
        "Cost",
        "Evidence",
        "Community reviews",
        "Use-case suitability",
      ]),
      view("playground", "Playground", "planned", provider, [
        "Prompt input",
        "Model run",
        "Usage boundary",
      ]),
      view("leaderboards", "Leaderboards", "planned", modelBenchmarks, [
        "Verified rankings",
        "Methodology link",
      ]),
      view("benchmarks", "Benchmarks", "planned", modelBenchmarks, [
        "Benchmark sources",
        "Reproducibility",
      ]),
      view("pricing", "Pricing", "planned", provider, [
        "Provider pricing source",
        "Effective date",
      ]),
      view("providers", "Providers", "preview", ui, ["Provider directory", "Availability state"]),
      view("collections", "Collections", "planned", privateData, [
        "Model collections",
        "Sharing policy",
      ]),
      view("saved", "Saved Models", "planned", privateData, ["Save", "Remove", "Project handoff"]),

      view("fine-tuning", "Fine-tuning Studio", "preview", jobs, [
        { label: "Training dataset", dependency: evidence },
        { label: "Dataset import", dependency: storage },
        { label: "Provider capability", dependency: provider },
        "Configuration",
        "Validation split",
        "Run status",
        "Artifacts",
        { label: "Lineage", dependency: evidence },
      ]),
      view("deployments", "Model Deployment", "preview", deployment, [
        "Endpoint configuration",
        "Environment",
        "Version",
        { label: "Provider status", dependency: provider },
        { label: "Access policy", dependency: policyDecisions },
        { label: "Usage and health", dependency: telemetry },
        "Rollback plan",
      ]),
    ],
  }),
  product({
    id: "model-intelligence",
    title: "Model Intelligence",
    description: "Decision support for model selection without invented benchmark claims.",
    state: "planned",
    tone: "intelligence",
    layout: "evidence",
    requiresAuth: false,
    subpages: [
      view("overview", "Overview", "preview", ui, ["Intelligence scope", "Data freshness"]),
      view("benchmarks", "Benchmark Explorer", "planned", modelBenchmarks, [
        "Dataset filters",
        "Source provenance",
      ]),
      view("ranking", "Use-case Ranking", "planned", modelBenchmarks, [
        "Suitability criteria",
        "Uncertainty",
      ]),
      view("cost", "Cost Intelligence", "planned", modelBenchmarks, [
        "Pricing history",
        "Normalization",
      ]),
      view("latency", "Latency Intelligence", "planned", modelBenchmarks, [
        "Region",
        "Percentile method",
      ]),
      view("context", "Context Analysis", "planned", modelBenchmarks, [
        "Context limits",
        "Retrieval suitability",
      ]),
      view("reliability", "Provider Reliability", "planned", telemetry, [
        "Availability evidence",
        "Incident history",
      ]),
      view("changes", "Change History", "planned", evidence, ["Model version", "Observed change"]),
      view("registry", "Model Registry & Governance", "preview", evidence, [
        "Versions",
        "Lineage",
        "Approved and blocked state",
        "Provider policy",
        "Regions",
        "Licenses",
        "Deprecation",
        { label: "Audit changes", dependency: auditEvents },
        { label: "Exportable inventory", dependency: storage },
      ]),
    ],
  }),
  product({
    id: "evidence",
    title: "Evidence Lab",
    description: "Provenance-first inspection of tests, contradictions and reproducibility.",
    state: "planned",
    tone: "research",
    layout: "evidence",
    requiresAuth: false,
    subpages: [
      view("explorer", "Evidence Explorer", "planned", evidence, [
        "Source graph",
        "Claim status",
        "Contradictions",
      ]),
      view("methodology", "Benchmark Methodology", "preview", ui, [
        "Protocol",
        "Limitations",
        "Version",
      ]),
      view("community-tests", "Community Tests", "planned", publicData, [
        "Test submission",
        "Verification state",
      ]),
      view("reviews", "Reviews", "planned", publicData, ["Review evidence", "Conflict disclosure"]),
      view("runs", "Test Runs", "planned", jobs, ["Run configuration", "Artifacts", "Logs"]),
      view("contradictions", "Contradictions", "planned", evidence, [
        "Conflicting claims",
        "Resolution state",
      ]),
      view("provenance", "Source Provenance", "planned", evidence, [
        "Source chain",
        "Effective date",
      ]),
      view("authenticity", "Content Authenticity", "preview", evidence, [
        "C2PA manifest",
        "AI label",
        "Edit history",
        "Source ingredients",
        "Model used",
        "Rights",
        "Verification state",
        { label: "Human-readable provenance card", dependency: ui },
        { label: "Technical manifest detail", dependency: evidence },
        { label: "Offline-safe metadata", dependency: storage },
      ]),
      view("datasets", "Dataset Studio", "preview", evidence, [
        { label: "Import", dependency: storage },
        { label: "Connect", dependency: credentials },
        "Version",
        "Schema",
        "Cleaning",
        "Quality",
        { label: "Permissions", dependency: policyDecisions },
        "Lineage",
      ]),
      view("evals", "Evals Lab", "preview", evidence, [
        "Test cases",
        "Datasets",
        "Model vs model",
        "Agent vs agent",
        "Human evaluation",
        "AI judge",
        "Scoring",
        "Reproducible configuration",
        "Methodology",
        { label: "Export results", dependency: storage },
      ]),
      view("observability", "Traces & Observability", "preview", telemetry, [
        "Traces",
        "Spans",
        "Tokens",
        "Tool calls",
        "Cost",
        "Latency",
        "Errors",
        "Replay",
        "Logs",
        "Search and filters",
        "Large-payload folding",
      ]),
      view("eval-registry", "Eval Registry & Lineage", "preview", evidence, [
        "Eval versions",
        "Datasets",
        "Judges",
        "Metrics",
        "Lineage",
        "Deprecation",
        "Reproducibility",
        { label: "Immutable historical runs", dependency: auditEvents },
        { label: "Export methodology", dependency: storage },
      ]),
      view("reproducibility", "Reproducibility", "planned", jobs, [
        "Replay",
        "Environment lock",
        "Result diff",
      ]),

      view("annotation", "Annotation Studio", "preview", evidence, [
        { label: "Dataset version", dependency: storage },
        "Label schema",
        "Annotation queue",
        { label: "Reviewer assignment", dependency: collaboration },
        "Agreement and conflicts",
        "Quality checks",
        "Exported version",
      ]),
      view("synthetic-data", "Synthetic Data", "preview", jobs, [
        "Generation specification",
        { label: "Provider policy", dependency: provider },
        "Sampling",
        "Constraint checks",
        { label: "Provenance", dependency: evidence },
        "Quality report",
        { label: "Versioned export", dependency: storage },
      ]),
      view("experiments", "A/B Testing", "preview", evidence, [
        "Experiment hypothesis",
        "Variants",
        "Allocation",
        "Primary metric",
        "Guardrail metrics",
        { label: "Run telemetry", dependency: telemetry },
        "Result evidence",
        "Decision log",
      ]),
    ],
  }),
  product({
    id: "model-store",
    title: "Model Store",
    description: "Model access and subscriptions with payment-confirmed entitlement boundaries.",
    state: "planned",
    tone: "commerce",
    layout: "commerce",
    requiresAuth: true,
    subpages: [
      view("plans", "Plans", "planned", payments, [
        "Plan discovery",
        "Terms",
        "Confirmation boundary",
      ]),
      view("providers", "Providers", "planned", provider, [
        "Provider access",
        "Regional availability",
      ]),
      view("bundles", "Bundles", "planned", payments, [
        "Bundle composition",
        "Entitlement preview",
      ]),
      view("access", "Model Access", "planned", entitlements, ["Access status", "Revocation"]),
      view("usage", "Usage", "planned", telemetry, ["Usage ledger", "Limit state"]),
      view("entitlements", "Entitlements", "planned", entitlements, [
        "Confirmed entitlement",
        "Audit reference",
      ]),
      view("invoices", "Invoices", "planned", payments, ["Invoice history", "Payment status"]),
    ],
  }),
  product({
    id: "create",
    title: "Create",
    description: "Resumable media creation with shared assets, history and project context.",
    state: "preview",
    tone: "creation",
    layout: "studio",
    requiresAuth: false,
    subpages: [
      view("home", "Create Home", "preview", ui, [
        "Intent routing",
        "Recent generations",
        "Assets",
      ]),
      view("image", "Image Studio", "mock", jobs, [
        "Generate",
        "Edit",
        "Variations",
        "Reference image",
        "Mask and inpaint",
        "Outpaint",
        "Upscale",
        "Background",
        "History",
      ]),
      view("video", "Video Studio", "mock", jobs, [
        "Generate",
        "Image to video",
        "Timeline",
        "Scenes",
        "Extend",
        "References",
        "Captions",
        "Audio",
        "Dubbing",
        "Export",
      ]),
      view("voice", "Voice Studio", "planned", provider, [
        "TTS",
        "Voice projects",
        "Dubbing",
        "Transcription",
        "Translation",
        "Audio editing",
      ]),
      view("audio", "Music and Audio", "planned", provider, [
        "Generation",
        "Editing",
        "Project handoff",
      ]),
      view("spatial", "3D and Spatial", "planned", jobs, [
        "Generation",
        "Assets",
        "Preview",
        "Materials",
        "Export",
        "Spatial workspace",
      ]),
      view("canvas", "Design Workspace", "planned", jobs, ["Canvas", "Layers", "Version history"]),
      view("assets", "Assets", "planned", storage, ["Universal assets", "Metadata", "Permissions"]),
      view("generations", "Generations", "planned", jobs, ["Job state", "Resume", "Retry"]),
      view("templates", "Templates", "preview", ui, ["Template catalog", "Use in project"]),
      view("brand-kits", "Brand Kits", "planned", privateData, ["Brand assets", "Usage policy"]),

      view("dubbing", "Dubbing Studio", "preview", jobs, [
        { label: "Source media", dependency: storage },
        { label: "Transcription", dependency: provider },
        "Speaker mapping",
        "Translation",
        { label: "Voice generation", dependency: provider },
        "Timeline review",
        "Export",
      ]),
      view("avatar", "Avatar Studio", "preview", jobs, [
        { label: "Reference assets", dependency: storage },
        "Identity profile",
        { label: "Generation provider", dependency: provider },
        "Wardrobe and scene",
        "Voice binding",
        "Safety review",
        "Export",
      ]),
      view("publishing", "Publishing Center", "preview", deployment, [
        "Destination",
        "Metadata",
        "Version",
        { label: "Rights and provenance", dependency: evidence },
        { label: "Permission check", dependency: policyDecisions },
        "Preview",
        "Publish gate",
        "Rollback",
      ]),
    ],
  }),
  product({
    id: "build",
    title: "Build and Code",
    description:
      "A guarded build lifecycle from idea through rollback, without fake deployment claims.",
    state: "planned",
    tone: "developer",
    layout: "code",
    requiresAuth: true,
    subpages: [
      view("workspace", "Workspace", "planned", privateData, [
        "Project tree",
        "Editor context",
        "Files",
      ]),
      view("projects", "Projects", "planned", privateData, ["Build projects", "Membership"]),
      view("code", "Code", "planned", storage, ["Editor", "Diff", "Version"]),
      view("preview", "Preview", "planned", jobs, ["Preview build", "Responsive viewport"]),
      view("terminal", "Terminal", "planned", provider, ["Sandboxed commands", "Output stream"]),
      view("tests", "Tests", "planned", jobs, ["Test run", "Failure details"]),
      view("deployments", "Deployments", "planned", deployment, ["Deploy gate", "Provider state"]),
      view("observability", "Observability", "planned", telemetry, ["Logs", "Errors", "Health"]),
      view("versions", "Versions", "planned", privateData, ["Version history", "Diff"]),
      view("rollback", "Rollback", "planned", deployment, [
        "Rollback preview",
        "Approval",
        "Audit",
      ]),
      view("environment", "Environment Variables", "planned", approvals, [
        "Secret references",
        "Rotation",
        "Access log",
      ]),
      view("backend", "Backend Platform", "preview", privateData, [
        "Database",
        { label: "Authentication", dependency: auth },
        { label: "Storage", dependency: storage },
        { label: "Functions", dependency: jobs },
        { label: "Realtime", dependency: realtime },
        { label: "Queues", dependency: jobs },
        { label: "Cron", dependency: jobs },
        { label: "Email", dependency: provider },
        { label: "Webhooks", dependency: provider },
        { label: "Secret references", dependency: credentials },
        { label: "Destructive change approval", dependency: approvals },
      ]),

      view("database", "Database Studio", "preview", privateData, [
        "Schema explorer",
        "Table editor",
        "Query workspace",
        { label: "Migration preview", dependency: approvals },
        { label: "Access policy", dependency: policyDecisions },
        { label: "Backups and restore", dependency: storage },
        "Change history",
      ]),
      view("git-devops", "Git & DevOps", "preview", deployment, [
        { label: "Repository connection", dependency: credentials },
        "Branches",
        "Pull requests",
        "Build checks",
        "Environments",
        { label: "Deployment gate", dependency: approvals },
        { label: "Logs and health", dependency: telemetry },
        "Rollback",
      ]),
    ],
  }),
  product({
    id: "app-builder",
    title: "App and Site Builder",
    description:
      "Prompt-to-app architecture with editable pages, components and guarded publishing.",
    state: "planned",
    tone: "creation",
    layout: "builder",
    requiresAuth: true,
    subpages: [
      view("prompt", "Prompt to App", "planned", jobs, ["Intent", "Plan", "Generate"]),
      view("workspace", "Workspace", "planned", privateData, ["Canvas", "Selection", "Inspector"]),
      view("pages", "Pages", "planned", privateData, ["Page tree", "Route metadata"]),
      view("components", "Components", "planned", privateData, ["Component library", "Variants"]),
      view("data", "Data", "planned", approvals, ["Data source", "Permission boundary"]),
      view("preview", "Preview", "planned", jobs, ["Live preview", "Error overlay"]),
      view("responsive", "Responsive Preview", "planned", ui, [
        "Viewport switcher",
        "Overflow checks",
      ]),
      view("versions", "Version History", "planned", privateData, ["Snapshot", "Restore preview"]),
      view("publish", "Publish and Deploy", "planned", deployment, [
        "Publish abstraction",
        "Deploy gate",
      ]),
    ],
  }),
  product({
    id: "agents",
    title: "Agents",
    description: "Scoped agents with credentials, budget, risk preview, approvals and audit.",
    state: "planned",
    tone: "automation",
    layout: "agent",
    requiresAuth: true,
    subpages: [
      view("library", "Agent Library", "planned", privateData, ["Agent catalog", "Owner", "State"]),
      view("builder", "Agent Builder", "planned", approvals, [
        "Objective",
        "Tools",
        "Scopes",
        "Credentials",
        "Budget",
        "Risk preview",
      ]),
      view("detail", "Agent Detail", "planned", privateData, ["Configuration", "Version", "Audit"]),
      view("tools", "Tools", "planned", credentials, ["Tool catalog", "Tool scopes"]),
      view("memory", "Memory", "planned", privateData, ["Memory policy", "Retention"]),
      view("knowledge", "Knowledge", "planned", privateData, ["Knowledge scope", "Citations"]),
      view("permissions", "Permissions", "planned", policyDecisions, [
        "Least privilege",
        "Policy evaluation",
      ]),
      view("runs", "Runs", "planned", jobs, ["Run", "Monitor", "Pause and stop"]),
      view("operator", "Operator / Computer Use", "preview", jobs, [
        "Browser session",
        "Computer session",
        "Files",
        "Terminal",
        "Screenshots",
        "Downloads",
        { label: "Credential references", dependency: credentials },
        { label: "Sensitive-action approval", dependency: approvals },
        { label: "Take over", dependency: approvals },
        { label: "Pause and stop", dependency: approvals },
        { label: "Replay", dependency: auditEvents },
      ]),
      view("tools-hub", "MCP & Tools Hub", "preview", credentials, [
        "MCP servers",
        "Apps",
        "Skills",
        "Tool permissions",
        "Authentication",
        "Health",
        "Marketplace",
        { label: "Scope disclosure", dependency: policyDecisions },
        { label: "Revoke", dependency: approvals },
      ]),
      view("registry", "Agent Registry", "preview", privateData, [
        "Identity",
        "Owner and sponsor",
        "Version",
        "Tools",
        "Permissions",
        "Memory",
        "Deployment",
        "Lifecycle status",
        { label: "Ownership audit", dependency: auditEvents },
        { label: "Exportable inventory", dependency: storage },
      ]),
      view("runtime", "Sandbox & Runtime", "preview", jobs, [
        "Browser sandbox",
        "Desktop sandbox",
        "Code sandbox",
        { label: "Network policy", dependency: policyDecisions },
        "File scope",
        "Resource limits",
        "Session lifecycle",
        { label: "Credential boundary", dependency: credentials },
        { label: "Kill switch", dependency: approvals },
      ]),
      view("observability", "Agent Observability", "preview", telemetry, [
        "Traces",
        "Tool calls",
        "Tokens",
        "Cost",
        "Latency",
        "Errors",
        "Alerts",
        "Replay",
        "Dashboards",
        { label: "Retention controls", dependency: approvals },
      ]),
      view("schedules", "Schedules", "planned", approvals, ["Schedule", "Approval requirement"]),
      view("evaluation", "Evaluation", "planned", evidence, [
        "Test set",
        "Run comparison",
        "Limitations",
      ]),

      view("teams", "Multi-Agent Teams", "preview", collaboration, [
        "Team graph",
        "Roles and ownership",
        "Handoffs",
        { label: "Shared memory policy", dependency: policyDecisions },
        { label: "Tool scopes", dependency: credentials },
        { label: "Approval boundaries", dependency: approvals },
        "Run coordination",
        { label: "Team traces", dependency: telemetry },
      ]),
    ],
  }),
  product({
    id: "workflows",
    title: "Workflows and Automation",
    description: "Composable automation with dry runs, credential isolation and approval gates.",
    state: "planned",
    tone: "automation",
    layout: "workflow",
    requiresAuth: true,
    subpages: [
      view("library", "Workflow Library", "planned", privateData, [
        "Workflow catalog",
        "Templates",
      ]),
      view("builder", "Builder", "planned", approvals, [
        "Triggers",
        "Actions",
        "Conditions",
        "Branches",
        "Variables",
      ]),
      view("credentials", "Credentials", "planned", credentials, [
        "Opaque references",
        "Scopes",
        "Rotation",
      ]),
      view("dry-run", "Dry Run", "planned", jobs, [
        "Input preview",
        "Side-effect isolation",
        "Result",
      ]),
      view("runs", "Runs", "planned", jobs, ["Run monitor", "Pause", "Resume"]),
      view("schedules", "Schedules", "planned", approvals, ["Schedule", "Policy gate"]),
      view("approvals", "Approvals", "planned", approvals, ["Approval inbox", "Decision", "Audit"]),
      view("logs", "Logs", "planned", telemetry, ["Execution logs", "Error recovery"]),
      view("templates", "Templates", "preview", ui, [
        "MCP pattern",
        "API and webhook pattern",
        "n8n-compatible concepts",
      ]),
    ],
  }),
  product({
    id: "knowledge",
    title: "Knowledge",
    description: "Permission-aware sources, documents and citations with visible index state.",
    state: "planned",
    tone: "research",
    layout: "knowledge",
    requiresAuth: true,
    subpages: [
      view("home", "Knowledge Home", "planned", privateData, ["Recent sources", "Index health"]),
      view("sources", "Sources", "planned", storage, ["Source ingest", "Source status"]),
      view("documents", "Documents", "planned", storage, ["Document preview", "Metadata"]),
      view("collections", "Collections", "planned", privateData, ["Collection scope", "Sharing"]),
      view("spaces", "Spaces", "planned", collaboration, ["Space membership", "Policies"]),
      view("search", "Search", "planned", privateData, ["Semantic search", "Permission filtering"]),
      view("index", "Index Status", "planned", jobs, ["Index job", "Retry", "Failure state"]),
      view("permissions", "Permissions", "planned", policyDecisions, [
        "Source permissions",
        "Policy check",
      ]),
      view("connections", "Connections", "planned", provider, ["Connector", "Credential scope"]),
      view("citations", "Citations", "planned", evidence, [
        "Citation resolution",
        "Source provenance",
      ]),

      view("graph", "Knowledge Graph", "preview", evidence, [
        "Entities",
        "Relationships",
        "Source provenance",
        "Confidence",
        "Permission filtering",
        "Graph search",
        "Project handoff",
      ]),
    ],
  }),
  product({
    id: "projects",
    title: "Projects",
    description: "The persistent XEOMX context boundary for files, work, people and history.",
    state: "planned",
    tone: "project",
    layout: "project",
    requiresAuth: true,
    subpages: [
      view("home", "Project Home", "planned", privateData, [
        "Project switcher",
        "Continue working",
      ]),
      view("overview", "Overview", "planned", privateData, ["Project context", "Recent activity"]),
      view("inbox", "Inbox", "preview", privateData, [
        { label: "Needs action", dependency: approvals },
        { label: "Approvals", dependency: approvals },
        { label: "Mentions", dependency: collaboration },
        { label: "Generation completions", dependency: jobs },
        { label: "Payment alerts", dependency: payments },
        { label: "Security alerts", dependency: securityEvents },
        { label: "Snooze", dependency: privateData },
        { label: "Assign", dependency: collaboration },
      ]),
      view("chat", "Chat", "planned", privateData, ["Project conversations", "Context carryover"]),
      view("files", "Files", "planned", storage, ["Universal files", "Version"]),
      view("research", "Research", "planned", privateData, ["Research artifacts", "Citations"]),
      view("create", "Create", "planned", jobs, ["Generations", "Asset handoff"]),
      view("agents", "Agents", "planned", approvals, ["Project agents", "Run policy"]),
      view("workflows", "Workflows", "planned", approvals, ["Project workflows", "Approvals"]),
      view("apps", "Apps", "planned", privateData, ["Project apps", "Versions"]),
      view("knowledge", "Knowledge", "planned", privateData, ["Knowledge scope", "Index"]),
      view("members", "Members", "planned", collaboration, ["Members", "Roles"]),
      view("activity", "Activity", "planned", telemetry, ["Activity feed", "Audit references"]),
      view("settings", "Settings", "planned", approvals, ["Project policy", "Retention"]),

      view("for-you", "For You", "preview", privateData, [
        "Personalized work queue",
        "Recommended next actions",
        { label: "Project-aware ranking", dependency: privateData },
        { label: "Permission-aware recommendations", dependency: policyDecisions },
        { label: "Freshness and explanation", dependency: telemetry },
      ]),
    ],
  }),
  product({
    id: "collaboration",
    title: "Collaboration",
    description: "Shared work with explicit membership, review and approval boundaries.",
    state: "planned",
    tone: "project",
    layout: "collaboration",
    requiresAuth: true,
    subpages: [
      view("spaces", "Shared Spaces", "planned", collaboration, [
        "Space switcher",
        "Shared context",
      ]),
      view("members", "Members", "planned", collaboration, ["Members", "Roles"]),
      view("comments", "Comments", "planned", collaboration, ["Thread", "Resolve"]),
      view("mentions", "Mentions", "planned", collaboration, ["Mention", "Inbox delivery"]),
      view("activity", "Activity", "planned", telemetry, ["Activity timeline", "Filter"]),
      view("permissions", "Permissions", "planned", policyDecisions, ["Role", "Resource policy"]),
      view("review", "Review", "planned", collaboration, ["Review request", "Decision"]),
      view("approvals", "Approvals", "planned", approvals, ["Approval queue", "Audit"]),
      view("presence", "Presence", "planned", realtime, ["Realtime presence", "Availability"]),
    ],
  }),
  product({
    id: "marketplace",
    title: "Marketplace",
    description: "A broader product marketplace where Prompt Hub is one honest subsystem.",
    state: "beta",
    tone: "commerce",
    layout: "commerce",
    requiresAuth: false,
    subpages: [
      view("home", "Marketplace Home", "beta", publicData, ["Product types", "Prompt Hub handoff"]),
      view("search", "Search", "live", publicData, [
        "Prompt search",
        "Category filters",
        "Empty state",
      ]),
      view("categories", "Categories", "preview", ui, [
        "Prompts",
        "Agents",
        "Workflows",
        "Templates",
        "Apps",
        "Assets",
        "Model bundles",
        "Learning resources",
      ]),
      view("collections", "Collections", "live", publicData, [
        "Public collections",
        "Collection detail",
      ]),
      view("product", "Product Detail", "beta", publicData, [
        "Prompt detail",
        "Creator",
        "Provenance",
      ]),
      view("creator", "Creator", "beta", publicData, ["Creator profile", "Listings"]),
      view("reviews", "Reviews", "planned", publicData, ["Review", "Verification"]),
      view("purchases", "Purchases", "planned", payments, [
        "Payment confirmation",
        "Order history",
      ]),
      view("library", "Library", "planned", entitlements, ["Entitled products", "Access state"]),
    ],
  }),
  product({
    id: "creator-economy",
    title: "Creator Economy",
    description: "Creator products, rights and revenue surfaces without fabricated commerce.",
    state: "planned",
    tone: "commerce",
    layout: "creator",
    requiresAuth: true,
    subpages: [
      view("studio", "Creator Studio", "beta", privateData, ["Creator profile", "Drafts"]),
      view("products", "Products", "planned", privateData, ["Product drafts", "Product state"]),
      view("listings", "Listings", "planned", approvals, ["Listing preview", "Review", "Publish"]),
      view("analytics", "Analytics", "beta", telemetry, ["Creator analytics", "Data freshness"]),
      view("revenue", "Revenue", "planned", payments, ["Revenue ledger", "Currency"]),
      view("orders", "Orders", "planned", payments, ["Orders", "Entitlement state"]),
      view("reviews", "Reviews", "planned", publicData, ["Product reviews", "Moderation"]),
      view("audience", "Audience", "planned", publicData, ["Followers", "Consent boundary"]),
      view("payouts", "Payouts", "planned", payments, ["Payout abstraction", "Verification"]),
      view("licensing", "Licensing and Rights", "planned", approvals, [
        "Rights",
        "License",
        "Provenance",
      ]),
    ],
  }),
  product({
    id: "community",
    title: "Community",
    description: "Discovery and discussion without engagement dark patterns.",
    state: "beta",
    tone: "commerce",
    layout: "community",
    requiresAuth: false,
    subpages: [
      view("feed", "Feed", "beta", publicData, ["Public feed", "No infinite-pressure cues"]),
      view("following", "Following", "planned", privateData, ["Following feed", "Controls"]),
      view("creators", "Creators", "beta", publicData, ["Creator directory", "Profiles"]),
      view("collections", "Collections", "live", publicData, ["Collections", "Save"]),
      view("reviews", "Reviews", "planned", publicData, ["Reviews", "Moderation"]),
      view("discussions", "Discussions", "planned", publicData, ["Threads", "Reporting"]),
      view("showcases", "Showcases", "preview", ui, ["Showcase gallery", "Provenance"]),
      view("profiles", "Profiles", "beta", publicData, ["Public profile", "Contributions"]),

      view("challenges", "Challenges", "preview", collaboration, [
        "Challenge brief",
        "Eligibility",
        "Submission",
        "Team participation",
        "Review criteria",
        "Leaderboard state",
        "Results and evidence",
      ]),
    ],
  }),
  product({
    id: "magazine",
    title: "Magazine",
    description: "Editorial coverage of AI, models, creators and research.",
    state: "preview",
    tone: "learning",
    layout: "editorial",
    requiresAuth: false,
    subpages: [
      view("home", "Editorial Home", "preview", ui, ["Featured story", "Editorial collections"]),
      view("news", "AI News", "planned", publicData, ["News index", "Source date"]),
      view("features", "Features", "preview", ui, ["Long-form feature", "Reading state"]),
      view("interviews", "Interviews", "planned", publicData, ["Interview index", "Attribution"]),
      view("releases", "Model Releases", "planned", evidence, [
        "Release history",
        "Provider source",
      ]),
      view("creators", "Creator Stories", "planned", publicData, ["Creator story", "Disclosure"]),
      view("research", "Research Explainers", "planned", evidence, ["Explainer", "Citations"]),
      view("collections", "Collections", "preview", ui, ["Editorial collection", "Reading path"]),
    ],
  }),
  product({
    id: "academy",
    title: "Academy",
    description: "Learning paths that end in real XEOMX artifacts and projects.",
    state: "planned",
    tone: "learning",
    layout: "academy",
    requiresAuth: false,
    subpages: [
      view("home", "Academy Home", "preview", ui, ["Path discovery", "Learning goals"]),
      view("paths", "Learning Paths", "planned", privateData, ["Path", "Prerequisites"]),
      view("courses", "Courses", "planned", privateData, ["Course outline", "Enrollment"]),
      view("lessons", "Lessons", "planned", privateData, ["Lesson", "Completion"]),
      view("labs", "Interactive Labs", "planned", jobs, ["Lab runtime", "Artifact"]),
      view("projects", "Projects", "planned", privateData, ["Real XEOMX project", "Handoff"]),
      view("progress", "Progress", "planned", privateData, ["Progress state", "Resume"]),
      view("credentials", "Credentials", "planned", approvals, [
        "Assessment",
        "Credential provenance",
      ]),

      view("events", "Events & Webinars", "preview", collaboration, [
        "Event catalog",
        "Registration",
        "Session details",
        "Speakers",
        "Calendar handoff",
        "Replay",
        "Learning resources",
      ]),
    ],
  }),
  product({
    id: "research",
    title: "Research",
    description: "A cited research workflow where unsupported claims remain visible.",
    state: "preview",
    tone: "research",
    layout: "research",
    requiresAuth: false,
    subpages: [
      view("home", "Research Home", "preview", ui, ["Research intent", "Workflow preview"]),
      view("new", "New Research", "planned", researchJobs, ["Question", "Plan", "Scope"]),
      view("workspace", "Research Workspace", "planned", researchJobs, [
        "Search",
        "Notes",
        "Synthesis",
      ]),
      view("sources", "Sources", "planned", evidence, ["Sources", "Quality state"]),
      view("evidence", "Evidence", "planned", evidence, ["Claims", "Citations", "Provenance"]),
      view("contradictions", "Contradictions", "planned", evidence, ["Conflict", "Resolution"]),
      view("notes", "Notes", "planned", privateData, ["Notes", "Links"]),
      view("reports", "Reports", "planned", researchJobs, [
        "Synthesis",
        "Cited report",
        "Unsupported claim flags",
      ]),
      view("library", "Library", "planned", privateData, ["Research library", "Permissions"]),
      view("published", "Published Research", "planned", publicData, [
        "Published report",
        "Version",
      ]),

      view("monitoring", "Research Monitoring", "preview", researchJobs, [
        "Watch topic",
        "Sources",
        "Cadence",
        "Change detection",
        { label: "Evidence updates", dependency: evidence },
        { label: "Run health", dependency: telemetry },
        "Alert and review",
      ]),
    ],
  }),
  product({
    id: "enterprise",
    title: "Enterprise",
    description: "Organization policy, governance and spend controls with staged enforcement.",
    state: "planned",
    tone: "enterprise",
    layout: "governance",
    requiresAuth: true,
    subpages: [
      view("home", "Enterprise Home", "planned", collaboration, [
        "Organization context",
        "Governance state",
      ]),
      view("organization", "Organization", "planned", collaboration, [
        "Organization profile",
        "Domains",
      ]),
      view("members", "Members", "planned", collaboration, ["Members", "Invitations"]),
      view("teams", "Teams", "planned", collaboration, ["Teams", "Membership"]),
      view("roles", "Roles", "planned", policyDecisions, ["RBAC roles", "Assignments"]),
      view("policies", "Policies", "planned", policyDecisions, [
        "Policy",
        "Simulation",
        "Impact preview",
        "Staged rollout",
        "Enforcement",
        "Rollback",
      ]),
      view("security", "Security", "planned", approvals, ["Security posture", "Events"]),
      view("data-governance", "Data Governance", "planned", approvals, [
        "Retention",
        "Residency",
        "Export and delete",
      ]),
      view("model-governance", "Model Governance", "planned", evidence, [
        "Approved models",
        "Exceptions",
      ]),
      view("ai-governance", "AI Governance", "planned", approvals, [
        "AI policy",
        "Agent boundaries",
      ]),
      view("spend", "Spend", "planned", payments, ["Budgets", "Alerts"]),
      view("audit", "Audit", "planned", auditEvents, ["Audit events", "Export"]),
      view("identity", "SSO and SCIM", "planned", provider, [
        "Identity provider",
        "Provisioning status",
      ]),
      view("compliance", "Compliance", "planned", approvals, ["Control mapping", "Evidence"]),
      view("admin", "Admin Center", "preview", collaboration, [
        "Feature flags",
        "Domains",
        { label: "Policies", dependency: policyDecisions },
        "Integrations",
        { label: "Storage", dependency: storage },
        "Quotas",
        "Announcements",
        { label: "Change preview", dependency: approvals },
        { label: "Audit changes", dependency: auditEvents },
      ]),
      view("integrations", "Integrations Hub", "preview", provider, [
        "Google",
        "Microsoft",
        "Slack",
        "GitHub",
        "Notion",
        "Figma",
        "Zapier and n8n",
        "Custom OAuth and API",
        { label: "Scope disclosure", dependency: policyDecisions },
        { label: "Credential references", dependency: credentials },
        { label: "Revoke", dependency: approvals },
      ]),
      view("deployments", "Deployments", "planned", deployment, ["Deployment policy", "Approval"]),
    ],
  }),
  product({
    id: "developer",
    title: "Developer Platform",
    description: "APIs, keys, usage and webhooks with secret-safe lifecycle boundaries.",
    state: "planned",
    tone: "developer",
    layout: "developer",
    requiresAuth: true,
    subpages: [
      view("home", "Developer Home", "planned", ui, ["Developer navigation", "Platform status"]),
      view("api", "API", "planned", provider, ["API reference", "Authentication model"]),
      view("keys", "API Keys", "planned", approvals, [
        "Create once",
        "Secret never shown again",
        "Revoke",
      ]),
      view("projects", "Projects", "planned", privateData, ["Developer projects", "Environments"]),
      view("models", "Models", "planned", provider, ["Model access", "Availability"]),
      view("usage", "Usage", "planned", telemetry, ["Usage", "Limits"]),
      view("logs", "Logs", "planned", telemetry, ["Request logs", "Errors"]),
      view("webhooks", "Webhooks", "planned", provider, [
        "Endpoint",
        "Signing secret reference",
        "Delivery",
      ]),
      view("sdk", "SDK Documentation", "planned", ui, ["SDK guides", "Versions"]),
      view("playground", "Playground", "planned", provider, ["Request builder", "Response"]),
      view("limits", "Rate Limits", "planned", telemetry, ["Limit policy", "Retry guidance"]),
      view("billing", "Billing", "planned", payments, ["Usage billing", "Invoices"]),
    ],
  }),
  product({
    id: "cybersecurity",
    title: "AI Cybersecurity",
    description: "Human-approved security operations with evidence and reversible containment.",
    state: "planned",
    tone: "enterprise",
    layout: "security",
    requiresAuth: true,
    subpages: [
      view("center", "Security Center", "planned", securityEvents, [
        "Security posture",
        "Priority queue",
      ]),
      view("copilot", "Security Copilot", "planned", provider, [
        "Investigation assistance",
        "Citation boundary",
      ]),
      view("incidents", "Incidents", "planned", securityEvents, [
        "Detect",
        "Evidence",
        "Scope",
        "Blast radius",
        "Recovery",
        "Postmortem",
      ]),
      view("threats", "Threats", "planned", securityEvents, ["Threats", "Source"]),
      view("assets", "Assets", "planned", securityEvents, ["Asset inventory", "Ownership"]),
      view("identity", "Identity", "planned", approvals, ["Identity risk", "Session action"]),
      view("cloud", "Cloud", "planned", provider, ["Cloud connectors", "Read-only discovery"]),
      view("applications", "Applications", "planned", securityEvents, [
        "Application inventory",
        "Risk",
      ]),
      view("ai-security", "AI and Model Security", "planned", securityEvents, [
        "Prompt injection defense",
        "Model and data leakage",
        "Model provenance",
        "AI supply chain",
      ]),
      view("agent-security", "Agent Security", "planned", approvals, [
        "Agent permission monitoring",
        "Tool abuse detection",
        "Behavior anomalies",
      ]),
      view("data-security", "Data Security", "planned", securityEvents, [
        "Sensitive data",
        "Exfiltration signal",
      ]),
      view("vulnerabilities", "Vulnerabilities", "planned", securityEvents, [
        "Vulnerability",
        "Evidence",
      ]),
      view("attack-surface", "Attack Surface", "planned", securityEvents, ["Exposure", "Change"]),
      view("policies", "Policies", "planned", policyDecisions, ["Security policy", "Simulation"]),
      view("detections", "Detections", "planned", securityEvents, ["Detection rule", "Signal"]),
      view("investigations", "Investigations", "planned", securityEvents, [
        "Evidence timeline",
        "Notes",
      ]),
      view("response", "Response", "planned", approvals, [
        "Containment preview",
        "Human approval",
        "Reversible containment",
      ]),
      view("recovery", "Recovery", "planned", approvals, ["Recovery plan", "Validation"]),
      view("audit", "Audit", "planned", auditEvents, ["Security audit events", "Export"]),
      view("input-analysis", "Malicious Input Analysis", "planned", jobs, [
        "File analysis",
        "Credential exposure detection",
      ]),

      view("supply-chain", "Software Supply Chain Security", "preview", securityEvents, [
        "Repositories and packages",
        "Dependency inventory",
        "Build provenance",
        "Artifact integrity",
        "Risk findings",
        { label: "Evidence chain", dependency: evidence },
        { label: "Response approval", dependency: approvals },
      ]),
      view("automation", "Security Automation", "preview", approvals, [
        "Playbooks",
        "Triggers",
        "Conditions",
        "Dry run",
        "Approval gates",
        "Execution state",
        { label: "Security signals", dependency: securityEvents },
        { label: "Audit events", dependency: auditEvents },
      ]),
      view("evidence-compliance", "Security Evidence & Compliance", "preview", auditEvents, [
        "Control mapping",
        "Evidence collection",
        "Source provenance",
        "Exceptions",
        "Review state",
        "Export package",
        { label: "Policy decisions", dependency: policyDecisions },
      ]),
      view("lab", "Security Lab / Sandbox", "preview", jobs, [
        "Isolated session",
        "Test assets",
        "Network boundary",
        "Scenario runner",
        { label: "Security event capture", dependency: securityEvents },
        { label: "Approval boundary", dependency: approvals },
        "Artifacts and replay",
      ]),
    ],
  }),
  product({
    id: "billing",
    title: "Billing",
    description: "Usage, spend and entitlement controls grounded in confirmed ledger events.",
    state: "planned",
    tone: "commerce",
    layout: "billing",
    requiresAuth: true,
    subpages: [
      view("plan", "Plan", "planned", payments, ["Current plan", "Change preview"]),
      view("usage", "Usage", "planned", telemetry, ["Usage ledger", "Data freshness"]),
      view("credits", "Credits", "planned", payments, ["Credit balance", "Ledger"]),
      view("subscriptions", "Subscriptions", "planned", payments, [
        "Subscription state",
        "Cancel policy",
      ]),
      view("invoices", "Invoices", "planned", payments, ["Invoices", "Payment status"]),
      view("methods", "Payment Methods", "planned", payments, [
        "Payment method reference",
        "Update",
      ]),
      view("entitlements", "Entitlements", "planned", entitlements, [
        "Entitlements",
        "Source event",
      ]),
      view("team-spend", "Team Spend", "planned", payments, ["Team allocation", "Owner"]),
      view("budgets", "Budgets", "planned", approvals, ["Budget", "Policy"]),
      view("alerts", "Alerts", "planned", telemetry, ["Threshold", "Notification"]),

      view("disputes", "Refunds & Disputes", "preview", payments, [
        "Case intake",
        "Order and invoice evidence",
        "Refund eligibility",
        { label: "Approval", dependency: approvals },
        "Resolution state",
        { label: "Audit trail", dependency: auditEvents },
      ]),
    ],
  }),
  product({
    id: "support",
    title: "Support",
    description: "Help, troubleshooting and recovery with clear escalation paths.",
    state: "beta",
    tone: "learning",
    layout: "support",
    requiresAuth: false,
    subpages: [
      view("help", "Help Center", "preview", ui, ["Topic search", "Guided help"]),
      view("docs", "Documentation", "planned", ui, ["Product documentation", "Version"]),
      view("status", "Status", "planned", telemetry, ["Service status", "Incident history"]),
      view("contact", "Contact", "beta", privateData, ["Contact form", "Submission state"]),
      view("tickets", "Tickets", "planned", privateData, ["Ticket", "Replies", "Status"]),
      view("troubleshooting", "Troubleshooting", "preview", ui, ["Diagnostic steps", "Recovery"]),
      view("recovery", "Account Recovery", "beta", auth, ["Password recovery", "Session reset"]),
    ],
  }),
  product({
    id: "settings",
    title: "Settings",
    description: "Personal, security and organization controls with explicit ownership boundaries.",
    state: "beta",
    tone: "project",
    layout: "settings",
    requiresAuth: true,
    subpages: [
      view("profile", "Profile", "live", privateData, ["Profile fields", "Avatar"]),
      view("account", "Account", "beta", auth, ["Email", "Account actions"]),
      view("preferences", "Preferences", "preview", privateData, [
        "Product preferences",
        "Defaults",
      ]),
      view("appearance", "Appearance", "preview", ui, ["Theme", "Density"]),
      view("language", "Language", "live", ui, ["Locale", "Direction"]),
      view("accessibility", "Accessibility", "planned", privateData, [
        "Motion",
        "Contrast",
        "Input preferences",
      ]),
      view("memory", "Memory", "planned", privateData, ["Memory state", "Clear and export"]),
      view("context", "Personal Context Center", "preview", privateData, [
        "Personal memory",
        "Project memory",
        "Brands",
        "Writing style",
        "People",
        "Exclusions",
        { label: "Edit and delete", dependency: approvals },
        { label: "Export", dependency: storage },
        { label: "Consent state", dependency: approvals },
      ]),
      view("privacy", "Privacy", "preview", approvals, ["Data controls", "Retention"]),
      view("security", "Security", "planned", auth, ["Security events", "Recovery"]),
      view("sessions", "Sessions", "planned", auth, ["Device sessions", "Revoke"]),
      view("notifications", "Notifications", "beta", privateData, [
        "Notification preferences",
        "Channels",
      ]),
      view("apps", "Connected Apps", "planned", credentials, ["Connected apps", "Revoke"]),
      view("api", "API", "planned", approvals, ["API access", "Key lifecycle"]),
      view("billing", "Billing", "planned", payments, ["Plan", "Invoices"]),
      view("organization", "Organization", "planned", collaboration, ["Organization", "Roles"]),
    ],
  }),
] as const;

export const PRODUCT_ENVIRONMENT_MAP = new Map(
  PRODUCT_ENVIRONMENTS.map((environment) => [environment.id, environment]),
);

export function getProductEnvironment(id: string): ProductEnvironment | undefined {
  return PRODUCT_ENVIRONMENT_MAP.get(id as ProductEnvironmentId);
}

export function getProductSubpage(
  environment: ProductEnvironment,
  key: string,
): ProductSubpage | undefined {
  return environment.subpages.find((subpage) => subpage.key === key);
}

export function productEntryRoute(environment: ProductEnvironment): string {
  return environment.subpages[0]?.route ?? `/os/${environment.id}/home`;
}
