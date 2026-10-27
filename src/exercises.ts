export type Equipment =
  | "bodyweight"
  | "dumbbells"
  | "barbell"
  | "kettlebell"
  | "machines"
  | "bands"
  | "pullupBar";

export type Level = "beginner" | "intermediate" | "advanced";

export type Limitation = "knees" | "lowerBack" | "shoulders" | "wrists";

export type Pattern =
  | "squat"
  | "hinge"
  | "lunge"
  | "horizontalPush"
  | "verticalPush"
  | "horizontalPull"
  | "verticalPull"
  | "biceps"
  | "triceps"
  | "core"
  | "calves"
  | "conditioning";

export interface Exercise {
  name: string;
  pattern: Pattern;
  /** Every listed item is required to perform the exercise. */
  equipment: Equipment[];
  minLevel: Level;
  /** Prescribed as a timed hold/interval instead of reps. */
  timed?: boolean;
  /** Joints this exercise loads heavily; skipped for users who report that limitation. */
  stresses?: Limitation[];
}

export const LEVEL_RANK: Record<Level, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

export const EXERCISES: Exercise[] = [
  // Squat
  { name: "Bodyweight Squat", pattern: "squat", equipment: ["bodyweight"], minLevel: "beginner" },
  { name: "Goblet Squat", pattern: "squat", equipment: ["dumbbells"], minLevel: "beginner" },
  { name: "Kettlebell Goblet Squat", pattern: "squat", equipment: ["kettlebell"], minLevel: "beginner" },
  { name: "Leg Press", pattern: "squat", equipment: ["machines"], minLevel: "beginner" },
  { name: "Back Squat", pattern: "squat", equipment: ["barbell"], minLevel: "intermediate", stresses: ["knees", "lowerBack"] },
  { name: "Front Squat", pattern: "squat", equipment: ["barbell"], minLevel: "advanced", stresses: ["knees", "wrists"] },
  { name: "Pistol Squat (assisted)", pattern: "squat", equipment: ["bodyweight"], minLevel: "advanced", stresses: ["knees"] },

  // Hinge
  { name: "Glute Bridge", pattern: "hinge", equipment: ["bodyweight"], minLevel: "beginner" },
  { name: "Dumbbell Romanian Deadlift", pattern: "hinge", equipment: ["dumbbells"], minLevel: "beginner" },
  { name: "Kettlebell Swing", pattern: "hinge", equipment: ["kettlebell"], minLevel: "intermediate", stresses: ["lowerBack"] },
  { name: "Band Pull-Through", pattern: "hinge", equipment: ["bands"], minLevel: "beginner" },
  { name: "Seated Leg Curl", pattern: "hinge", equipment: ["machines"], minLevel: "beginner" },
  { name: "Barbell Romanian Deadlift", pattern: "hinge", equipment: ["barbell"], minLevel: "intermediate", stresses: ["lowerBack"] },
  { name: "Conventional Deadlift", pattern: "hinge", equipment: ["barbell"], minLevel: "intermediate", stresses: ["lowerBack"] },
  { name: "Single-Leg Hip Thrust", pattern: "hinge", equipment: ["bodyweight"], minLevel: "intermediate" },

  // Lunge
  { name: "Reverse Lunge", pattern: "lunge", equipment: ["bodyweight"], minLevel: "beginner", stresses: ["knees"] },
  { name: "Step-Up", pattern: "lunge", equipment: ["bodyweight"], minLevel: "beginner" },
  { name: "Dumbbell Walking Lunge", pattern: "lunge", equipment: ["dumbbells"], minLevel: "beginner", stresses: ["knees"] },
  { name: "Bulgarian Split Squat", pattern: "lunge", equipment: ["dumbbells"], minLevel: "intermediate", stresses: ["knees"] },
  { name: "Barbell Split Squat", pattern: "lunge", equipment: ["barbell"], minLevel: "advanced", stresses: ["knees"] },

  // Horizontal push
  { name: "Incline Push-Up", pattern: "horizontalPush", equipment: ["bodyweight"], minLevel: "beginner", stresses: ["wrists"] },
  { name: "Push-Up", pattern: "horizontalPush", equipment: ["bodyweight"], minLevel: "intermediate", stresses: ["wrists"] },
  { name: "Dumbbell Bench Press", pattern: "horizontalPush", equipment: ["dumbbells"], minLevel: "beginner" },
  { name: "Chest Press Machine", pattern: "horizontalPush", equipment: ["machines"], minLevel: "beginner" },
  { name: "Band Chest Press", pattern: "horizontalPush", equipment: ["bands"], minLevel: "beginner" },
  { name: "Barbell Bench Press", pattern: "horizontalPush", equipment: ["barbell"], minLevel: "intermediate", stresses: ["shoulders"] },
  { name: "Deficit Push-Up", pattern: "horizontalPush", equipment: ["bodyweight"], minLevel: "advanced", stresses: ["shoulders", "wrists"] },

  // Vertical push
  { name: "Pike Push-Up", pattern: "verticalPush", equipment: ["bodyweight"], minLevel: "intermediate", stresses: ["shoulders", "wrists"] },
  { name: "Seated Dumbbell Shoulder Press", pattern: "verticalPush", equipment: ["dumbbells"], minLevel: "beginner" },
  { name: "Kettlebell Overhead Press", pattern: "verticalPush", equipment: ["kettlebell"], minLevel: "intermediate", stresses: ["shoulders"] },
  { name: "Shoulder Press Machine", pattern: "verticalPush", equipment: ["machines"], minLevel: "beginner" },
  { name: "Band Overhead Press", pattern: "verticalPush", equipment: ["bands"], minLevel: "beginner" },
  { name: "Standing Barbell Overhead Press", pattern: "verticalPush", equipment: ["barbell"], minLevel: "intermediate", stresses: ["lowerBack", "shoulders"] },

  // Horizontal pull
  { name: "Band Row", pattern: "horizontalPull", equipment: ["bands"], minLevel: "beginner" },
  { name: "One-Arm Dumbbell Row", pattern: "horizontalPull", equipment: ["dumbbells"], minLevel: "beginner" },
  { name: "Seated Cable Row", pattern: "horizontalPull", equipment: ["machines"], minLevel: "beginner" },
  { name: "Inverted Row", pattern: "horizontalPull", equipment: ["pullupBar"], minLevel: "intermediate" },
  { name: "Barbell Bent-Over Row", pattern: "horizontalPull", equipment: ["barbell"], minLevel: "intermediate", stresses: ["lowerBack"] },
  { name: "Prone Y-T-W Raise", pattern: "horizontalPull", equipment: ["bodyweight"], minLevel: "beginner" },

  // Vertical pull
  { name: "Lat Pulldown", pattern: "verticalPull", equipment: ["machines"], minLevel: "beginner" },
  { name: "Band Lat Pulldown", pattern: "verticalPull", equipment: ["bands"], minLevel: "beginner" },
  { name: "Negative Pull-Up", pattern: "verticalPull", equipment: ["pullupBar"], minLevel: "beginner" },
  { name: "Pull-Up", pattern: "verticalPull", equipment: ["pullupBar"], minLevel: "intermediate" },
  { name: "Chin-Up", pattern: "verticalPull", equipment: ["pullupBar"], minLevel: "intermediate" },
  { name: "Dumbbell Pullover", pattern: "verticalPull", equipment: ["dumbbells"], minLevel: "beginner", stresses: ["shoulders"] },

  // Arms
  { name: "Dumbbell Curl", pattern: "biceps", equipment: ["dumbbells"], minLevel: "beginner" },
  { name: "Band Curl", pattern: "biceps", equipment: ["bands"], minLevel: "beginner" },
  { name: "Barbell Curl", pattern: "biceps", equipment: ["barbell"], minLevel: "beginner", stresses: ["wrists"] },
  { name: "Cable Curl", pattern: "biceps", equipment: ["machines"], minLevel: "beginner" },
  { name: "Bench Dip", pattern: "triceps", equipment: ["bodyweight"], minLevel: "beginner", stresses: ["shoulders"] },
  { name: "Overhead Dumbbell Extension", pattern: "triceps", equipment: ["dumbbells"], minLevel: "beginner" },
  { name: "Band Triceps Pushdown", pattern: "triceps", equipment: ["bands"], minLevel: "beginner" },
  { name: "Cable Triceps Pushdown", pattern: "triceps", equipment: ["machines"], minLevel: "beginner" },
  { name: "Diamond Push-Up", pattern: "triceps", equipment: ["bodyweight"], minLevel: "intermediate", stresses: ["wrists"] },

  // Core
  { name: "Plank", pattern: "core", equipment: ["bodyweight"], minLevel: "beginner", timed: true },
  { name: "Dead Bug", pattern: "core", equipment: ["bodyweight"], minLevel: "beginner" },
  { name: "Side Plank", pattern: "core", equipment: ["bodyweight"], minLevel: "beginner", timed: true },
  { name: "Pallof Press", pattern: "core", equipment: ["bands"], minLevel: "beginner" },
  { name: "Hanging Knee Raise", pattern: "core", equipment: ["pullupBar"], minLevel: "intermediate" },
  { name: "Ab Wheel Rollout", pattern: "core", equipment: ["bodyweight"], minLevel: "advanced", stresses: ["lowerBack"] },

  // Calves
  { name: "Standing Calf Raise", pattern: "calves", equipment: ["bodyweight"], minLevel: "beginner" },
  { name: "Dumbbell Calf Raise", pattern: "calves", equipment: ["dumbbells"], minLevel: "beginner" },

  // Conditioning
  { name: "Jumping Jacks", pattern: "conditioning", equipment: ["bodyweight"], minLevel: "beginner", timed: true, stresses: ["knees"] },
  { name: "Mountain Climbers", pattern: "conditioning", equipment: ["bodyweight"], minLevel: "beginner", timed: true, stresses: ["wrists"] },
  { name: "Burpees", pattern: "conditioning", equipment: ["bodyweight"], minLevel: "intermediate", timed: true, stresses: ["knees", "lowerBack", "wrists"] },
  { name: "Kettlebell Swing Intervals", pattern: "conditioning", equipment: ["kettlebell"], minLevel: "intermediate", timed: true, stresses: ["lowerBack"] },
];
