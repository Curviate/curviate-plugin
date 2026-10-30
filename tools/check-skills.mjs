#!/usr/bin/env node
// plugin/002 FR-011 (examples are executed, not trusted) and FR-012 (relative links), over every
// tracked *.md and *.json file of the skills, and the README for links.
//
//   all skills        every `curviate ...` invocation (bash/sh fences, code spans) resolves to a command
//                     path at the pin and uses only flags declared on that command; no secret-bearing
//                     flag or variable in hand-written text; no `{{` in a core skill; every CLI group
//                     is named by some skill, so a new area cannot ship with no home
//   the five outreach json fences lint clean, `json invalid` fences fail with the text fence that
//   skills            follows, prose {{...}} tokens lint, single-brace placeholders only in invalid fences
//
// The lint step runs the pinned CLI's `motion lint` (never a second validator): CURVIATE_CLI_BIN, else
// node_modules/.bin/curviate. It is needed only once an outreach skill carries an example.
// Usage: node tools/check-skills.mjs
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { ROOT, VERSION, PIN_LABEL, nodes, groups, allGlobals, BOOLEAN_GLOBALS } from "./cli-surface.mjs";

const NEW5 = ["curviate-motions", "curviate-contacts", "curviate-unibox", "curviate-accounts", "curviate-playbooks"];
// CHECK_SKILLS_ROOT: a directory of fixture files standing in for the repository (the test seam).
const BASE = process.env.CHECK_SKILLS_ROOT || ROOT;
const tracked = process.env.CHECK_SKILLS_ROOT
  ? readdirSync(BASE, { recursive: true }).filter((f) => statSync(join(BASE, f)).isFile()).map((f) => f.split("\\").join("/"))
  : execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" }).split("\0").filter(Boolean);
const trackedSet = new Set(tracked);
const skillFiles = tracked.filter((f) => /^curviate\/skills\/[^/]+\/.*\.(md|json)$/.test(f));
const linkFiles = [...skillFiles.filter((f) => f.endsWith(".md")), "README.md"];

const errors = [];
const fail = (file, line, msg) => errors.push(`${file}:${line}: ${msg}`);

// --- the CLI's lint ---------------------------------------------------------

let bin;
function lint(doc) {
  if (!bin) {
    bin = process.env.CURVIATE_CLI_BIN || join(ROOT, "node_modules", ".bin", "curviate");
    if (!existsSync(bin)) {
      throw new Error(`no pinned CLI to run \`motion lint\` with: set CURVIATE_CLI_BIN to the build of ${PIN_LABEL} (or install it at node_modules/.bin/curviate)`);
    }
    const v = run(["--version"]).stdout.trim();
    if (v !== VERSION) throw new Error(`the CLI at ${bin} is ${v}, the pin ${PIN_LABEL} is ${VERSION}`);
  }
  const r = run(["motion", "lint", "--file", "-"], doc);
  // Findings are on stderr, one per line, as the CLI prints them for a person.
  return { code: r.status, lines: r.stderr.split("\n").map((l) => l.trimEnd()).filter(Boolean) };
}
const run = (args, input) => (bin.endsWith(".js") ? spawnSync(process.execPath, [bin, ...args], { encoding: "utf8", input }) : spawnSync(bin, args, { encoding: "utf8", input }));

// --- markdown: fences and spans ---------------------------------------------

function parse(text) {
  const lines = text.split("\n");
  const fences = [], prose = [];
  let cur = null;
  lines.forEach((raw, i) => {
    const f = raw.match(/^\s*(`{3,}|~{3,})\s*(.*)$/);
    if (cur) {
      if (f && f[1][0] === cur.mark[0] && f[1].length >= cur.mark.length && f[2] === "") { fences.push(cur); cur = null; }
      else cur.body.push(raw);
      return;
    }
    if (f) { cur = { mark: f[1], info: f[2].trim(), line: i + 1, body: [] }; return; }
    prose.push({ line: i + 1, text: raw });
  });
  if (cur) fences.push(cur);
  const spans = prose.flatMap((p) => [...p.text.matchAll(/`([^`]+)`/g)].map((m) => ({ line: p.line, text: m[1].replace(/\\\|/g, "|") })));
  return { fences, prose, spans };
}

// --- shell-ish invocations --------------------------------------------------

const OPS = new Set(["|", "||", "&&", ";", "&"]);
function tokens(line) {
  line = line.replace(/<(?![<\s=])[^<>]*>/g, "<p>"); // <https url> is one placeholder
  const out = [];
  let t = "", q = null, has = false;
  const push = () => { if (has) out.push(t); t = ""; has = false; };
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === q) q = null; else if (c === "\\" && q === '"' && i + 1 < line.length) t += line[++i]; else t += c; continue; }
    if (c === "'" || c === '"') { q = c; has = true; continue; }
    if (c === "\\" && i + 1 < line.length) { t += line[++i]; has = true; continue; }
    if (/\s/.test(c)) { push(); continue; }
    if (c === "#" && !has) break;
    if ("|;&".includes(c)) { push(); let op = c; while ("|&".includes(line[i + 1] ?? "") && op.length < 2 && line[i + 1] === c) op += line[++i]; out.push(op); continue; }
    t += c; has = true;
  }
  push();
  return out;
}

