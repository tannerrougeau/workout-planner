import type { Units } from "./workoutLog";

/** Bookkeeping the app keeps about itself, separate from the user's data. */
export interface Meta {
  /** Result of tagging pre-existing logged weights with a unit, shown once in Settings. */
  unitsMigration?: { count: number; unit: Units; at: number; dismissed?: boolean };
  /** Whether the browser agreed to keep this site's storage from being cleared automatically. */
  persist?: { granted: boolean; at: number };
}

const META_KEY = "workout-planner.meta.v1";

export function loadMeta(): Meta {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(META_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Meta) : {};
  } catch {
    return {};
  }
}

export function updateMeta(patch: Partial<Meta>): Meta {
  const next = { ...loadMeta(), ...patch };
  try {
    localStorage.setItem(META_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable; the notice may just show again.
  }
  return next;
}

/**
 * Asks once for persistent storage, so the browser won't evict the log under storage pressure.
 * Silent either way; the answer is recorded so it's never asked again.
 */
export async function requestPersistentStorage(now = Date.now()): Promise<void> {
  if (loadMeta().persist) return;
  let granted = false;
  try {
    granted = (await navigator.storage?.persist?.()) ?? false;
  } catch {
    granted = false;
  }
  updateMeta({ persist: { granted, at: now } });
}
