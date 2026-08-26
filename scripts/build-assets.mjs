import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncClientRevision } from "./sync-client-revision.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const assetBuildSpecs = [
  { entry: "assets/js/landing.js", outfile: "assets/js/landing.min.js", target: "es2020" },
  { entry: "assets/js/app.js", outfile: "assets/js/app.min.js", target: "es2020" },
  {
    entry: "assets/js/account-one-pagers.js",
    outfile: "assets/js/account-one-pagers.min.js",
    target: "es2020",
    format: "iife",
    globalName: "AccountStrategyViews",
  },
  { entry: "assets/js/company-profile.js", outfile: "assets/js/company-profile.min.js", target: "es2020" },
  { entry: "assets/js/strategy-spine.js", outfile: "assets/js/strategy-spine.min.js", target: "es2020", format: "iife" },
  { entry: "assets/js/strategy-experience.js", outfile: "assets/js/strategy-experience.min.js", target: "es2020", format: "iife" },
  { entry: "assets/css/landing.css", outfile: "assets/css/landing.min.css" },
  { entry: "assets/css/styles.css", outfile: "assets/css/styles.min.css" },
  { entry: "assets/css/company-profile.css", outfile: "assets/css/company-profile.min.css" },
  { entry: "assets/css/strategy-spine.css", outfile: "assets/css/strategy-spine.min.css" },
  { entry: "assets/css/strategy-experience.css", outfile: "assets/css/strategy-experience.min.css" },
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