// Logical shell lines of a fence: backslash continuations joined, heredoc bodies dropped.
function shellLines(body) {
  const out = [];
  let acc = "", here = null, from = 0;
  body.forEach((raw, k) => {
    if (here) { if (raw.trim() === here) here = null; return; }
    if (acc === "") from = k;
    const joined = acc + raw;
    if (/\\\s*$/.test(joined)) { acc = joined.replace(/\\\s*$/, " "); return; }
    acc = "";
    const h = joined.match(/<<-?\s*['"]?(\w+)['"]?/);
    if (h) here = h[1];
    out.push({ text: joined, k: from });
  });
  return out;
}

const PATHS = new Map(nodes.map((n) => [n.path, n]));
const SECRET_FLAGS = /--(?:api-key|password(?:-stdin)?|li-at(?:-stdin)?|li-a|cookies-file|proxy-password)(?![\w-])/;
const SECRET_ENV = /\b(?:CURVIATE_LINKEDIN_PASSWORD|CURVIATE_LINKEDIN_LI_AT|CURVIATE_LINKEDIN_LI_A|CURVIATE_PROXY_PASSWORD)\b/;
let invocations = 0;

const named = new Set();
const AREA = (path) => path.split(" ").slice(0, path.startsWith("core ") ? 2 : 1).join(" ");
function checkInvocation(file, line, toks) {
  invocations++;
  // The path is the leading words that walk the command tree; what follows are flags and positionals.
  // A command with positionals may take them before a subcommand (`core company <id> posts`), so up to
  // that many words that do not extend the path are skipped when a later word does.
  let path = "", i = 0;
  const isWord = (t) => !t.startsWith("-");
  const words = toks.map((t) => t.replace(/^\[+|\]+$/g, ""));
  const skipped = new Set();
  for (; i < words.length; i++) {
    if (!isWord(words[i])) continue;
    const next = (path + " " + words[i]).trim();
    if (groups.has(next)) { path = next; continue; }
    const room = (PATHS.get(path)?.args.length ?? 0) - skipped.size;
    const ahead = words.findIndex((w, k) => k > i && isWord(w) && groups.has((path + " " + w).trim()));
    if (room > 0 && ahead > i && words.slice(i, ahead).filter(isWord).length <= room) {
      for (let k = i; k < ahead; k++) if (isWord(words[k])) skipped.add(k);
      i = ahead - 1;
      continue;
    }
    break;
  }
  if (path) named.add(AREA(path));
  const shown = `curviate ${path}`.trim();
  const node = PATHS.get(path);
  const placeholder = (t) => /^<[^<>\s]+>$/.test(t) || t === "..." || t === "\u2026" || /^[A-Z_]+$/.test(t);
  const ok = node ? node.accepts : allGlobals;
  let positionals = 0;
  for (let j = 0; j < toks.length; j++) {
    const t = toks[j].replace(/^\[+|\]+$/g, "");
    if (j < i && !t.startsWith("-") && !skipped.has(j)) continue; // a word of the path
    if (!t.startsWith("-") || t === "-") { if (t !== "" && t !== "..." && t !== "\u2026") positionals++; continue; }
    const name = t.replace(/=.*$/, "");
    if (!name.startsWith("--")) continue;
    if (name === "--version" && path === "") continue;
    if (!ok.has(name)) fail(file, line, `${name} is not a flag of \`${shown}\` at CLI ${PIN_LABEL}`);
    else if (!t.includes("=") && (node ? node.valued.has(name) : false) || (!t.includes("=") && node && ok.has(name) && !node.valued.has(name) && !BOOLEAN_GLOBALS.has(name) && node.globals.includes(name))) j++;
  }
  if (!node && positionals && !toks.slice(i).every((t) => t.startsWith("-") || placeholder(t.replace(/^\[+|\]+$/g, "")))) {
    fail(file, line, `\`${shown} ${toks[i]}\` is not a command at CLI ${PIN_LABEL}`);
  } else if (node && positionals > node.args.length && !toks.some((t) => /\.\.\.\]?$/.test(t))) {
    fail(file, line, `\`${shown}\` takes ${node.args.length} positional(s) (${node.args.join(" ") || "none"}), got ${positionals}`);
  }
  if (path === "account checkpoint solve" && toks.some((f) => f.startsWith("--code"))) fail(file, line, "--code on `account checkpoint solve` is a secret-bearing flag");
}

function scanSegments(file, line, toks) {
  let seg = [];
  const flush = () => {
    while (seg.length && (seg[0] === "$" || /^\w+=/.test(seg[0]))) seg.shift();
    if (seg[0] === "curviate") checkInvocation(file, line, seg.slice(1));
    seg = [];
  };
  for (const t of toks) { if (OPS.has(t)) flush(); else seg.push(t); }
  flush();
}

// --- single-brace placeholder (api/040 R18) and {{...}} tokens --------------

const SINGLE = /(?<![{$])\{[A-Za-z_][\w.]*\}(?!\})/;
const SEQ = (text) => JSON.stringify({ $schema: "https://docs.curviate.com/schemas/sequence/v1.json", on_reply: "end", steps: [{ id: "s", do: "message.send", with: { text, fallback: "Hello" }, next: "end" }] });

// --- per file ---------------------------------------------------------------

let fences = 0, tokensLinted = 0;
for (const file of skillFiles) {
  const skill = file.split("/")[2];
  const outreach = NEW5.includes(skill);
  const { fences: fs, prose, spans } = parse(readFileSync(join(BASE, file), "utf8"));
  const handwritten = [...prose.map((p) => p), ...fs.flatMap((f) => f.body.map((text, k) => ({ line: f.line + 1 + k, text })))];

  for (const { line, text } of handwritten) {
    if (SECRET_FLAGS.test(text)) fail(file, line, `secret-bearing flag in hand-written text: ${text.match(SECRET_FLAGS)[0]}`);
    if (SECRET_ENV.test(text)) fail(file, line, `secret-bearing variable in hand-written text: ${text.match(SECRET_ENV)[0]}`);
    if (!outreach && text.includes("{{")) fail(file, line, "`{{` in a core skill");
  }

  for (const f of fs) {
    if (/^(bash|sh|shell|console)$/.test(f.info)) {
      shellLines(f.body).forEach((l) => scanSegments(file, f.line + 1 + l.k, tokens(l.text.replace(/^\s*\$\s+/, ""))));
    }
  }
  for (const s of spans) if (/^curviate\s/.test(s.text)) scanSegments(file, s.line, tokens(s.text));

  if (!outreach) continue;
  fs.forEach((f, k) => {
    const doc = f.body.join("\n");
    if (f.info === "json") {
      fences++;
      const r = lint(doc);
      if (r.code !== 0) fail(file, f.line, `json fence does not lint: ${r.lines[0] ?? "exit " + r.code}`);
      else if (r.lines.some((l) => / warning W13 /.test(l))) fail(file, f.line, "json fence uses a removed variable (W13)");
    } else if (f.info === "json invalid") {
      fences++;
      const r = lint(doc), next = fs[k + 1];
      if (r.code !== 2) fail(file, f.line, `json invalid fence exits ${r.code}, not 2`);
      else if (!next || next.info !== "text" || prose.some((p) => p.line > f.line + f.body.length + 1 && p.line < next.line && p.text.trim())) fail(file, f.line, "json invalid fence is not followed by a text fence");
      else if (next.body.map((l) => l.trimEnd()).filter(Boolean).join("\n") !== r.lines.join("\n")) fail(file, next.line, "text fence differs from lint's output for the invalid fence above it");
    } else if (f.info !== "text" && SINGLE.test(doc)) fail(file, f.line, "single-brace placeholder outside a `json invalid` fence");
  });
  for (const { line, text } of prose) {
    if (SINGLE.test(text)) fail(file, line, "single-brace placeholder outside a `json invalid` fence");
    for (const m of text.matchAll(/\{\{[^{}]*\}\}/g)) {
      tokensLinted++;
      const r = lint(SEQ(m[0].replace(/<[^<>]+>/g, "key")));
      if (r.code !== 0 || r.lines.some((l) => / warning W13 /.test(l))) fail(file, line, `${m[0]} does not lint: ${r.lines[0] ?? "exit " + r.code}`);
    }
  }
}

// --- FR-012: relative links resolve to tracked files ------------------------

let links = 0;
for (const file of linkFiles) {
  const { prose } = parse(readFileSync(join(BASE, file), "utf8"));
  for (const { line, text } of prose) {
    for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const href = m[1];
      if (/^([a-z][a-z0-9+.-]*:|#)/i.test(href)) continue;
      links++;
      const target = normalize(join(dirname(file), href.replace(/[#?].*$/, ""))).replace(/\/$/, "");
      if (!trackedSet.has(target) && !tracked.some((t) => t.startsWith(target + "/"))) fail(file, line, `relative link ${href} does not resolve to a tracked file`);
    }
  }
}

if (!process.env.CHECK_SKILLS_ROOT) {
  for (const area of new Set(nodes.map((n) => AREA(n.path)))) if (!named.has(area)) fail("curviate/skills", 0, `no skill names \`curviate ${area}\`: a CLI area with no home`);
}
if (invocations === 0 && !process.env.CHECK_SKILLS_ROOT) throw new Error("no `curviate` invocation found in any skill: the scan is broken, not the skills clean");
if (errors.length) {
  console.error(errors.join("\n"));
  console.error(`\ncheck-skills: ${errors.length} problem(s) against CLI ${PIN_LABEL}`);
  process.exit(1);
}
console.log(`check-skills: ${skillFiles.length} skill files, ${invocations} invocations resolved, ${fences} fences and ${tokensLinted} tokens linted, ${links} relative links, CLI ${PIN_LABEL}`);
