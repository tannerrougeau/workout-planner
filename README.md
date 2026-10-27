# Workout Planner

Answer a few onboarding questions and get a personalized weekly workout plan with progression guidance.

**Live app:** https://tannerrougeau.github.io/workout-planner/

## Install the app

Open the live link, then:

- **iPhone (Safari):** Share → Add to Home Screen
- **Android (Chrome):** ⋮ menu → Install app
- **Desktop (Chrome / Edge):** the install icon at the right of the address bar

It works offline and updates itself after each approved change goes live.

## Test a proposed change

Every pull request gets its own test link from Netlify, posted as a comment on the pull request. Open it to try the change before approving. Test links never affect the live app.

## Make a change

```
git clone https://github.com/tannerrougeau/workout-planner.git
cd workout-planner
npm install
npm run dev          # run locally
```

1. Create a branch: `git checkout -b my-change`
2. Make your change and check it: `npm run typecheck` and `npm test`
3. Commit, push the branch, and open a pull request on GitHub
4. A teammate reviews it on its test link and approves
5. Merge it; the live app updates within a couple of minutes

`main` is protected: every change needs a pull request, passing checks and one approval.

## Project layout

- `src/planner.ts` – builds the plan (splits, sets and reps, progression)
- `src/exercises.ts` – exercise library
- `src/assessment.ts` – onboarding questions that assign the experience level
- `src/Onboarding.tsx`, `src/App.tsx` – the screens
- `public/icon.svg` – app icon; regenerate the PNGs with `npx @vite-pwa/assets-generator@2.0.0`
