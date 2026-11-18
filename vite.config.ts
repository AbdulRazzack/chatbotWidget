import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Builds the whole widget (React included) into ONE file: dist/widget.js
// Sites embed it with a single <script> tag.
export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    lib: {
      entry: "src/main.tsx",
      // Internal bundle name; the public API is window.VettingChat (set in main.tsx).
      name: "VettingChatBundle",
      formats: ["iife"],
      fileName: () => "widget.js",
    },
    cssCodeSplit: false,
    sourcemap: true,
  },
  server: {
    port: 5173,
  },
});
