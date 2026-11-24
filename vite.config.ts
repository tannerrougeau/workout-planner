import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  // Relative asset paths so the build works under GitHub Pages' /workout-planner/ subpath
  // and at the root of Netlify preview links.
  base: "./",
  // Recorded in backups so a file can be traced to the app version that wrote it.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    // Makes the site installable and usable offline. src/updates.ts registers the service worker,
    // checks for new deploys while the app is open, and applies them outside of a workout.
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      // Cache the bundled fonts too, so the app looks the same offline.
      workbox: { globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"] },
      includeAssets: ["favicon.ico", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "Workout Planner",
        short_name: "Workouts",
        description: "Personalized weekly workout plans with progression guidance.",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#f4f5f7",
        theme_color: "#2f6fde",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
