// Build script for Native Pro (Stock Enhancer)
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pluginDir = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [path.join(pluginDir, "src", "index.ts")],
  outfile: path.join(pluginDir, "index.js"),
  bundle: true,
  platform: "browser",
  target: "es2022",
  format: "iife",
  logLevel: "info"
});
