/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const shared = fileURLToPath(new URL("../../packages/shared", import.meta.url));
const apiTarget = process.env.APACH_API_PROXY ?? "http://localhost:8000";

export default defineConfig({
  resolve: { alias: { "@shared": `${shared}/src`, "@content": `${shared}/content` } },
  server: { port: 5173, fs: { allow: [".", shared] }, proxy: { "/api": { target: apiTarget, changeOrigin: false } } },
  preview: { proxy: { "/api": { target: apiTarget } } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icons/*.png", "icons/*.svg", "brand/*.png"],
      manifest: {
        name: "APACH · Apapacho: Tu asistente virtual de APA",
        short_name: "APACH",
        description: "Asistente de normas APA 7 de la Escuela de Ciencias de la Comunicación (UJMD).",
        lang: "es-SV",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#FFF8EF",
        theme_color: "#213E46",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Precaché de la app, la guía y el generador (todo empaquetado en el bundle).
        globPatterns: ["**/*.{js,css,html,png,svg,woff,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        // La API protegida nunca se cachea (NetworkOnly).
        runtimeCaching: [{ urlPattern: ({ url }) => url.pathname.startsWith("/api/"), handler: "NetworkOnly" }],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "../../packages/shared/src/**/*.test.ts"],
  },
});
