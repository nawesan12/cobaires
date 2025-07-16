// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";
import vercel from "@astrojs/vercel/serverless"; // 👈 O vercel/edge si preferís

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
  output: "server", // Requerido para usar SSR
  adapter: vercel({}),
});
