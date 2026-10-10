import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps asset paths relative, so the build works on GitHub Pages
// whether it's served from a project path (user.github.io/clear-the-deck/) or a custom domain.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
