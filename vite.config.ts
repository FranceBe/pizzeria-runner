import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin, type Rollup } from "vite";
import react from "@vitejs/plugin-react";

// The entry script, what it imports statically, and the styles: chunks loaded on demand, if any ever exist,
// are left out so they don't weigh on every player's first visit.
const filesLoadedByThePage = (bundle: Rollup.OutputBundle): string[] => {
  const files = new Set<string>();
  const addChunk = (name: string) => {
    const chunk = bundle[name];
    if (files.has(name) || chunk?.type !== "chunk") return;
    files.add(name);
    chunk.imports.forEach(addChunk);
  };
  Object.values(bundle).forEach((output) => {
    if (output.type === "chunk" && output.isEntry) addChunk(output.fileName);
    if (output.type === "asset" && output.fileName.endsWith(".css")) files.add(output.fileName);
  });
  return [...files];
};

// Writes a build id and the list of built files into the service worker (public/sw.js),
// so each deployment caches the right files and replaces the previous cache.
const serviceWorkerManifest = (): Plugin => {
  let outDir = "dist";
  return {
    name: "service-worker-manifest",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    writeBundle(_options, bundle) {
      const file = join(outDir, "sw.js");
      const builtFiles = filesLoadedByThePage(bundle);
      const source = readFileSync(file, "utf8")
        .replace("__BUILD_ID__", Date.now().toString(36))
        .replace("__BUILT_FILES__", JSON.stringify(builtFiles));
      writeFileSync(file, source);
    },
  };
};

// What the built page may load: its own files, Google Fonts, and the Cloudflare analytics beacon; nothing else, so an
// injected script or a tampered dependency can't load code or send data anywhere else. GitHub Pages can't send headers,
// so it goes in a meta tag. Build only: the dev server injects an inline script for hot reload.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' https://static.cloudflareinsights.com",
  // React sets style attributes (progress bars, colours).
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  // The day's receipt is drawn on a canvas and shared as an image.
  "img-src 'self' data: blob:",
  "connect-src 'self' https://cloudflareinsights.com",
  "media-src 'self' blob:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

const contentSecurityPolicy = (): Plugin => ({
  name: "content-security-policy",
  apply: "build",
  transformIndexHtml: () => [
    { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: CONTENT_SECURITY_POLICY }, injectTo: "head-prepend" },
  ],
});

// Relative base so the built game also opens from a plain folder or a sub-path.
export default defineConfig({ plugins: [react(), serviceWorkerManifest(), contentSecurityPolicy()], base: "./" });
