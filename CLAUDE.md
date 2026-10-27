# Workout Planner – notes for Claude Code

Solo project by Tanner Rougeau: an installable PWA (Vite + React 19 + TypeScript, Vitest) that builds workout plans and tracks workouts. All workout data lives in the browser's localStorage on each device; there is no backend on `main`.

## Workflow
- Never commit straight to `main`. Branch → pull request → Netlify test link (`deploy-preview-<PR>--hackapptrial.netlify.app`) → the owner says "merge" → GitHub Actions (`.github/workflows/deploy.yml`) runs typecheck + tests and deploys `main` to GitHub Pages.
- Before opening a PR: `npm run typecheck`, `npm test`, `npm run build`. For UI changes, check phone width (~390px) in light and dark mode.
- When the owner asks for a plan or review first, propose it and wait for approval before changing code.

## Constraints
- **No hardcoded app URL.** The app will move to a custom domain (a subdomain per app). Keep `base: "./"` in `vite.config.ts` and relative `start_url`/`scope` in the manifest; derive links from `window.location` or configuration, never a literal `github.io` address.
- **Community hub is parked** on branch `community-hub` (Supabase + Brevo design). Don't merge, delete or build on it unless asked. Setup steps live in `docs/hub-setup.md`.
- **Sibling apps are off-limits from this repo:** DailyPlate (meal planning) and FoodScanner (food photo nutrition) are separate repos that may later join one platform.
- Library versions: pin exact versions at least two weeks old.

## Code map
- Plan logic: `src/planner.ts`, `src/exercises.ts`, `src/assessment.ts`
- Progress logic: `src/progress.ts` (pure; tested in `src/progress.test.ts`)
- Storage: `src/workoutLog.ts` (sessions, in-progress draft), `src/profile.ts` (profile); keys are versioned (`workout-planner.*.v1`)
- Screens: `src/App.tsx` (Today/Progress/Profile tabs), `src/Onboarding.tsx`, `src/LogWorkout.tsx`, `src/History.tsx`, `src/VideoButton.tsx`
- Styles: `src/styles.css` (design tokens with light and dark themes at the top)
