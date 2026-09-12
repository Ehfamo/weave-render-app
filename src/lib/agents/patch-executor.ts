import { hasSensitiveJson } from "../stage53-json.ts";

export interface PatchChange {
  path: string;
  before: string;
  after: string;
}
export interface PatchProposal {
  id: string;
  taskId: string;
  executionId: string;
  projectId: string;
  workspaceId: string;
  changes: readonly PatchChange[];
  validationCommandIds: readonly string[];
}
export interface AuthorizedWorkspace {
  authorize(input: {
    userId: string;
    projectId: string;
    workspaceId: string;
  }): Promise<{ rootId: string; allowedPaths: readonly string[] } | null>;
  readText(rootId: string, path: string): Promise<string>;
  writeText(rootId: string, path: string, content: string): Promise<void>;
}
export interface RestrictedValidator {
  allowedCommandIds: readonly string[];
  run(rootId: string, commandId: string): Promise<{ ok: boolean; summary: string }>;
}
const forbidden = /(^|\/)(\.env(?:\.|$)|\.git|secrets?|credentials?|id_rsa|id_ed25519)(\/|$)/i;
function safePath(path: string) {
  return (
    typeof path === "string" &&
    path.length <= 240 &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !path.split("/").includes("..") &&
    !forbidden.test(path) &&
    !path.includes("\0")
  );
}
export class AuthorizedPatchExecutor {
  private readonly workspace: AuthorizedWorkspace;
  private readonly validator: RestrictedValidator;
  private readonly limits: { maxFiles: number; maxBytes: number };
  constructor(
    workspace: AuthorizedWorkspace,
    validator: RestrictedValidator,
    limits = { maxFiles: 20, maxBytes: 200_000 },
  ) {
    this.workspace = workspace;
    this.validator = validator;
    this.limits = limits;
  }
  async execute(input: {
    proposal: PatchProposal;
    userId: string;
    approvedTaskId: string;
    approvedExecutionId: string;
    approvedProposalId: string;
  }) {
    const { proposal } = input;
    if (
      proposal.taskId !== input.approvedTaskId ||
      proposal.executionId !== input.approvedExecutionId ||
      proposal.id !== input.approvedProposalId
    )
      throw new Error("PATCH_APPROVAL_MISMATCH");
    if (!proposal.changes.length || proposal.changes.length > this.limits.maxFiles)
      throw new Error("PATCH_FILE_LIMIT");
    if (
      proposal.changes.some(
        (c) =>
          !safePath(c.path) ||
          typeof c.before !== "string" ||
          typeof c.after !== "string" ||
          c.before === c.after,
      )
    )
      throw new Error("INVALID_PATCH");
    if (new Set(proposal.changes.map((c) => c.path)).size !== proposal.changes.length)
      throw new Error("DUPLICATE_PATCH_PATH");
    if (
      proposal.changes.reduce((n, c) => n + c.before.length + c.after.length, 0) >
        this.limits.maxBytes ||
      hasSensitiveJson(proposal)
    )
      throw new Error("PATCH_REJECTED");
    if (proposal.validationCommandIds.some((id) => !this.validator.allowedCommandIds.includes(id)))
      throw new Error("VALIDATION_NOT_ALLOWLISTED");
    const auth = await this.workspace.authorize({
      userId: input.userId,
      projectId: proposal.projectId,
      workspaceId: proposal.workspaceId,
    });
    if (!auth) throw new Error("WORKSPACE_ACCESS_DENIED");
    for (const change of proposal.changes) {
      if (
        !auth.allowedPaths.some(
          (p) => change.path === p || (p.endsWith("/") && change.path.startsWith(p)),
        )
      )
        throw new Error("PATCH_PATH_DENIED");
      if ((await this.workspace.readText(auth.rootId, change.path)) !== change.before)
        throw new Error("PATCH_TARGET_CHANGED");
    }
    for (const change of proposal.changes)
      await this.workspace.writeText(auth.rootId, change.path, change.after);
    const validations = [];
    for (const id of proposal.validationCommandIds)
      validations.push({ commandId: id, ...(await this.validator.run(auth.rootId, id)) });
    return {
      proposalId: proposal.id,
      changedFiles: proposal.changes.map((c) => c.path),
      validations,
    };
  }
}
