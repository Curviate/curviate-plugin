// The pinned CLI's command surface, read by check-skills.
//
// The pin is a commit (`cliPin` in package.json). The CLI is not published at that commit, and a
// git dependency installs neither its `commands.json` nor a built binary (package `files`, and a
// publish gate on the SDK pin), so the manifest is read straight from the commit, once, and cached
// under node_modules/.cache. ponytail: one fetch per pin, offline afterwards; when the CLI is
// published again, pin the version and read the installed package instead.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const pin = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).cliPin ?? "";
const m = pin.match(/^github:Curviate\/curviate-cli#([0-9a-f]{40})$/);
if (!m) throw new Error(`cliPin in package.json must be github:Curviate/curviate-cli#<40-hex commit>, got ${JSON.stringify(pin)}`);
export const SHA = m[1];

async function cached(file) {
  const dir = join(ROOT, "node_modules", ".cache", "curviate-cli", SHA);
  const at = join(dir, file);
  if (!existsSync(at)) {
    const url = `https://raw.githubusercontent.com/Curviate/curviate-cli/${SHA}/${file}`;
    let res;
    try { res = await fetch(url); } catch (e) { throw new Error(`cannot read the pinned CLI (${SHA}) and it is not cached: ${e.message}`); }
    if (!res.ok) throw new Error(`cannot read the pinned CLI (${SHA}): ${url} answered ${res.status}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(at, await res.text());
  }
  return JSON.parse(readFileSync(at, "utf8"));
}

const manifest = (await cached("commands.json")).commands;
export const VERSION = (await cached("package.json")).version;
export const PIN_LABEL = `${VERSION} (${SHA.slice(0, 7)})`;

// A group that only prints its subcommands is not runnable; a group with a positional is.
export const nodes = (manifest ?? []).filter((c) => !c.usageOnly).map((c) => {
  const path = c.path.join(" ");
  const own = c.args.filter((a) => a.type !== "positional");
  return {
    path,
    rel: path.replace(/^core /, ""),
    args: c.args.filter((a) => a.type === "positional").map((a) => a.name.toUpperCase()),
    // Own flags that take a value (a boolean flag does not); globals are valued unless listed in BOOLEAN_GLOBALS.
    valued: new Set(own.filter((a) => a.type !== "boolean").flatMap((a) => [`--${a.name}`, ...[a.alias ?? []].flat().map((x) => `--${x}`)])),
    // Own flags as help spells them (a default-true boolean is `--no-<name>`), then the global ones.
    ownFlags: own.map((a) => ({ name: "--" + (a.type === "boolean" && a.default === true ? "no-" : "") + a.name, bool: a.type === "boolean", required: Boolean(a.required) })),
    globals: c.globals.map((g) => "--" + g),
    // Every spelling the command takes: own flags (a boolean also as --no-x), aliases, globals, --help.
    accepts: new Set([...own.flatMap((a) => [`--${a.name}`, ...(a.type === "boolean" ? [`--no-${a.name}`] : []), ...[a.alias ?? []].flat().map((x) => `--${x}`)]),
      ...c.globals.map((g) => "--" + g), "--help"]),
  };
});
// Every command path, groups included, and the global flags (what a bare group accepts).
export const BOOLEAN_GLOBALS = new Set(["--json", "--verbose", "--beta", "--preview", "--all", "--help"]);
export const groups = new Map((manifest ?? []).map((c) => [c.path.join(" "), c]));
export const allGlobals = new Set((manifest ?? []).flatMap((c) => c.globals.map((g) => "--" + g)).concat("--help"));

// The walk is an instrument, so make it able to fail: an empty or truncated manifest would
// pass every invocation check.
const KNOWN = ["profile me", "inbox messages", "job publish", "search people", "connect received", "recruiter talent-search",
  "setup", "doctor", "recruiter job publish", "motion lint", "enrollment list", "account get", "team list"];
const missing = KNOWN.filter((k) => !nodes.some((n) => n.rel === k));
if (nodes.length === 0 || missing.length) {
  throw new Error(`the walk of CLI ${PIN_LABEL} yielded ${nodes.length} commands and lost: ${missing.join(", ") || "nothing known"}`);
}
for (const p of ["core job publish", "core recruiter job publish"]) {
  if (!nodes.find((n) => n.path === p)?.ownFlags.some((f) => f.name === "--mode" && f.required)) {
    throw new Error(`\`curviate ${p}\` must show a required --mode: the flag parse is broken`);
  }
}
