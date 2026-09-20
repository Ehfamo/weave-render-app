import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { session, store, execution, request, memoryDraft, actor, other } from "./helpers/fi2-fixture.mjs";
import { runCoreExecution, validateCoreExecutionRequest } from "../src/lib/core-execution/service.ts";
import { projectTarget } from "../src/lib/projects/service.ts";
import { sanitizeNext } from "../src/lib/auth-navigation.ts";
import { consumePendingGoal, createPendingGoal, savePendingGoal, PENDING_GOAL_KEY } from "../src/lib/core-execution/handoff.ts";
import { createEmptyProjectContext, bindAuthorizedProject } from "../src/lib/project-context.ts";
const read=(p)=>readFile(new URL(`../${p}`,import.meta.url),"utf8");
const setup=async()=>{const s=session();const {project}=await s.projects.create({name:"Launch",goal:"Durable campaign goal"});return {...s,projectId:project.id};};
const run=async(s,input,options)=>{const runtime=execution(s,input,options);return {response:await runCoreExecution(s.userId,input,runtime.deps),...runtime};};

test("FI2 real stable IDs, empty/list/create/open and refresh use the persisted project source",async()=>{
  const s=session();assert.deepEqual(await s.projects.home(),{projects:[],continuations:[]});
  const created=await s.projects.create({name:"Campaign",goal:"Launch tomorrow"});assert.equal(created.goalSaved,true);
  const id=created.project.id;assert.match(id,/^[a-f0-9-]{36}$/);
  const later=session(s.db);const home=await later.projects.home();assert.equal(home.projects.length,1);
  assert.equal(home.projects[0].id,id);assert.equal(home.projects[0].goal,"Launch tomorrow");assert.equal(home.projects[0].target,`/projects/${id}`);
  assert.equal((await later.projects.open(id)).project.name,"Campaign");assert.equal(home.projects[0].updatedAt,s.db.projects.get(id).updatedAt);
  await later.projects.edit(id,{name:"Renamed",goal:"Explicitly revised"});assert.equal((await s.projects.open(id)).brain.goal.text,"Explicitly revised");
});
test("FI2 unauthorized project fails before metadata, activity, Brain or Memory is read",async()=>{
  const s=await setup(), b=session(s.db,other);let reads=0;
  b.persistence.load=async()=>{reads++;throw new Error("private metadata");};b.domain.readBrain=async()=>{reads++;return [];};
  assert.deepEqual(await b.projects.home(),{projects:[],continuations:[]});
  for(const action of [()=>b.projects.open(s.projectId),()=>b.projects.edit(s.projectId,{name:"bad"}),()=>b.projects.context(s.projectId),()=>b.projects.memoryControl({action:"list",scope:{kind:"project",projectId:s.projectId}})])await assert.rejects(action,/ACCESS_DENIED/);
  const r=await run(b,request(s.projectId));assert.equal(r.response.ok,false);assert.equal(r.prompts.length,0);assert.equal(reads,0);
});
test("FI2 authorized viewers can inspect projects but cannot edit or execute",async()=>{
  const s=await setup();s.db.members.set(`${other}:${s.projectId}`,"viewer");const viewer=session(s.db,other);
  assert.equal((await viewer.projects.open(s.projectId)).brain.goal.text,"Durable campaign goal");
  await assert.rejects(viewer.projects.edit(s.projectId,{goal:"bad"}),/ACCESS_DENIED/);
  const r=await run(viewer,request(s.projectId));assert.equal(r.response.ok,false);assert.equal(r.prompts.length,0);
});
test("FI2 active project binding is actor-bound view state; empty context has no fake global project",()=>{
  assert.equal(createEmptyProjectContext().projectId,null);
  const authorized={project:{id:crypto.randomUUID()}};
  assert.equal(bindAuthorizedProject(authorized,actor,actor).projectId,authorized.project.id);
  assert.equal(bindAuthorizedProject(authorized,actor,other).projectId,null);
  assert.equal(bindAuthorizedProject(authorized,actor,null).projectId,null);
  assert.throws(()=>bindAuthorizedProject({project:{id:"global"}},actor,actor));
});
test("FI2 Project Brain changes materially reach P9 and real Orchestrator/Model Gateway execution",async()=>{
  const s=await setup();await s.brain.setInstruction(s.projectId,"tone","Use a calm voice");await s.brain.recordDecision(s.projectId,"d","Use blue");await s.brain.trackOpenItem(s.projectId,"open","Review final caption");
  const first=await run(s,request(s.projectId));assert.equal(first.response.ok,true);assert.equal(first.tasks[0].projectId,s.projectId);
  assert.match(first.prompts[0],/Durable campaign goal/);assert.match(first.prompts[0],/Use a calm voice/);assert.match(first.prompts[0],/Use blue/);assert.match(first.prompts[0],/Review final caption/);
  assert.ok(first.response.data.trace.contextReferenceIds.includes(`brain-${s.projectId}`));
  await s.brain.setInstruction(s.projectId,"tone","Use a formal voice");const second=await run(s,request(s.projectId));
  assert.match(second.prompts[0],/Use a formal voice/);assert.doesNotMatch(second.prompts[0],/Use a calm voice/);
  assert.equal((await s.brain.get(s.projectId)).entries.filter(e=>e.kind==="goal").length,1);
  assert.equal((await s.brain.snapshot(s.projectId)).goal.text,"Durable campaign goal");
});
test("FI2 Memory OFF keeps goal, structured Brain, execution and durable activity available",async()=>{
  const s=await setup(),scope={kind:"project",projectId:s.projectId};
  await s.memory.setSettings({enabled:true,disabledTypes:[]});await s.memory.create(memoryDraft(scope,"Optional private memory"));
  await s.projects.memoryControl({action:"settings",scope,settings:{enabled:false,disabledTypes:["ProjectMemory"]}});
  const before=s.db.memoryWrites;s.db.listCalls=0;
  await s.brain.setInstruction(s.projectId,"i","Keep the brand voice");
  const r=await run(s,request(s.projectId));assert.equal(r.response.ok,true);assert.equal(s.db.listCalls,0);assert.equal(s.db.memoryWrites,before);
  assert.match(r.prompts[0],/Durable campaign goal/);assert.match(r.prompts[0],/Keep the brand voice/);assert.doesNotMatch(r.prompts[0],/Optional private memory/);
  assert.equal((await s.projects.home()).continuations.length,1);
  await assert.rejects(s.memory.create(memoryDraft(scope,"No automatic write")),/MEMORY_DISABLED/);
  assert.equal((await s.projects.memoryControl({action:"list",scope})).memories.length,1);
});
test("FI2 authorized relevant memories affect execution without user/project scope promotion",async()=>{
  const s=await setup(),second=await s.projects.create({name:"Other project",goal:"Other durable goal"});
  await s.memory.setSettings({enabled:true,disabledTypes:[]});
  await s.memory.create(memoryDraft({kind:"project",projectId:s.projectId},"Launch private project A"));
  await s.memory.create(memoryDraft({kind:"project",projectId:second.project.id},"Launch private project B"));
  await s.memory.create(memoryDraft({kind:"user"},"Launch private user preference","UserMemory"));
  const a=await run(s,request(s.projectId));assert.match(a.prompts[0],/Launch private project A/);assert.doesNotMatch(a.prompts[0],/Launch private project B|Launch private user preference/);
  const b=await run(s,request(second.project.id));assert.match(b.prompts[0],/Launch private project B/);assert.doesNotMatch(b.prompts[0],/Launch private project A|Launch private user preference/);
});
test("FI2 Memory edit/archive/delete/type controls invoke real service behavior on subsequent executions",async()=>{
  const s=await setup(),scope={kind:"project",projectId:s.projectId};await s.memory.setSettings({enabled:true,disabledTypes:[]});
  const r=await s.memory.create(memoryDraft(scope,"Original durable note"));
  await s.projects.memoryControl({action:"edit",scope,id:r.id,patch:{content:"Edited durable note",importance:0.9}});
  assert.match((await run(s,request(s.projectId))).prompts[0],/Edited durable note/);
  await s.projects.memoryControl({action:"archive",scope,id:r.id});assert.equal((await s.memory.get(r.id)).status,"archived");
  assert.doesNotMatch((await run(s,request(s.projectId))).prompts[0],/Edited durable note/);
  const fresh=await s.memory.create(memoryDraft(scope,"Delete this note"));await s.projects.memoryControl({action:"delete",scope,id:fresh.id});assert.equal(await s.memory.get(fresh.id),null);
  assert.doesNotMatch((await run(s,request(s.projectId))).prompts[0],/Delete this note/);
  await s.memory.create(memoryDraft(scope,"Disabled category note"));await s.projects.memoryControl({action:"settings",scope,settings:{enabled:true,disabledTypes:["ProjectMemory"]}});
  assert.doesNotMatch((await run(s,request(s.projectId))).prompts[0],/Disabled category note/);
  await assert.rejects(s.memory.create(memoryDraft(scope,"Blocked type write")),/MEMORY_DISABLED/);
  assert.equal((await s.projects.open(s.projectId)).brain.goal.text,"Durable campaign goal");
});
test("FI2 cross-user and mismatched-scope memory controls fail closed",async()=>{
  const s=await setup(),scope={kind:"project",projectId:s.projectId};await s.memory.setSettings({enabled:true,disabledTypes:[]});
  const r=await s.memory.create(memoryDraft(scope,"Owner only"));s.db.members.set(`${other}:${s.projectId}`,"editor");const b=session(s.db,other);
  assert.equal((await b.projects.memoryControl({action:"list",scope})).memories.length,0);
  for(const action of ["edit","archive","delete"])await assert.rejects(b.projects.memoryControl({action,scope,id:r.id,patch:{content:"hijacked"}}),/MEMORY_ACCESS_DENIED/);
  await assert.rejects(s.projects.memoryControl({action:"delete",scope:{kind:"user"},id:r.id}),/MEMORY_ACCESS_DENIED/);
  assert.equal((await s.memory.get(r.id)).content,"Owner only");
});
test("FI2 conversation memories and prior messages never enter another conversation's execution or search",async()=>{
  const s=await setup();await s.memory.setSettings({enabled:true,disabledTypes:[]});
  const a=await run(s,request(s.projectId),{output:"PRIVATE_RESULT_A"}),b=await run(s,request(s.projectId),{output:"PRIVATE_RESULT_B"});
  const ca=a.response.data.conversationId,cb=b.response.data.conversationId;
  await s.memory.create(memoryDraft({kind:"conversation",projectId:s.projectId,conversationId:ca},"Launch CONVERSATION_A_ONLY"));
  await s.memory.create(memoryDraft({kind:"conversation",projectId:s.projectId,conversationId:cb},"Launch CONVERSATION_B_ONLY"));
  const input=request(s.projectId,{conversationId:ca});const r=await run(s,input);assert.equal(r.response.ok,true);
  assert.match(r.prompts[0],/CONVERSATION_A_ONLY/);assert.match(r.prompts[0],/PRIVATE_RESULT_A/);assert.doesNotMatch(r.prompts[0],/CONVERSATION_B_ONLY|PRIVATE_RESULT_B/);
  const matches=await r.search.search({text:"Launch",filters:{projectId:s.projectId}});assert.doesNotMatch(JSON.stringify(matches),/CONVERSATION_B_ONLY/);
  const project2=await s.projects.create({name:"Second"});const denied=await run(s,request(project2.project.id,{conversationId:ca}));assert.equal(denied.response.ok,false);assert.equal(denied.prompts.length,0);
  s.db.members.set(`${other}:${s.projectId}`,"editor");const otherSession=session(s.db,other);await assert.rejects(otherSession.projects.open(s.projectId,ca),/CONVERSATION_ACCESS_DENIED/);
});
test("FI2 successful execution persists canonical conversation/messages, Continue identity and correction reference across sessions",async()=>{
  const s=await setup(),input=request(s.projectId),r=await run(s,input);assert.equal(r.response.ok,true);
  const cid=r.response.data.conversationId,after=session(s.db);const home=await after.projects.home();
  assert.equal(home.continuations[0].id,cid);assert.equal(home.continuations[0].projectId,s.projectId);assert.equal(home.continuations[0].target,projectTarget(s.projectId));
  const opened=await after.projects.open(s.projectId,cid);assert.equal(opened.messages.filter(m=>m.role==="assistant")[0].content,r.response.data.output);
  const bounded=await after.projects.context(s.projectId,cid);assert.equal(bounded.referenceResultId,opened.messages.find(m=>m.role==="assistant").id);
  const correction=await run(after,request(s.projectId,{conversationId:cid,goal:"Keep everything else; change only the third heading"}));assert.equal(correction.response.ok,true);assert.equal(correction.tasks[0].conversationId,cid);assert.match(correction.prompts[0],/Persisted research result/);
  assert.equal((await after.projects.home()).continuations[0].id,correction.response.data.conversationId);
  assert.equal((await after.projects.open(s.projectId)).brain.goal.text,"Durable campaign goal");
});
test("FI2 bounded context preserves valid JSON and never claims an excluded result reference",async()=>{
  const s=await setup();await s.brain.setGoal(s.projectId,"x".repeat(1500));for(let i=0;i<3;i++)await s.brain.setInstruction(s.projectId,`i${i}`,"x".repeat(1450));
  const r=await run(s,request(s.projectId),{output:"y".repeat(18000)}),cid=r.response.data.conversationId;
  const small=await s.brain.buildContext(s.projectId,{conversationId:cid,maxCharacters:128});assert.ok(small.text.length<=128);JSON.parse(small.text);assert.equal(small.truncated,true);assert.equal(small.referenceResultId,undefined);
  const full=await s.projects.context(s.projectId,cid);assert.ok(full.text.length<=12000);assert.equal(full.truncated,true);assert.ok(!("snapshot" in full));
});
test("FI2 durable idempotency survives sessions, guards concurrent execution and changed requests",async()=>{
  const s=await setup(),input=request(s.projectId);let release;const gate=new Promise(resolve=>{release=resolve;});
  const runtime=execution(s,input,{wait:()=>gate});const first=runCoreExecution(actor,input,runtime.deps);
  while(!runtime.prompts.length)await new Promise(resolve=>setImmediate(resolve));
  const concurrent=await run(session(s.db),input);assert.equal(concurrent.response.ok,false);assert.equal(concurrent.response.data.errorCode,"EXECUTION_IN_PROGRESS");assert.equal(concurrent.prompts.length,0);
  release();const completed=await first;assert.equal(completed.ok,true);
  const replay=await run(session(s.db),input);assert.deepEqual(replay.response,completed);assert.equal(replay.prompts.length,0);assert.equal(s.db.messages.length,2);
  const conflict=await run(session(s.db),{...input,goal:"Changed request"});assert.equal(conflict.response.ok,false);assert.equal(conflict.prompts.length,0);
});
test("FI2 missing provider and failed persistence never report persisted success",async()=>{
  const s=await setup(),r=await run(s,request(s.projectId),{noProvider:true});assert.equal(r.response.ok,false);assert.equal(r.response.data.state,"NOT_CONFIGURED");assert.equal(s.db.messages.filter(m=>m.role==="assistant").length,0);assert.equal((await s.projects.home()).continuations[0].state,"NOT_CONFIGURED");
  s.persistence.finish=async()=>{throw new Error("private storage failure");};const failed=await run(s,request(s.projectId));assert.equal(failed.response.ok,false);assert.equal(failed.response.data.errorCode,"PROJECT_EXECUTION_UNAVAILABLE");assert.ok(!failed.response.data.output);assert.doesNotMatch(JSON.stringify(failed.response),/private storage failure/);
});
test("FI2 goal setup failure returns the created project without false goal success or duplicate creation",async()=>{
  const s=session();s.domain.writeBrain=async()=>{throw new Error("storage failed");};const r=await s.projects.create({name:"Still created",goal:"Not saved"});assert.equal(r.goalSaved,false);assert.equal(s.db.projects.size,1);assert.equal((await s.projects.open(r.project.id)).brain.goal,null);
});
test("FI2 auth defaults to Home; one-time pending goals survive auth with actor and project boundaries",()=>{
  assert.equal(sanitizeNext(undefined),"/");for(const unsafe of ["//evil.test","https://evil.test","/\\evil","/\n/evil"])assert.equal(sanitizeNext(unsafe),"/");assert.equal(sanitizeNext("/xeomx-ai"),"/xeomx-ai");assert.equal(sanitizeNext("/projects"),"/projects");
  const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  const projectId=crypto.randomUUID(),pending={...createPendingGoal("Private goal",undefined,1000),ownerId:actor,projectId};savePendingGoal(storage,pending);
  assert.equal(consumePendingGoal(storage,2000,actor,{projectId:crypto.randomUUID()}),null);assert.ok(values.has(PENDING_GOAL_KEY));
  assert.deepEqual(consumePendingGoal(storage,2000,actor,{projectId}),pending);assert.equal(consumePendingGoal(storage,2000,actor,{projectId}),null);
  savePendingGoal(storage,pending);assert.equal(consumePendingGoal(storage,2000,other,{projectId}),null);
  const durable={...createPendingGoal("Durable private goal",undefined,1000),createProject:true};savePendingGoal(storage,durable);assert.equal(consumePendingGoal(storage,2000,actor,{projectId:undefined}),null);assert.deepEqual(consumePendingGoal(storage,2000,actor,{createProject:true}),durable);
});
test("FI2 private Brain, memories and output never enter navigation or public safe traces",async()=>{
  const s=await setup();await s.brain.setInstruction(s.projectId,"secret","PRIVATE_PROJECT_TEXT");await s.memory.setSettings({enabled:true,disabledTypes:[]});await s.memory.create(memoryDraft({kind:"project",projectId:s.projectId},"PRIVATE_MEMORY_TEXT"));const r=await run(s,request(s.projectId));assert.equal(r.response.ok,true);
  assert.doesNotMatch(JSON.stringify(r.response.data.trace),/PRIVATE_PROJECT_TEXT|PRIVATE_MEMORY_TEXT|Persisted research result|Research launch options/);assert.equal(projectTarget(s.projectId),`/projects/${s.projectId}`);assert.throws(()=>projectTarget("private text"));
  assert.throws(()=>validateCoreExecutionRequest({goal:"Research",idempotencyKey:crypto.randomUUID(),conversationId:crypto.randomUUID()}),/INVALID_REQUEST/);
});
test("FI2 navigation/controls bind real service routes and all five catalogs preserve source parity",async()=>{
  const [home,header,workspace,controls,auth]=await Promise.all(["src/components/xeomx/os/HomeExperience.tsx","src/components/xeomx/Header.tsx","src/components/xeomx/projects/ProjectWorkspace.tsx","src/components/xeomx/projects/MemoryControls.tsx","src/routes/auth.tsx"].map(read));
  assert.match(header,/\["\/projects", \(\) => m.p8_projects\(\)\]/);assert.match(home,/recent\.data\?\.continuations\.map/);assert.match(home,/conversationId:\s*item.id/);assert.match(workspace,/projectWorkspaceFn/);assert.match(workspace,/bindProject/);assert.match(controls,/memoryControlFn/);for(const action of ["edit","archive","delete","settings"])assert.match(controls,new RegExp(`action:\\s*"${action}"`));assert.doesNotMatch(auth,/\/dashboard/);
  const catalogs=await Promise.all(["en","fa","ar","zh","hi"].map(l=>read(`messages/${l}.json`).then(JSON.parse)));for(const c of catalogs){assert.deepEqual(Object.keys(c).sort(),Object.keys(catalogs[0]).sort());for(const [key,value] of Object.entries(c).filter(([k])=>k.startsWith("fi2_")))assert.ok(value.length,`${key} translated`);}
});
