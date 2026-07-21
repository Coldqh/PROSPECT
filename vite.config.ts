import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "icons/prospect-mark.svg",
        "icons/prospect-192.png",
        "icons/prospect-512.png",
      ],
      manifest: {
        name: "PROSPECT",
        short_name: "PROSPECT",
        description: "Симулятор жизни и карьеры профессионального спортсмена.",
        theme_color: "#0a0b0d",
        background_color: "#0a0b0d",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "./",
        scope: "./",
        icons: [
          {
            src: "icons/prospect-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/prospect-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icons/prospect-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  build: {
    target: "es2022",
    sourcemap: true,
    chunkSizeWarningLimit: 700,
  },

});
