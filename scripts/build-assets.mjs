import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile, rename, rm } from "node:fs/promises";
import { syncClientRevision } from "./sync-client-revision.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const assetBuildSpecs = [
  { entry: "assets/js/landing.js", outfile: "assets/js/landing.min.js", target: "es2020", format: "iife", bundle: true },
  { entry: "assets/js/app.js", outfile: "assets/js/app.min.js", target: "es2020", format: "iife", bundle: true },
  {
    entry: "assets/js/account-one-pagers.js",
    outfile: "assets/js/account-one-pagers.min.js",
    target: "es2020",
    format: "iife",
    globalName: "AccountStrategyViews",
  },
  { entry: "assets/js/company-profile.js", outfile: "assets/js/company-profile.min.js", target: "es2020" },
  { entry: "assets/js/mbb-frames.js", outfile: "assets/js/mbb-frames.min.js", target: "es2020", format: "iife", bundle: true },
  { entry: "assets/js/workload-translation.js", outfile: "assets/js/workload-translation.min.js", target: "es2020", format: "iife", bundle: true },
  { entry: "assets/js/strategy-experience.js", outfile: "assets/js/strategy-experience.min.js", target: "es2020", format: "iife", bundle: true },
  { entry: "assets/js/strategy-spine.js", outfile: "assets/js/strategy-spine.min.js", target: "es2020", format: "iife" },
  { entry: "assets/css/landing.css", outfile: "assets/css/landing.min.css" },
  { entry: "assets/css/brand-system.css", outfile: "assets/css/brand-system.min.css" },
  { entry: "assets/css/mbb-frames.css", outfile: "assets/css/mbb-frames.min.css" },
  { entry: "assets/css/workload-translation.css", outfile: "assets/css/workload-translation.min.css" },
  { entry: "assets/css/strategy-experience.css", outfile: "assets/css/strategy-experience.min.css" },
  { entry: "assets/css/strategy-spine.css", outfile: "assets/css/strategy-spine.min.css" },
  { entry: "assets/css/styles.css", outfile: "assets/css/styles.min.css" },
  { entry: "assets/css/company-profile.css", outfile: "assets/css/company-profile.min.css" },
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
    write: false,
    ...(spec.target ? { target: spec.target } : {}),
    ...(spec.format ? { format: spec.format } : {}),
    ...(spec.globalName ? { globalName: spec.globalName } : {}),
    ...(spec.bundle ? { bundle: true } : {}),
  });
  const contents = result.outputFiles?.[0]?.contents ?? null;
  if (write && contents) {
    const destination = path.join(root, spec.outfile);
    const previous = await readFile(destination).catch(() => null);
    if (!previous || !previous.equals(Buffer.from(contents))) {
      // Windows readers can briefly map the served asset. Stage then replace;
      // never truncate the working bundle while a browser or scanner reads it.
      const staged = `${destination}.${process.pid}.tmp`;
      try {
        await writeFile(staged, contents);
        for (let attempt = 0; ; attempt++) {
          try { await rename(staged, destination); break; }
          catch (error) {
            if (attempt >= 4 || !["EPERM", "EACCES", "EBUSY", "EEXIST"].includes(error.code)) throw error;
            await new Promise(resolve => setTimeout(resolve, 80 * (attempt + 1)));
          }
        }
      } finally { await rm(staged, { force: true }); }
    }
  }
  return contents;
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
