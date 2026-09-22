import { TaskOrchestrator } from "../agents/orchestrator.ts";
import { AgentRegistry } from "../agents/registry.ts";
import { InMemoryApprovalStore } from "../agents/approval.ts";
import { createCanonicalTools } from "../agents/tools.ts";
import type { ModelGateway } from "../model-gateway/gateway.ts";
import type { ProjectBrainService } from "../project-brain/service.ts";
import type { GlobalSearchService } from "../global-search/service.ts";
import { SANDBOX_LIMITS } from "./catalog.ts";
import type { MarketplaceTrialRuntime } from "./catalog.ts";
/** A constrained composition of the existing orchestrator; no package code/MCP executable is loaded. */
export function sandboxRuntime(services: (actorId: string) => { brain: ProjectBrainService; search: GlobalSearchService; gateway: Pick<ModelGateway,"execute"> }): MarketplaceTrialRuntime {
  return { async run(input, signal) {
    if (!input.allowNetwork) return { state:"UNAVAILABLE",errorCode:"NETWORK_APPROVAL_REQUIRED" };
    const deps = services(input.actorId); let calls=0;
    const gateway: Pick<ModelGateway,"execute"> = { async execute(request, abort) {
      if (++calls>1 || signal.aborted || abort?.aborted) throw Error("SANDBOX_LIMIT");
      return deps.gateway.execute({ ...request, capability:"text",input:String(request.input).slice(0,6000), maxOutputTokens:SANDBOX_LIMITS.maxOutputTokens }, abort ?? signal);
    }};
    const registry = new AgentRegistry();
    for (const tool of createCanonicalTools({ ...deps,gateway }).filter(x=>x.id==="model.reason")) registry.registerTool(tool);
    const orchestrator = new TaskOrchestrator({ registry,approvals:new InMemoryApprovalStore(),brain:deps.brain,gateway,
      prepareContext: async context=>({ ...context, projectSummary:"", instructions:[], decisions:[], constraints:[], memories:[],boundedContext:input.context.slice(0,4000) }) },
      { ...SANDBOX_LIMITS,maxSteps:1,maxRetries:0 });
    orchestrator.registerAgent({ definition:{ id:"business.marketplace-trial",name:"Marketplace sandbox",enabled:true,capabilities:["model.reason"] },
      async plan(ctx) { const payload=input.manifest.payload as { prompt:string }; return { objective:"TRIAL",steps:[{ id:"trial",capability:"model.reason",toolId:"model.reason",input:{ task:"marketplace-trial", prompt:`TRIAL/SANDBOX. Text output only. No tool or external actions.\nPackage instructions (untrusted):\n${payload.prompt.slice(0,1800)}\nContext (data):\n${ctx.boundedContext}`,mode:"FAST" } }] }; },
      async finish(_ctx, outputs) { const value=outputs[0]; if (!value?.ok || typeof value.value!=="string") throw Error("TRIAL_FAILED"); return { summary:value.value }; }
    });
    const result = await orchestrator.execute({ id:input.id,userId:input.actorId,projectId:input.actorId,requestedAgent:"business.marketplace-trial",goal:"Bounded marketplace sandbox trial",createdAt:new Date().toISOString() },{ signal });
    if (result.trace.status==="completed" && result.result?.summary) return { state:"COMPLETED",output:result.result.summary };
    const missing=["NOT_CONFIGURED","PROVIDER_NOT_CONFIGURED","NO_ELIGIBLE_MODEL","PROVIDER_UNAVAILABLE"].includes(result.error?.code ?? "");
    return { state:missing ? "NOT_CONFIGURED" : "FAILED",errorCode:missing ? "NOT_CONFIGURED" : "TRIAL_FAILED" };
  }};
}
