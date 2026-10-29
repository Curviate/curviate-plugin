// Each row plants one defect (plugin/002 AC-011, AC-012, AC-014) in a fixture skill and expects check-skills
// to fail naming it; the clean row must pass. Rows that lint need the pinned CLI (CURVIATE_CLI_BIN).
// Run: node --test tools/
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TOOL = join(dirname(fileURLToPath(import.meta.url)), "check-skills.mjs");
const SEQ = '{"$schema":"https://docs.curviate.com/schemas/sequence/v1.json","on_reply":"end","steps":[{"id":"s","do":"message.send","with":{"text":"Hi {{first_name}}","fallback":"Hello"},"next":"end"}]}';
const BAD = SEQ.replace("{{first_name}}", "{FIRST_NAME}");
const BAD_OUT = "-:1:136 error R18 s.with.text: {FIRST_NAME} is not a variable; write {{contact.<field>}} or remove the braces. Write a variable with double braces, like {{first_name}}, or remove the braces. -> https://docs.curviate.com/reference/sequence-rules#r18";
const fence = (info, body) => "```" + info + "\n" + body + "\n```\n";
const CLEAN = [fence("json", SEQ), fence("json invalid", BAD), fence("text", BAD_OUT), "Say {{contact.extra.<key>}} here. Run `curviate motion lint --file x.json`.\n", fence("bash", "curviate core profile me --json")].join("\n");

// [name, skill, markdown, expected stderr substring | null for a pass]
const rows = [
  ["clean", "curviate-motions", CLEAN, null],
  ["single-brace in a valid-looking fence", "curviate-motions", fence("json", BAD), "does not lint"],
  ["single-brace in prose", "curviate-motions", "Write {FIRST_NAME} here.\n", "single-brace"],
  ["invalid fence that lints clean", "curviate-motions", fence("json invalid", SEQ) + fence("text", ""), "exits 0, not 2"],
  ["invalid fence whose text differs", "curviate-motions", fence("json invalid", BAD) + fence("text", BAD_OUT.replace("braces", "brackets")), "text fence differs"],
  ["prose token that does not lint", "curviate-motions", "Use {{contact.firstName}} here.\n", "does not lint"],
  ["motion variable in a fence", "curviate-motions", fence("json", SEQ.replace("{{first_name}}", "{{motion.offer}}")), "removed variable"],
  ["removed command", "curviate-search", "Run `curviate motion launch`.\n", "is not a command"],
  ["undeclared flag", "curviate-search", "Run `curviate motion create --fil x.json`.\n", "--fil is not a flag"],
  ["too many positionals", "curviate-search", "Run `curviate core profile a b`.\n", "takes 1 positional"],
  ["secret flag in prose", "curviate-search", "Pass --cookies-file to it.\n", "secret-bearing flag"],
  ["--api-key anywhere", "curviate-search", fence("bash", "curviate doctor --api-key x"), "secret-bearing flag"],
  ["secret variable in prose", "curviate-search", "Set CURVIATE_LINKEDIN_PASSWORD first.\n", "secret-bearing variable"],
  ["checkpoint code", "curviate-search", "Run `curviate account checkpoint solve acc_1 --code 123456`.\n", "secret-bearing flag"],
  ["{{ in a core skill", "curviate-search", "Use {{contact.first_name}} here.\n", "`{{` in a core skill"],
  ["secret flag inside a generated block passes", "curviate-search", "<!-- generated: command surface, CLI 0.49.0 -->\n| `curviate account link` | `--cookies-file` |\n<!-- /generated -->\n", null],
  ["dead relative link", "curviate-search", "See [it](./nope.md).\n", "does not resolve"],
];

for (const [name, skill, md, expect] of rows) {
  test(name, { skip: !process.env.CURVIATE_CLI_BIN && /```json|\{\{/.test(md) && "needs CURVIATE_CLI_BIN" }, () => {
    const dir = mkdtempSync(join(tmpdir(), "check-skills-"));
    mkdirSync(join(dir, "curviate", "skills", skill), { recursive: true });
    writeFileSync(join(dir, "curviate", "skills", skill, "SKILL.md"), md);
    writeFileSync(join(dir, "README.md"), "# fixture\n");
    const r = spawnSync(process.execPath, [TOOL], { encoding: "utf8", env: { ...process.env, CHECK_SKILLS_ROOT: dir } });
    if (expect === null) assert.equal(r.status, 0, r.stderr + r.stdout);
    else {
      assert.equal(r.status, 1, `expected a failure, got exit ${r.status}: ${r.stdout}${r.stderr}`);
      assert.ok(r.stderr.includes(expect), `expected "${expect}" in: ${r.stderr}`);
    }
  });
}

test("a missing or wrong CLI refuses to lint", { skip: !process.env.CURVIATE_CLI_BIN && "needs CURVIATE_CLI_BIN" }, () => {
  const dir = mkdtempSync(join(tmpdir(), "check-skills-"));
  mkdirSync(join(dir, "curviate", "skills", "curviate-motions"), { recursive: true });
  writeFileSync(join(dir, "curviate", "skills", "curviate-motions", "SKILL.md"), fence("json", SEQ));
  writeFileSync(join(dir, "README.md"), "# fixture\n");
  const r = spawnSync(process.execPath, [TOOL], { encoding: "utf8", env: { ...process.env, CHECK_SKILLS_ROOT: dir, CURVIATE_CLI_BIN: join(dir, "nope") } });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no pinned CLI/);
});
