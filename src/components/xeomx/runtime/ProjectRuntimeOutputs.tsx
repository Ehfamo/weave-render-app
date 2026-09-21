import { JobArtifacts, useCapabilityProject } from "./CapabilityPanel";
export function ProjectRuntimeOutputs({ projectId }: { projectId: string }) {
  const runtime = useCapabilityProject(projectId);
  return <JobArtifacts runtime={runtime} />;
}
