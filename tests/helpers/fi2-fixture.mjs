import assert from "node:assert/strict";
import { MemoryService, sameScope } from "../../src/lib/memory/service.ts";
import { ProjectBrainService } from "../../src/lib/project-brain/service.ts";
import { ProjectsService } from "../../src/lib/projects/service.ts";
import { ModelGateway } from "../../src/lib/model-gateway/gateway.ts";
import { AgentRegistry } from "../../src/lib/agents/registry.ts";
import { DEFAULT_AGENTS } from "../../src/lib/agents/runtimes.ts";
import { canonicalSkills, createCanonicalTools } from "../../src/lib/agents/tools.ts";
import { TaskOrchestrator } from "../../src/lib/agents/orchestrator.ts";
import { InMemoryApprovalStore } from "../../src/lib/agents/approval.ts";
import { GlobalSearchService } from "../../src/lib/global-search/service.ts";
import { nativeSources } from "../../src/lib/global-search/sources.ts";
export const actor = "10000000-0000-4000-8000-000000000001";
export const other = "10000000-0000-4000-8000-000000000002";
const clone = (x) => structuredClone(x);
// Deterministic adapter only. Production uses the existing Supabase tables/RPCs.
export function store() {
  return { projects:new Map(), brains:new Map(), members:new Map(), memories:new Map(), settings:new Map(), conversations:new Map(), messages:[], listCalls:0, memoryWrites:0, tick:0 };
}
export function session(db=store(), userId=actor) {
  const now=()=>new Date(Date.UTC(2026,8,15,0,0,++db.tick)).toISOString();
  const role=(id)=>db.members.get(`${userId}:${id}`);
  function authorize(id,write=false) {if(!(write?["owner","editor"]:["owner","editor","viewer"]).includes(role(id)))throw new Error("PROJECT_ACCESS_DENIED");}
  function conversation(id,cid) {authorize(id);const c=db.conversations.get(cid);return c?.projectId===id&&c.userId===userId;}
  function scopeAllowed(scope) {if(scope.kind!=="user")authorize(scope.projectId);if(scope.kind==="conversation"&&!conversation(scope.projectId,scope.conversationId))throw new Error("CONVERSATION_ACCESS_DENIED");}
  const adapter={userId,
    settings:async()=>clone(db.settings.get(userId)??{enabled:false,disabledTypes:[]}),
    setSettings:async(value)=>{db.settings.set(userId,clone(value));return clone(value);},
    get:async(id)=>{const r=db.memories.get(id);if(!r||r.userId!==userId)return null;scopeAllowed(r.scope);return clone(r);},
    list:async(q)=>{db.listCalls++;scopeAllowed(q.scope);return [...db.memories.values()].filter(r=>r.userId===userId&&sameScope(q.scope,r.scope)).map(clone);},
    create:async(d)=>{scopeAllowed(d.scope);db.memoryWrites++;const r={...clone(d),id:crypto.randomUUID(),userId,status:"active",createdAt:now(),updatedAt:now()};db.memories.set(r.id,r);return clone(r);},
    update:async(id,patch)=>{const r=await adapter.get(id);if(!r)return null;Object.assign(r,clone(patch),{updatedAt:now()});db.memories.set(id,r);return clone(r);},
    delete:async(id)=>{if(await adapter.get(id))db.memories.delete(id);},
  };
  const memory=new MemoryService(adapter);
  const activity=async(id)=>{authorize(id);return [...db.conversations.values()].filter(c=>c.projectId===id&&c.userId===userId).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(c=>({id:c.id,projectId:c.projectId,title:c.title,state:c.state,updatedAt:c.updatedAt}));};
  const domain={userId,
    getAuthorizedProject:async(id)=>{authorize(id);return clone(db.projects.get(id));},
    readBrain:async(id)=>{authorize(id);return clone(db.brains.get(id)??[]);},
    writeBrain:async(id,next,expected)=>{authorize(id,true);assert.deepEqual(db.brains.get(id)??[],expected);db.brains.set(id,clone(next));db.projects.get(id).updatedAt=now();},
    authorizeConversation:async(id,cid)=>conversation(id,cid),recentConversations:activity,
    recentMessages:async(id,cid)=>{if(!conversation(id,cid))throw new Error("CONVERSATION_ACCESS_DENIED");return clone(db.messages.filter(m=>m.conversationId===cid).slice(-4));},
  };
  const brain=new ProjectBrainService(memory,domain);
  const persistence={userId,authorize:async(id,w)=>authorize(id,w),
    list:async()=>clone([...db.projects.values()].filter(p=>role(p.id)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))),
    create:async({name})=>{const p={id:crypto.randomUUID(),name,description:null,status:"active",defaultRoutingMode:"auto",defaultModel:null,createdAt:now(),updatedAt:now()};db.projects.set(p.id,p);db.members.set(`${userId}:${p.id}`,"owner");return clone(p);},
    load:async(id)=>{authorize(id);return {project:clone(db.projects.get(id)),assets:[],messages:clone(db.messages.filter(m=>m.projectId===id&&conversation(id,m.conversationId)))};},
    rename:async(id,name)=>{authorize(id,true);Object.assign(db.projects.get(id),{name,updatedAt:now()});},activity,
    begin:async(input)=>{authorize(input.projectId,true);if(input.conversationId&&!conversation(input.projectId,input.conversationId))throw new Error("CONVERSATION_ACCESS_DENIED");const prior=[...db.conversations.values()].find(c=>c.userId===userId&&c.key===input.idempotencyKey);if(prior){if(prior.hash!==input.requestHash||prior.projectId!==input.projectId)throw new Error("IDEMPOTENCY_CONFLICT");return {created:false,conversationId:prior.id,response:clone(prior.response)};}const c={id:input.executionId,userId,projectId:input.projectId,previousConversationId:input.conversationId,key:input.idempotencyKey,hash:input.requestHash,title:input.goal.slice(0,200),state:"RUNNING",updatedAt:now()};db.conversations.set(c.id,c);db.messages.push({id:crypto.randomUUID(),projectId:c.projectId,conversationId:c.id,role:"user",content:input.goal,createdAt:now()});return {created:true,conversationId:c.id};},
    finish:async(cid,response)=>{const c=db.conversations.get(cid);if(!c||!conversation(c.projectId,cid))throw new Error("CONVERSATION_ACCESS_DENIED");authorize(c.projectId,true);if(c.response)return;c.response=clone(response);c.state=response.data.state;c.updatedAt=now();db.projects.get(c.projectId).updatedAt=now();if(response.ok)db.messages.push({id:crypto.randomUUID(),projectId:c.projectId,conversationId:cid,role:"assistant",content:response.data.output,createdAt:now()});},
  };
  const projects=new ProjectsService(persistence,brain,memory);
  return {db,userId,projects,memory,brain,domain,persistence,now};
}
export function execution(s,request,options={}) {
  const prompts=[],tasks=[];
  const model={identity:{providerId:"deterministic",modelId:"text"},capabilities:["text"],quality:1,estimatedLatencyMs:1,estimatedCostPer1kTokensUsd:0};
  const gateway=new ModelGateway([{provider:{id:"deterministic",displayName:"Deterministic test adapter"},getHealth:async()=>({availability:"AVAILABLE",checkedAt:s.now()}),discoverModels:async()=>[model],execute:async(r)=>{prompts.push(r.input);await options.wait?.();return {ok:true,output:{kind:"text",text:options.output??"Persisted research result"}};}}]);
  const access={userId:s.userId,canReadProject:async(id)=>{try{await s.projects.authorize(id);return true;}catch{return false;}}};
  const reads={rows:async(type,pid)=>{
    if(type==="project")return (await s.persistence.list()).filter(p=>!pid||p.id===pid).map(p=>({...p,created_at:p.createdAt,updated_at:p.updatedAt}));
    if(type==="conversation")return (await s.persistence.activity(pid)).map(c=>({...c,project_id:c.projectId,created_at:c.updatedAt,updated_at:c.updatedAt}));
    return [];
  }};
  const sources=nativeSources(reads,s.memory,s.brain,access,{projectId:request.projectId,conversationId:request.conversationId});
  const search=new GlobalSearchService(sources,access);
  const registry=new AgentRegistry();
  for(const t of createCanonicalTools({brain:s.brain,search,gateway}))registry.registerTool(t);
  for(const k of canonicalSkills())registry.registerSkill(k);
  const tools=registry.listTools().filter(t=>t.enabled), allowed=new Set(tools.map(t=>t.id));
  const inventory={agents:DEFAULT_AGENTS.map(a=>a.definition),tools,skills:registry.listSkills().filter(s=>s.toolIds.every(id=>allowed.has(id))),allowedToolIds:allowed,budget:{allowUnknown:true},providers:options.noProvider?[]:[{model:model.identity,capabilities:["text"],enabled:true,health:"healthy",latencyMs:1,successRate:1,quality:1,cost:{model:model.identity,currency:"USD",effectiveAt:s.now()}}]};
  const orchestrator=new TaskOrchestrator({registry,brain:s.brain,gateway,approvals:new InMemoryApprovalStore(),now:s.now});
  return {prompts,tasks,search,deps:{projects:s.projects,registry,inventory,now:s.now,executeTask:async(task,signal)=>{tasks.push(task);return orchestrator.execute(task,{signal});}}};
}
export const request=(projectId,extra={})=>({projectId,goal:"Research launch options",idempotencyKey:crypto.randomUUID(),...extra});
export const memoryDraft=(scope,content,type=scope.kind==="conversation"?"ConversationMemory":"ProjectMemory")=>({scope,content,type,importance:1,source:{kind:"user"}});
