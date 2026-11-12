// The build of a page published next to the game (solitaire/, factory/): its own, separate from the game's.
// `npm run build` builds the game first (vite.config.ts, which knows nothing of these pages), then each page, into
// dist/<page>/. The game's files are left exactly as they are.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin, type UserConfigFnObject } from "vite";
import react from "@vitejs/plugin-react";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

// Writes the page's service worker from the shared template (src/sidePages/serviceWorker.js), stamped with the page's
// name, a build id and every built file, so it plays offline and each deployment replaces the previous cache.
const serviceWorker = (page: string, outDir: string): Plugin => ({
  name: "side-page-service-worker",
  apply: "build",
  writeBundle(_options, bundle) {
    const builtFiles = Object.keys(bundle).filter((name) => name !== "index.html" && !name.endsWith(".woff"));
    const source = readFileSync(join(projectRoot, "src", "sidePages", "serviceWorker.js"), "utf8")
      .replace("__PAGE__", page)
      .replace("__BUILD_ID__", Date.now().toString(36))
      .replace("__BUILT_FILES__", JSON.stringify(builtFiles));
    writeFileSync(join(outDir, "sw.js"), source);
  },
});

// The same rules as the game's page (see vite.config.ts), less the multiplayer server these pages never talk to.
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

/** The page in the `page` folder (its index.html, and its manifest in public/): built into dist/<page>/; served, in
 * development, at /<page>/ from the project's root, as it is published (its code lives in src/, which a server rooted
 * in the page's folder could not reach). */
export const sidePageConfig = (page: string): UserConfigFnObject =>
  defineConfig(({ command }) => {
    const outDir = join(projectRoot, "dist", page);
    if (command === "serve") {
      return {
        root: projectRoot,
        publicDir: join(projectRoot, page, "public"),
        plugins: [react()],
        server: { open: `/${page}/` },
      };
    }
    return {
      root: page,
      base: "./",
      // <page>/public: its manifest. The icons are the game's, one folder up once published.
      plugins: [react(), contentSecurityPolicy, serviceWorker(page, outDir)],
      build: { outDir, emptyOutDir: false },
    };
  });
