import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { cloudflare } from "@cloudflare/vite-plugin";
import { paraglideVitePlugin } from "@inlang/paraglide-js";

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
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
