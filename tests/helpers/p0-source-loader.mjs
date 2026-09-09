import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const sourceRoot = new URL("../../src/", import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  const target = specifier.startsWith("@/")
    ? new URL(specifier.slice(2), sourceRoot)
    : specifier.startsWith(".") && context.parentURL?.startsWith(sourceRoot.href)
      ? new URL(specifier, context.parentURL)
      : null;
  if (target) {
    for (const suffix of ["", ".ts", ".tsx", ".js"]) {
      const candidate = new URL(target.href + suffix);
      if (existsSync(fileURLToPath(candidate))) return { url: candidate.href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith(sourceRoot.href) && /\.tsx?$/.test(url)) {
    const source = ts.transpileModule(await readFile(new URL(url), "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
      fileName: fileURLToPath(url),
    }).outputText;
    return { source, format: "module", shortCircuit: true };
  }
  return nextLoad(url, context);
}
