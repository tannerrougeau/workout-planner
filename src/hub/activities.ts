/** Sports and popular fitness styles people can organize meetups around. */
export const ACTIVITIES = [
  "Running",
  "Walking",
  "Hiking",
  "Cycling",
  "Swimming",
  "Strength",
  "Calisthenics",
  "HIIT",
  "CrossFit",
  "Bootcamp",
  "Yoga",
  "Pilates",
  "Dance",
  "Boxing",
  "Martial arts",
  "Climbing",
  "Basketball",
  "Soccer",
  "Volleyball",
  "Tennis",
  "Pickleball",
  "Frisbee",
  "Skating",
  "Other",
] as const;

export type Activity = (typeof ACTIVITIES)[number];
