import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo.webp", "background-img.webp"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
        globIgnores: ["**/ffmpeg/**"],
        maximumFileSizeToCacheInBytes: 3000000, // 3MB
      },
      manifest: {
        name: "Harp Music",
        short_name: "Harp",
        description: "Your Personal Cloud Music Player",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait",
        icons: [
          {
            src: "/logo.webp",
            sizes: "192x192",
            type: "image/webp",
          },
          {
            src: "/logo.webp",
            sizes: "512x512",
            type: "image/webp",
          },
          {
            src: "/logo.webp",
            sizes: "512x512",
            type: "image/webp",
            purpose: "maskable",
          },
        ],
      },
    }),
    visualizer({
      open: true, // Automatically opens the report in your browser
      filename: 'stats.html', // Output file name
      gzipSize: true, // Shows the gzipped size (closer to actual network impact)
      brotliSize: true, // Shows brotli size
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
  server: {
    host: true,
  },
});