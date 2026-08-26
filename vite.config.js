import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base must match the GitHub Pages sub-path (https://<user>.github.io/<repo>/).
// Set BASE_PATH in CI, or edit the fallback if the repo is renamed.
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH ?? "/wdi-dashboard/",
  build: { outDir: "dist", assetsDir: "assets", sourcemap: false },
});
