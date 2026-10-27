import { EMPTY_ASSESSMENT, type AssessmentAnswers } from "./assessment";
import type { PlanInput } from "./planner";
import type { Units } from "./workoutLog";

export interface UserProfile extends PlanInput {
  name: string;
  /** Onboarding answers the experience level was assigned from. */
  assessment: AssessmentAnswers;
  units: Units;
}

const STORAGE_KEY = "workout-planner.profile.v1";

export const DEFAULT_PROFILE: UserProfile = {
  name: "",
  goal: "general",
  level: "beginner",
  daysPerWeek: 3,
  weekdays: ["Mon", "Wed", "Fri"],
  sessionMinutes: 45,
  equipment: [],
  limitations: [],
  focus: [],
  excluded: [],
  assessment: EMPTY_ASSESSMENT,
  units: "kg",
};

export function loadProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || !("goal" in parsed) || !("level" in parsed)) return null;
    return { ...DEFAULT_PROFILE, ...(parsed as Partial<UserProfile>) };
  } catch {
    return null;
  }
}

export function saveProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Storage unavailable (private mode, blocked site data): the profile just won't persist.
  }
}

export function clearProfile(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
