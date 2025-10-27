// vite.config.js
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "build", // changed from "dist"
  },
  server: {
    port: 5173,
    open: true,
  },
});
