import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin, type Rollup } from "vite";
import react from "@vitejs/plugin-react";

// The entry script, what it imports statically, and the styles: chunks loaded on demand, if any ever exist,
// are left out so they don't weigh on every player's first visit.
function filesLoadedByThePage(bundle: Rollup.OutputBundle): string[] {
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
}

// Writes a build id and the list of built files into the service worker (public/sw.js),
// so each deployment caches the right files and replaces the previous cache.
function serviceWorkerManifest(): Plugin {
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
}

// Relative base so the built game also opens from a plain folder or a sub-path.
export default defineConfig({ plugins: [react(), serviceWorkerManifest()], base: "./" });
