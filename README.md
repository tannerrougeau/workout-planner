# Workout Planner

Answer a few onboarding questions and get a personalized weekly workout plan, then log workouts set by set and get next targets as you progress.

**Live app:** https://tannerrougeau.github.io/workout-planner/ (temporary address; a custom domain is planned. The app uses relative paths, so moving it only changes this link.)

## Install the app

Open the live link, then:

- **iPhone (Safari):** Share → Add to Home Screen
- **Android (Chrome):** ⋮ menu → Install app
- **Desktop (Chrome / Edge):** the install icon at the right of the address bar

It works offline and updates itself after each change goes live. Workout data is stored on each device.

## Develop

```
git clone https://github.com/tannerrougeau/workout-planner.git
cd workout-planner
npm install
npm run dev          # run locally
npm run typecheck    # TypeScript
npm test             # Vitest
npm run build        # production build into dist/
```

## How changes go live

1. Create a branch and make the change; check it with `npm run typecheck` and `npm test`
2. Push the branch and open a pull request
3. Netlify posts a test link on the pull request; try the change there (test links never affect the live app)
4. Merge the pull request
5. GitHub Actions runs the typecheck and tests, then deploys `main` to GitHub Pages (a failed check means nothing deploys)

`main` blocks force-pushes and deletion, but doesn't require reviews.

## Project layout

- `src/planner.ts` – builds the plan (splits, sets and reps, progression)
- `src/exercises.ts` – exercise library; `src/videos.ts` – optional hand-picked demo videos
- `src/assessment.ts` – onboarding questions that assign the experience level
- `src/progress.ts` – next targets, cycle weeks, suggestions, personal bests
- `src/workoutLog.ts`, `src/profile.ts` – what's saved on the device
- `src/App.tsx`, `src/Onboarding.tsx`, `src/LogWorkout.tsx`, `src/History.tsx` – the screens
- `public/icon.svg` – app icon; regenerate the PNGs with `npx @vite-pwa/assets-generator@2.0.0`
- `docs/hub-setup.md` – setup for the parked community hub (branch `community-hub`)
