import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncClientRevision } from "./sync-client-revision.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const assetBuildSpecs = [
  { entry: "assets/js/strategy-experience.js", outfile: "assets/js/strategy-experience.min.js", target: "es2020", format: "iife", bundle: true },
  { entry: "assets/js/mbb-frames.js", outfile: "assets/js/mbb-frames.min.js", target: "es2020", format: "iife", bundle: true },
  { entry: "assets/css/strategy-experience.css", outfile: "assets/css/strategy-experience.min.css" },
  { entry: "assets/css/mbb-frames.css", outfile: "assets/css/mbb-frames.min.css" },
];

export async function compileAsset(spec, { write = true } = {}) {
  const result = await build({
    absWorkingDir: root,
    entryPoints: [spec.entry],
    outfile: spec.outfile,
    minify: true,
    charset: "utf8",
    legalComments: "none",
    logLevel: "silent",
    write,
    ...(spec.target ? { target: spec.target } : {}),
    ...(spec.format ? { format: spec.format } : {}),
    ...(spec.globalName ? { globalName: spec.globalName } : {}),
    ...(spec.bundle ? { bundle: true } : {}),
  });
  return result.outputFiles?.[0]?.contents ?? null;
}

export async function buildAssets({ syncRevision = true, write = true } = {}) {
  if (syncRevision) syncClientRevision();
  const outputs = new Map();
  for (const spec of assetBuildSpecs) {
    outputs.set(spec.outfile, await compileAsset(spec, { write }));
  }
  return outputs;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildAssets();
}
