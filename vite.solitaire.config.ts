// The solitaire's own build, separate from the game's: `npm run build` builds the game first (vite.config.ts, which
// knows nothing of the solitaire), then this, into dist/solitaire/. The game's files are left exactly as they are.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const outDir = join(projectRoot, "dist", "solitaire");

// Stamps the solitaire's service worker (solitaire/public/sw.js) with a build id and every built file, so it plays
// offline and each deployment replaces the previous cache.
const serviceWorkerManifest: Plugin = {
  name: "solitaire-service-worker",
  apply: "build",
  writeBundle(_options, bundle) {
    const file = join(outDir, "sw.js");
    const builtFiles = Object.keys(bundle).filter((name) => name !== "index.html" && !name.endsWith(".woff"));
    const source = readFileSync(file, "utf8")
      .replace("__BUILD_ID__", Date.now().toString(36))
      .replace("__BUILT_FILES__", JSON.stringify(builtFiles));
    writeFileSync(file, source);
  },
};

// The same rules as the game's page (see vite.config.ts), less the multiplayer server it never talks to.
const contentSecurityPolicy: Plugin = {
  name: "content-security-policy",
  apply: "build",
  transformIndexHtml: () => [
    {
      tag: "meta",
      injectTo: "head-prepend",
      attrs: {
        "http-equiv": "Content-Security-Policy",
        content: [
          "default-src 'self'",
          "script-src 'self' https://static.cloudflareinsights.com",
          "style-src 'self' 'unsafe-inline'",
          "font-src 'self' data:",
          "img-src 'self' data:",
          "connect-src 'self' https://cloudflareinsights.com",
          "worker-src 'self'",
          "manifest-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'none'",
        ].join("; "),
      },
    },
  ],
};

export default defineConfig({
  root: "solitaire",
  base: "./",
  // solitaire/public: its service worker and manifest. The icons are the game's, one folder up once published.
  plugins: [react(), contentSecurityPolicy, serviceWorkerManifest],
  // The page's code lives in src/solitaire, outside this root.
  server: { fs: { allow: [projectRoot] } },
  build: { outDir, emptyOutDir: false },
});
