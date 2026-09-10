#!/usr/bin/env node
// Rewrites the mechanical command/flag tables in the skills from the pinned
// CLI's own --help. Hand-written prose outside the markers is never touched.
//
// Usage: node tools/generate-command-tables.mjs [--check]
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const PINNED = require(join(ROOT, "package.json")).devDependencies["@curviate/cli"];
if (!/^\d+\.\d+\.\d+$/.test(PINNED)) {
  throw new Error(`the @curviate/cli pin must be an exact version, got ${JSON.stringify(PINNED)}`);
}
const BIN = join(ROOT, "node_modules", ".bin", "curviate");
// Walk a real install, not an unpacked tarball: without its dependencies the CLI
// enumerates nothing, and an empty walk renders as a plausible empty table.
let installed;
try {
  installed = require(join(ROOT, "node_modules", "@curviate", "cli", "package.json")).version;
} catch {
  throw new Error(`no installed @curviate/cli under ${ROOT}/node_modules — run \`npm install\` first`);
}
if (installed !== PINNED) {
  throw new Error(`installed CLI is ${installed}, the repository pins ${PINNED} — install the pin first`);
}

// --- walk -------------------------------------------------------------------

function help(path) {
  return execFileSync(BIN, [...path, "--help"], { encoding: "utf8", env: { ...process.env, COLUMNS: "400" } });
}

// Sections are ALL-CAPS at column 0; each entry is "  NAME[ (required)]    description",
// the columns separated by four or more spaces. Anything else under a section is a
// shape this parser does not understand, and it must stop rather than drop the row.
function parseHelp(text, label) {
  const sections = {};
  let cur = null;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (line === "") continue;
    if (/^[A-Z][A-Z ]*$/.test(line)) { sections[(cur = line)] = []; continue; }
    if (/^\S/.test(line)) { cur = null; continue; }
    if (cur === null) continue;
    const m = line.match(/^\s{2,}(\S(?:.*?\S)?)( \(required\))?\s{4,}(\S.*)$/);
    if (!m) throw new Error(`unparseable ${cur} line under \`${label}\`: ${JSON.stringify(line)}`);
    // A flag with a default prints as `--profile="default"`; the name is the part
    // before the `=`, so it compares equal to the same flag elsewhere.
    sections[cur].push({ name: m[1].replace(/=.*$/, ""), required: Boolean(m[2]) });
  }
  return sections;
}

// A node with no COMMANDS is a leaf. A node WITH commands that also declares
// ARGUMENTS is itself runnable (`curviate profile <ID>`), so it is emitted too.
const nodes = [];
function walk(path) {
  const label = ["curviate", ...path].join(" ");
  const s = parseHelp(help(path), label);
  const subs = s.COMMANDS ?? [];
  const args = s.ARGUMENTS ?? [];
  if (subs.length === 0 || args.length > 0) {
    nodes.push({ path: path.join(" "), args, flags: s.OPTIONS ?? [], leaf: subs.length === 0 });
  }
  for (const c of subs) walk([...path, c.name]);
}
walk([]);

// --- the walk is an instrument, so make it able to fail ---------------------

const leaves = nodes.filter((n) => n.leaf);
const KNOWN = ["profile me", "inbox messages", "job publish", "search people", "connect received",
  "recruiter talent-search", "setup", "doctor", "recruiter job publish"];
const missing = KNOWN.filter((k) => !leaves.some((n) => n.path === k));
if (missing.length) throw new Error(`the walk lost known commands: ${missing.join(", ")}`);
const EXPECTED_LEAVES = 149;
if (leaves.length !== EXPECTED_LEAVES) {
  throw new Error(`walked ${leaves.length} leaf commands, expected ${EXPECTED_LEAVES}. Either the CLI ` +
    `surface changed (update EXPECTED_LEAVES with the new pin) or the walk is truncated — check which.`);
}
// Positive controls on the flag parse. An OPTIONS block that silently came back
// empty would still render a plausible-looking table of bare command names, so
// pin two facts that are true of this surface and cheap to check.
const takes = (flag) => nodes.filter((n) => n.flags.some((f) => f.name === flag)).map((n) => n.path).sort();
const RETRIEVAL = ["inbox get", "inbox messages", "profile", "profile me"];
for (const flag of ["--mode", "--max-age"]) {
  const got = takes(flag).filter((p) => !p.startsWith("job ") && !p.startsWith("recruiter job "));
  if (String(got) !== String(RETRIEVAL)) {
    throw new Error(`${flag} should be accepted by exactly ${RETRIEVAL.join(", ")}; walked ${got.join(", ") || "nothing"}`);
  }
}
for (const p of ["job publish", "recruiter job publish"]) {
  const mode = nodes.find((n) => n.path === p)?.flags.find((f) => f.name === "--mode");
  if (!mode?.required) throw new Error(`\`curviate ${p}\` must show a required --mode; walked ${JSON.stringify(mode)}`);
}

