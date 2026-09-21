import {readdir, readFile, writeFile} from "node:fs/promises";
import {extname, join} from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = fileURLToPath(new URL("../knowledge/", import.meta.url));
const OUTPUT = fileURLToPath(new URL("../src/knowledge.generated.js", import.meta.url));
const CHECK = process.argv.includes("--check");

function parseDocument(text, path) {
  const blocks = text.split(/^## /m).slice(1);
  const entries = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    const id = String(lines.shift() || "").trim();
    const meta = {};

    while (lines.length) {
      const line = lines.shift();
      if (line === "") break;
      const colon = line.indexOf(":");
      if (colon < 1) throw new Error("Invalid metadata in " + path + ": " + line);
      const key = line.slice(0, colon).trim();
      const raw = line.slice(colon + 1).trim();
      meta[key] = JSON.parse(raw);
    }

    const answer = lines.join("\n").trim();
    if (!id || !meta.title || !Number.isInteger(meta.order) || !answer) {
      throw new Error("Incomplete knowledge entry in " + path + ": " + id);
    }

    entries.push({
      order: meta.order,
      id,
      title: String(meta.title),
      aliases: Array.isArray(meta.aliases) ? meta.aliases.map(String) : [],
      keywords: Array.isArray(meta.keywords) ? meta.keywords.map(String) : [],
      answer
    });
  }

  return entries;
}

const names = (await readdir(ROOT))
  .filter(name => extname(name) === ".md")
  .sort();

const entries = [];
const ids = new Set();
for (const name of names) {
  const path = join(ROOT, name);
  for (const entry of parseDocument(await readFile(path, "utf8"), path)) {
    if (ids.has(entry.id)) throw new Error("Duplicate knowledge id: " + entry.id);
    ids.add(entry.id);
    entries.push(entry);
  }
}

entries.sort((a,b) => a.order - b.order);
const compiled = entries.map(({order, ...entry}) => entry);

const output =
  "// GENERATED FILE. Source of truth: worker/knowledge/*.md\n" +
  "// Run: node scripts/build-knowledge.mjs\n" +
  "export const SUPPORT_KB = Object.freeze(" +
  JSON.stringify(compiled, null, 2) +
  ");\n";

if (CHECK) {
  const existing = await readFile(OUTPUT, "utf8").catch(() => "");
  if (existing !== output) {
    console.error("Knowledge index is stale. Run node scripts/build-knowledge.mjs");
    process.exitCode = 1;
  } else {
    console.log("OK: knowledge index current (" + compiled.length + " entries)");
  }
} else {
  await writeFile(OUTPUT, output, "utf8");
  console.log("Built knowledge index: " + compiled.length + " entries");
}
