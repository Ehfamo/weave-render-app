import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const extensions = [".ts", ".tsx", ".js", ".jsx", ".json", ".css"];
const files = fs.readdirSync("src", { recursive: true }).map((p) => path.join("src", p));
const graph = new Map();
const missing = [];
for (const file of files.filter((p) => /\.[jt]sx?$/.test(p))) {
  const ast = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const edges = [];
  function visit(node) {
    let specifier;
    let typeOnly = false;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      specifier = node.moduleSpecifier;
      typeOnly = node.isTypeOnly || node.importClause?.isTypeOnly;
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      specifier = node.arguments[0];
    }
    if (specifier && ts.isStringLiteral(specifier)) {
      const spec = specifier.text.split("?")[0];
      if (spec.startsWith("@/") || spec.startsWith(".")) {
        const base = path.resolve(
          spec.startsWith("@/") ? "src" : path.dirname(file),
          spec.startsWith("@/") ? spec.slice(2) : spec,
        );
        const candidates = [
          base,
          ...extensions.map((ext) => base + ext),
          ...extensions.map((ext) => path.join(base, "index" + ext)),
        ];
        const resolved = candidates.find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
        if (!resolved) missing.push({ file, spec });
        else if (!typeOnly && /\.[jt]sx?$/.test(resolved))
          edges.push(path.relative(root, resolved));
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  graph.set(file, edges);
}
const state = new Map();
const stack = [];
const cycles = [];
function walk(node) {
  if (state.get(node) === 2) return;
  if (state.get(node) === 1) {
    cycles.push([...stack.slice(stack.indexOf(node)), node]);
    return;
  }
  state.set(node, 1);
  stack.push(node);
  for (const edge of graph.get(node) ?? []) walk(edge);
  stack.pop();
  state.set(node, 2);
}
for (const node of graph.keys()) walk(node);
const canonical = [
  "core-workflows.ts",
  "platform-contracts.ts",
  "product-architecture.ts",
  "ProductWorkspacePreview.tsx",
];
const identityCounts = Object.fromEntries(
  canonical.map((name) => [name, files.filter((file) => path.basename(file) === name).length]),
);
const routeTreePresent = fs.existsSync("src/routeTree.gen.ts");
console.log(JSON.stringify({ missing, cycles, identityCounts, routeTreePresent }, null, 2));
if (
  missing.length ||
  cycles.length ||
  Object.values(identityCounts).some((count) => count !== 1) ||
  !routeTreePresent
)
  process.exitCode = 1;
