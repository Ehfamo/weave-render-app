import "@tanstack/react-start/server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogEntry, MarketplaceStore, PermissionGrant, TrialRecord } from "./catalog.ts";
import { projectsForClient } from "../projects/runtime.server.ts";
import { database } from "../capability-runtime/store.server.ts";
export class SupabaseMarketplaceStore implements MarketplaceStore {
  constructor(readonly userId: string | undefined, private readonly client: SupabaseClient, private readonly admin: SupabaseClient) {}
  async list() {
    const visible = await database(this.client.from("marketplace_listings").select("id,state").eq("state","published").order("updated_at", { ascending: false }).limit(200));
    if (!visible?.length) return [];
    const rows = await database(this.admin.from("marketplace_versions").select("entry").in("id",visible.map(x=>x.id)));
    return (rows ?? []).map(x=>x.entry as CatalogEntry);
  }
  async get(id: string) {
    const visible = await database(this.client.from("marketplace_listings").select("id,state").eq("id",id).maybeSingle());
    if (!visible) return null;
    const row = await database(this.admin.from("marketplace_versions").select("entry").eq("id",id).single());
    return { ...row.entry, state: visible.state } as CatalogEntry;
  }
  async publish(entry: CatalogEntry) {
    return await database(this.admin.rpc("xeomx_marketplace_publish", { p_actor: this.userId, p_entry: entry })) as CatalogEntry;
  }
  async authorizeProject(id: string) {
    if (!this.userId) throw Error("AUTH_REQUIRED");
    const role = await database(this.client.rpc("xeomx_project_role", { p_project_id: id }));
    if (!["owner","editor","viewer"].includes(role)) throw Error("PROJECT_ACCESS_DENIED");
  }
  async projectContext(id: string) {
    await this.authorizeProject(id);
    return (await projectsForClient(this.userId!,this.client).brain.buildContext(id,{ maxCharacters: 4000 })).text;
  }
  async grant(packageId: string, projectId: string) {
    const row = await database(this.client.from("marketplace_permission_grants").select("record").eq("user_id",this.userId).eq("project_id",projectId).eq("package_id",packageId).maybeSingle());
    return (row?.record ?? null) as PermissionGrant | null;
  }
  async saveGrant(entry: CatalogEntry, projectId: string) {
    await database(this.client.rpc("xeomx_marketplace_grant",{ p_version: entry.id, p_project: projectId, p_digest: entry.manifest.integrity.digest, p_permissions: entry.manifest.permissions }));
  }
  async claimTrial(record: TrialRecord) {
    return await database(this.admin.rpc("xeomx_marketplace_trial",{ p_actor:this.userId,p_action:"claim",p_record:record })) as { claimed:boolean;record:TrialRecord };
  }
  async finishTrial(record: TrialRecord) {
    return await database(this.admin.rpc("xeomx_marketplace_trial",{ p_actor:this.userId,p_action:"finish",p_record:record })) as TrialRecord;
  }
  async hasTrial(versionId: string) {
    if (!this.userId) return false;
    const rows = await database(this.client.from("marketplace_trials").select("id").eq("user_id",this.userId).eq("version_id",versionId).eq("state","COMPLETED").limit(1));
    return !!rows?.length;
  }
  async review(id: string, dimensions: Record<string,number>, text: string) {
    await database(this.client.rpc("xeomx_marketplace_review",{ p_version:id,p_dimensions:dimensions,p_text:text }));
  }
  async reviews(id: string) {
    const rows = await database(this.client.from("marketplace_reviews").select("dimensions,body").eq("version_id",id).eq("status","active").limit(50));
    return (rows ?? []).map(x=>({ dimensions:x.dimensions as Record<string,number>,text:x.body as string }));
  }
  async continuation(id: string, kind: "job" | "conversation") {
    if (!this.userId) throw Error("AUTH_REQUIRED");
    if (kind === "job") {
      const row = await database(this.client.from("controlled_runs").select("id,project_id,runtime_data,state,failure_code").eq("id",id).eq("requested_by",this.userId).single());
      await this.authorizeProject(row.project_id);
      if (!row.runtime_data?.request?.task?.goal || !["failed","unavailable"].includes(row.state)) throw Error("TASK_NOT_WAITING_FOR_CAPABILITY");
      return { projectId: row.project_id as string, referenceId: id, kind, goal: String(row.runtime_data.request.task.goal).slice(0,500) };
    }
    const row = await database(this.client.from("conversations").select("id,project_id,core_execution").eq("id",id).eq("created_by",this.userId).single());
    await this.authorizeProject(row.project_id);
    if (!["FAILED","NOT_CONFIGURED"].includes(row.core_execution?.state)) throw Error("TASK_NOT_WAITING_FOR_CAPABILITY");
    const messages = await database(this.client.from("messages").select("content").eq("conversation_id",id).eq("project_id",row.project_id).eq("role","user").order("created_at").limit(1));
    if (!messages?.length) throw Error("TASK_UNAVAILABLE");
    return { projectId: row.project_id as string, referenceId: id, kind, goal: String(messages[0].content).slice(0,500) };
  }
}
