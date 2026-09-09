/** Opaque navigation references only. This object does not confer authorization. */
export type ProjectLocation = { environment: string; view: string; at: string };

export type ProjectContext = {
  projectId: string | null;
  conversationId: string | null;
  assetIds: readonly string[];
  fileIds: readonly string[];
  selectedModelIds: readonly string[];
  sourceIds: readonly string[];
  referenceIds: readonly string[];
  permissionIds: readonly string[];
  jobIds: readonly string[];
  historyIds: readonly string[];
  lastLocation: ProjectLocation | null;
};

export function createEmptyProjectContext(): ProjectContext {
  return {
    projectId: null,
    conversationId: null,
    assetIds: [],
    fileIds: [],
    selectedModelIds: [],
    sourceIds: [],
    referenceIds: [],
    permissionIds: [],
    jobIds: [],
    historyIds: [],
    lastLocation: null,
  };
}

/** Immutable handoff; receiving services must reauthorize every referenced resource. */
export function recordProjectHandoff(
  context: ProjectContext,
  location: ProjectLocation,
): ProjectContext {
  if (!location.environment.trim() || !location.view.trim() || !location.at.trim()) {
    throw new Error("A handoff requires an environment, view and timestamp.");
  }
  return { ...context, lastLocation: { ...location } };
}
