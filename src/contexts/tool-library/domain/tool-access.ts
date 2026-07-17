// Pure access policy for the Tool Library.
//
// Roles map onto the product's access-control story like this:
//   HR_ADMIN — "Super Admin": sees the whole library, toggles tools
//              company-wide, assigns per-user access, and can run any tool
//              that is company-enabled.
//   MANAGER / EMPLOYEE — "secondary users": can run a tool only when it is
//              BOTH company-enabled and individually granted to them.

import type { ActorRole } from 'src/platform/auth/actor-context';

export function canManageLibrary(role: ActorRole): boolean {
  return role === 'HR_ADMIN';
}

export function canRunTool(role: ActorRole, enabled: boolean, granted: boolean): boolean {
  if (!enabled) return false;
  return role === 'HR_ADMIN' || granted;
}

/** Whether the tool should appear at all in this caller's library listing. */
export function canSeeTool(role: ActorRole, enabled: boolean, granted: boolean): boolean {
  // Super Admins see everything (including disabled tools, so they can
  // re-enable them); everyone else only sees what they can actually run.
  return role === 'HR_ADMIN' || canRunTool(role, enabled, granted);
}
