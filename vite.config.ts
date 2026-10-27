import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative asset paths so the build works under GitHub Pages' /workout-planner/ subpath.
  base: "./",
  plugins: [react()],
});
