import type { Permission, WorkspaceRole } from "./contracts.ts";
const grants: Record<WorkspaceRole, readonly Permission[]> = {
  owner: [
    "view",
    "edit",
    "execute_workflow",
    "manage_automation",
    "approve",
    "assign",
    "edit_creative",
    "manage_members",
  ],
  admin: [
    "view",
    "edit",
    "execute_workflow",
    "manage_automation",
    "approve",
    "assign",
    "edit_creative",
    "manage_members",
  ],
  editor: ["view", "edit", "execute_workflow", "assign", "edit_creative"],
  viewer: ["view"],
};
export const permits = (role: WorkspaceRole, permission: Permission) =>
  grants[role].includes(permission);
export function requirePermission(role: WorkspaceRole, permission: Permission) {
  if (!permits(role, permission)) throw Error("COLLABORATION_FORBIDDEN");
}
