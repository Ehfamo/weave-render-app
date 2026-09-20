import { createFileRoute } from "@tanstack/react-router";
import { MemoryControls } from "@/components/xeomx/projects/MemoryControls";
import { uuid } from "@/lib/memory/service";
export const Route=createFileRoute("/_authenticated/memory")({
  validateSearch:(value:Record<string,unknown>): {projectId?:string;conversationId?:string}=>{
    if(value.conversationId&&!value.projectId)throw new Error("INVALID_SCOPE");
    return ({
    projectId:value.projectId?uuid(value.projectId):undefined,
    conversationId:value.conversationId?uuid(value.conversationId):undefined,
  });}, component:Page,
});
function Page(){const {projectId,conversationId}=Route.useSearch();return <MemoryControls key={`${projectId??"user"}:${conversationId??""}`} scope={projectId?conversationId?{kind:"conversation",projectId,conversationId}:{kind:"project",projectId}:{kind:"user"}}/>;}
