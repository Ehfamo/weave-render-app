import type { GlobalSearchService } from "../global-search/service.ts";
import type { ModelGateway } from "../model-gateway/gateway.ts";
import type { ProjectBrainService } from "../project-brain/service.ts";
import type { SkillDefinition, ToolDefinition } from "./contracts.ts";
import { validateBrowserAction } from "./browser-safety.ts";

const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export interface BrowserPort {
  execute(input: Record<string, unknown>, signal?: AbortSignal): Promise<unknown>;
}
export interface ValidationPort {
  readonly allowedCommandIds: readonly string[];
  execute(commandId: string, signal?: AbortSignal): Promise<unknown>;
}
export function createCanonicalTools(deps: {
  search: GlobalSearchService;
  brain: ProjectBrainService;
  gateway: ModelGateway;
  browser?: BrowserPort;
  allowedOrigins?: readonly string[];
  codeReader?: (query: string) => Promise<unknown>;
  validation?: ValidationPort;
}): ToolDefinition[] {
  return [
    {
      id: "workspace.search",
      description: "Authorized bounded XEOMX workspace search",
      capability: "workspace.search",
      risk: "SAFE_READ",
      enabled: true,
      validate: (v) =>
        record(v) &&
        typeof v.query === "string" &&
        v.query.length <= 300 &&
        typeof v.projectId === "string",
      execute: async (v) => {
        const x = v as Record<string, string>;
        return (await deps.search.search({
          text: x.query,
          filters: { projectId: x.projectId },
          limit: 20,
        })) as never;
      },
    },
    {
      id: "project.context",
      description: "Authorized Project Brain snapshot",
      capability: "project.context",
      risk: "SAFE_READ",
      enabled: true,
      validate: (v) => record(v) && typeof v.projectId === "string",
      execute: async (v) =>
        (await deps.brain.snapshot((v as Record<string, string>).projectId)) as never,
    },
    {
      id: "model.reason",
      description: "Provider-neutral model reasoning via Model Gateway",
      capability: "model.reason",
      risk: "SAFE_READ",
      enabled: true,
      validate: (v) =>
        record(v) &&
        typeof v.prompt === "string" &&
        v.prompt.length <= 100_000 &&
        typeof v.task === "string",
      execute: async (v, signal) => {
        const x = v as Record<string, string>;
        const r = await deps.gateway.execute(
          {
            requestId: crypto.randomUUID(),
            task: x.task,
            input: x.prompt,
            mode: "BALANCED",
            capability: "text",
            maxOutputTokens: 4096,
          },
          signal,
        );
        if (!r.ok) throw new Error(r.error.code);
        return r.output.kind === "text" ? r.output.text : (r.output as never);
      },
    },
    {
      id: "code.read",
      description: "Restricted project code context reader",
      capability: "code.read",
      risk: "SAFE_READ",
      enabled: !!deps.codeReader,
      validate: (v) => record(v) && typeof v.query === "string" && v.query.length <= 500,
      execute: async (v) => (await deps.codeReader!((v as Record<string, string>).query)) as never,
    },
    {
      id: "code.validate",
      description: "Fixed allowlisted project validation command",
      capability: "code.validate",
      risk: "LOW_RISK_WRITE",
      enabled: !!deps.validation,
      validate: (v) =>
        record(v) &&
        typeof v.commandId === "string" &&
        !!deps.validation?.allowedCommandIds.includes(v.commandId),
      execute: async (v, signal) =>
        (await deps.validation!.execute((v as Record<string, string>).commandId, signal)) as never,
    },
    {
      id: "browser.action",
      description: "Origin-scoped read-only browser adapter",
      capability: "browser.inspect",
      risk: "SAFE_READ",
      enabled: !!deps.browser,
      validate: (v) =>
        validateBrowserAction(v, deps.allowedOrigins ?? []) &&
        record(v) &&
        ["navigate", "inspect", "extract", "wait", "screenshot"].includes(String(v.action)),
      execute: async (v, signal) =>
        (await deps.browser!.execute(v as Record<string, unknown>, signal)) as never,
    },
    {
      id: "browser.interact",
      description: "Approval-gated origin-scoped browser interaction",
      capability: "browser.interact",
      risk: "EXTERNAL_ACTION",
      enabled: !!deps.browser,
      validate: (v) =>
        validateBrowserAction(v, deps.allowedOrigins ?? []) &&
        record(v) &&
        ["click", "type", "submit"].includes(String(v.action)),
      execute: async (v, signal) =>
        (await deps.browser!.execute(v as Record<string, unknown>, signal)) as never,
    },
  ];
}

export function canonicalSkills(): SkillDefinition[] {
  return [
    {
      id: "research.workspace",
      description: "Research authorized project context",
      capabilities: ["workspace.search", "project.context", "memory.read", "model.reason"],
      toolIds: ["workspace.search", "project.context", "model.reason"],
      enabled: true,
    },
    {
      id: "coding.controlled",
      description: "Read, propose and validate code through restricted ports",
      capabilities: ["code.read", "code.propose", "code.validate", "model.reason"],
      toolIds: ["code.read", "model.reason", "code.validate"],
      enabled: true,
    },
    {
      id: "browser.bounded",
      description: "Inspect and interact through an origin-scoped browser port",
      capabilities: ["browser.navigate", "browser.inspect", "browser.interact"],
      toolIds: ["browser.action", "browser.interact"],
      enabled: true,
    },
  ];
}