// --- route each command to exactly one skill --------------------------------

// First match wins. Every command must match something; an unrouted one is a
// new CLI area that needs a home, not a row to drop silently.
const ROUTES = [
  ["setup", "curviate-quickstart"], ["doctor", "curviate-quickstart"], ["login", "curviate-quickstart"],
  ["profile follow", "curviate-network"], ["profile unfollow", "curviate-network"],
  ["profile relations", "curviate-network"], ["profile followers", "curviate-network"],
  ["profile following", "curviate-network"], ["connect", "curviate-network"],
  ["search parameters", "curviate-profile"], ["search service-parameters", "curviate-profile"],
  ["profile", "curviate-profile"], ["company", "curviate-profile"],
  ["config", "curviate-profile"], ["account", "curviate-profile"],
  ["search", "curviate-search"], ["group", "curviate-search"],
  ["inbox", "curviate-inbox"], ["inboxes", "curviate-inbox"],
  ["message", "curviate-inbox"], ["webhook", "curviate-inbox"],
  ["post", "curviate-engage"], ["comment", "curviate-engage"],
  ["feed", "curviate-engage"], ["notification", "curviate-engage"],
  ["job", "curviate-jobs"],
  ["sales-nav", "curviate-premium"], ["recruiter", "curviate-premium"],
];
const bySkill = new Map();
for (const node of nodes) {
  const hit = ROUTES.find(([p]) => node.path === p || node.path.startsWith(p + " "));
  if (!hit) throw new Error(`no skill owns \`curviate ${node.path}\` — add it to ROUTES`);
  if (!bySkill.has(hit[1])) bySkill.set(hit[1], []);
  bySkill.get(hit[1]).push(node);
}

// --- render -----------------------------------------------------------------

const code = (s) => "`" + s.replace(/\|/g, "\\|") + "`";

function render(skill) {
  const rows = bySkill.get(skill);
  if (!rows?.length) throw new Error(`no commands routed to ${skill}`);
  // Flags every row in this skill accepts, stated once instead of on each row.
  // Computed per skill because `setup` and `doctor` are local commands and take
  // far fewer flags than the API-calling ones.
  const withFlags = rows.filter((n) => n.flags.length > 0);
  const shared = withFlags[0].flags
    .map((f) => f.name)
    .filter((name) => withFlags.every((n) => n.flags.some((f) => f.name === name)))
    .sort();
  const lines = [
    `Read from the CLI's own \`--help\` at version ${PINNED}. Descriptions, traps and confidence`,
    `tags elsewhere in this skill are hand-written and carry the version they were established against.`,
    "",
    `Every command below that takes flags at all also accepts ${shared.map(code).join(", ")}.`,
    "",
    "| Command | Arguments | Flags |",
    "|---|---|---|",
  ];
  for (const n of rows) {
    // --help never marks an argument required, so this does not claim it either.
    const args = n.args.map((a) => code(a.name)).join(" ") || "\u2014";
    const flags = n.flags
      .filter((f) => !shared.includes(f.name))
      .map((f) => code(f.name) + (f.required ? " *(required)*" : ""))
      .join(", ") || "\u2014";
    lines.push(`| ${code("curviate " + n.path)} | ${args} | ${flags} |`);
  }
  return lines.join("\n");
}

// --- splice between the markers ---------------------------------------------

const OPEN = `<!-- generated: command surface, CLI ${PINNED} -->`;
const CLOSE = "<!-- /generated -->";
const OPEN_RE = /<!-- generated: command surface, CLI [^>]*-->/;

const check = process.argv.includes("--check");
let stale = 0;
for (const skill of bySkill.keys()) {
  const file = join(ROOT, "curviate", "skills", skill, "SKILL.md");
  const before = readFileSync(file, "utf8");
  const open = before.match(OPEN_RE);
  const closeAt = before.indexOf(CLOSE);
  if (!open || closeAt < 0 || closeAt < open.index) {
    throw new Error(`${skill}/SKILL.md has no generated block — insert the marker pair where the table belongs`);
  }
  const after = before.slice(0, open.index) + `${OPEN}\n\n${render(skill)}\n\n` + before.slice(closeAt);
  if (after === before) continue;
  stale++;
  if (check) console.error(`stale: curviate/skills/${skill}/SKILL.md`);
  else { writeFileSync(file, after); console.log(`wrote: curviate/skills/${skill}/SKILL.md`); }
}

console.log(`${leaves.length} leaf commands, ${nodes.length} runnable commands, CLI ${PINNED}`);
if (check && stale) {
  console.error(`\n${stale} skill file(s) do not match the generator's output for CLI ${PINNED}.`);
  process.exit(1);
}
if (check) console.log("committed tables are byte-identical to the generator's output.");
