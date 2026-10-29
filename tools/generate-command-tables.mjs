#!/usr/bin/env node
// Rewrites the mechanical command/flag tables in the skills from the pinned
// CLI's command manifest (tools/cli-surface.mjs). Hand-written prose outside the markers is never touched.
//
// Usage: node tools/generate-command-tables.mjs [--check]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, PIN_LABEL, nodes } from "./cli-surface.mjs";

// --- route each command to exactly one skill --------------------------------

// First match wins, on the full command path (`core notification` and `notification` are two
// groups). Every command must match something; an unrouted one is a new CLI area that needs a
// home, not a row to drop silently. `null` = deliberately no table yet.
const ROUTES = [
  ["setup", "curviate-quickstart"], ["doctor", "curviate-quickstart"], ["login", "curviate-quickstart"],
  ["core profile follow", "curviate-network"], ["core profile unfollow", "curviate-network"],
  ["core profile relations", "curviate-network"], ["core profile followers", "curviate-network"],
  ["core profile following", "curviate-network"], ["core connect", "curviate-network"],
  ["network", "curviate-network"],
  ["core search parameters", "curviate-profile"], ["core search service-parameters", "curviate-profile"],
  ["core profile", "curviate-profile"], ["core company", "curviate-profile"],
  ["config", "curviate-profile"],
  // plugin/002 FR-001 moves `account` to `curviate-accounts`; until that skill exists it stays here.
  ["account", "curviate-profile"],
  ["core search", "curviate-search"], ["core group", "curviate-search"],
  ["core inbox", "curviate-inbox"], ["core inboxes", "curviate-inbox"],
  ["core message", "curviate-inbox"], ["webhook", "curviate-inbox"],
  ["core post", "curviate-engage"], ["core comment", "curviate-engage"],
  ["core feed", "curviate-engage"], ["core notification", "curviate-engage"], ["core draft", "curviate-engage"],
  ["core job", "curviate-jobs"],
  ["core sales-nav", "curviate-premium"], ["core recruiter", "curviate-premium"],
  // Homes that are not written yet (plugin/002 FR-001). Route each there when its skill exists, so
  // no other skill lists them: curviate-motions, -contacts, -accounts.
  ["motion", null], ["enrollment", null], ["analytics", null], ["export", null], ["incoming", null],
  ["contact", null], ["do-not-contact", null], ["unibox", "curviate-unibox"],
  ["notification", null], ["team", null],
  // Owner-level commands no skill teaches yet.
  ["billing", null], ["tier", null], ["beta", null],
];
const bySkill = new Map();
for (const node of nodes) {
  const hit = ROUTES.find(([p]) => node.path === p || node.path.startsWith(p + " "));
  if (!hit) throw new Error(`no skill owns \`curviate ${node.path}\`: add it to ROUTES`);
  if (hit[1] === null) continue;
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
  const flagsOf = (n) => [...n.globals.map((name) => ({ name })), ...n.ownFlags];
  const withFlags = rows.filter((n) => flagsOf(n).length > 0);
  const shared = flagsOf(withFlags[0])
    .map((f) => f.name)
    .filter((name) => withFlags.every((n) => flagsOf(n).some((f) => f.name === name)))
    .sort();
  const lines = [
    `Read from the CLI's own command manifest at version ${PIN_LABEL}. Descriptions, traps and confidence`,
    `tags elsewhere in this skill are hand-written and carry the version they were established against.`,
    "",
    `Every command below that takes flags at all also accepts ${shared.map(code).join(", ")}.`,
    "",
    "| Command | Arguments | Flags |",
    "|---|---|---|",
  ];
  for (const n of rows) {
    // The manifest does not mark an argument required, so this does not claim it either.
    const args = n.args.map(code).join(" ") || "*(none)*";
    const flags = flagsOf(n)
      .filter((f) => !shared.includes(f.name))
      .map((f) => code(f.name) + (f.required ? " *(required)*" : ""))
      .join(", ") || "*(none)*";
    lines.push(`| ${code("curviate " + n.path)} | ${args} | ${flags} |`);
  }
  return lines.join("\n");
}

// --- splice between the markers ---------------------------------------------

const OPEN = `<!-- generated: command surface, CLI ${PIN_LABEL} -->`;
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
    throw new Error(`${skill}/SKILL.md has no generated block: insert the marker pair where the table belongs`);
  }
  const after = before.slice(0, open.index) + `${OPEN}\n\n${render(skill)}\n\n` + before.slice(closeAt);
  if (after === before) continue;
  stale++;
  if (check) console.error(`stale: curviate/skills/${skill}/SKILL.md`);
  else { writeFileSync(file, after); console.log(`wrote: curviate/skills/${skill}/SKILL.md`); }
}

console.log(`${nodes.length} runnable commands, CLI ${PIN_LABEL}`);
if (check && stale) {
  console.error(`\n${stale} skill file(s) do not match the generator's output for CLI ${PIN_LABEL}.`);
  process.exit(1);
}
if (check) console.log("committed tables are byte-identical to the generator's output.");
