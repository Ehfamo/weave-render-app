import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";
import { paraglideVitePlugin } from "@inlang/paraglide-js";

export default defineConfig({
  // Register the same Nitro adapter for build and preview. The wrapper only
  // auto-registers Nitro for build; mixing its output with Cloudflare preview
  // misreads deploy/config.json (Nitro does not emit auxiliaryWorkers).
  nitro: false,
  plugins: [
    nitro({ preset: "cloudflare-module" }),
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
      strategy: ["url", "cookie", "preferredLanguage", "baseLocale"],
      urlPatterns: [
        {
          pattern: "/:path(.*)?",
          localized: [
            ["en", "/en/:path(.*)?"],
            ["fa", "/fa/:path(.*)?"],
            ["ar", "/ar/:path(.*)?"],
            ["zh", "/zh/:path(.*)?"],
            ["hi", "/hi/:path(.*)?"],
          ],
        },
      ],
    }),
  ],
  vite: {
    base: "/",
  },
});
