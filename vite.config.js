import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  publicDir: false,
  build: {
    outDir: "public/react",
    emptyOutDir: true,
    sourcemap: false,
    lib: {
      entry: "src/react/main.jsx",
      formats: ["es"],
      fileName: () => "bidoc-react.js"
    },
    rollupOptions: {
      output: {
        assetFileNames: "bidoc-react.[ext]"
      }
    }
  }
});
