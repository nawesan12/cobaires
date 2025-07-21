// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";
import vercel from "@astrojs/vercel";
import { addDynamicIconSelectors } from "@iconify/tailwind";

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [
      tailwindcss(),
      //@ts-expect-error bla
      addDynamicIconSelectors(),
      //@ts-expect-error bla
      function ({ addVariant }) {
        addVariant("active", "&.is-active");
      },
    ],
  },
  output: "server", // Requerido para usar SSR
  adapter: vercel(),
});
