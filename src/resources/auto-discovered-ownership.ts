import type { State, ResourceType } from '../types.js';
import { pathExists } from '../utils/fs.js';

/**
 * Ownership tracking for resources teamai deploys into AUTO-DISCOVERED tool dirs
 * (installed on disk but absent from the team's `toolPaths`).
 *
 * The problem: on a second pull after a team update, the local copy is the OLD
 * team version, which no longer equals the NEW team source — indistinguishable
 * by content from a personal resource that merely shares a name. So we cannot
 * decide "safe to overwrite" from content alone; we record what teamai itself
 * deployed (`state.autoDiscoveredManaged`) and consult that record.
 *
 * These helpers operate on a State object the caller has loaded; the caller
 * persists it (load-modify-save), mirroring how coAuthorManaged is handled.
 */

/** Stable key for one deployed resource in one tool. */
export function ownershipKey(tool: string, type: ResourceType, name: string): string {
  return `${tool}:${type}:${name}`;
}

/**
 * Decide whether pull may write `dest` in an auto-discovered tool dir.
 *
 * - destination absent            → write (nothing to clobber)
 * - destination present + tracked → write (teamai deployed it; deliver updates)
 * - destination present + untracked → DO NOT write (personal resource; preserve)
 */
export async function mayWriteAutoDiscovered(
  dest: string,
  key: string,
  state: State,
): Promise<boolean> {
  if (!await pathExists(dest)) return true;
  const tracked = state.autoDiscoveredManaged ?? [];
  return tracked.includes(key);
}

/** Record that teamai deployed `key` into an auto-discovered dir (idempotent). */
export function markAutoDiscovered(key: string, state: State): void {
  const tracked = state.autoDiscoveredManaged ?? [];
  if (!tracked.includes(key)) {
    tracked.push(key);
    state.autoDiscoveredManaged = tracked;
  }
}

/** True if teamai's record says it deployed `key` into an auto-discovered dir. */
export function isAutoDiscoveredTracked(key: string, state: State): boolean {
  return (state.autoDiscoveredManaged ?? []).includes(key);
}

/** Drop `key` from the ownership record (e.g. after a tombstone cleanup). */
export function unmarkAutoDiscovered(key: string, state: State): void {
  const tracked = state.autoDiscoveredManaged;
  if (!tracked) return;
  const idx = tracked.indexOf(key);
  if (idx !== -1) {
    tracked.splice(idx, 1);
    state.autoDiscoveredManaged = tracked;
  }
}
