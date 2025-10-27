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
  // Add this for proper SPA routing
  server: {
    historyApiFallback: true
  }
})