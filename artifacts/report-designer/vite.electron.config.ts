import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Electron-specific build — no Replit plugins, no PORT/BASE_PATH needed
// base: './' so all assets use relative paths (works with file:// protocol)

export default defineConfig({
  base: "./",
  define: {
    "import.meta.env.VITE_IS_ELECTRON": JSON.stringify("true"),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "../report-designer-desktop/frontend-dist"),
    emptyOutDir: true,
  },
});
