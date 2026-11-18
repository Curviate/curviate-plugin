// Each row plants one defect in a fixture skill and expects check-skills
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
const BAD_OUT = "-:1:136 error R18 s.with.text: {FIRST_NAME} is not a variable; write {{lead.<field>}} or remove the braces. Write a variable with double braces, like {{first_name}}, or remove the braces. -> https://docs.curviate.com/reference/sequence-rules#r18";
const fence = (info, body) => "```" + info + "\n" + body + "\n```\n";
const CLEAN = [fence("json", SEQ), fence("json invalid", BAD), fence("text", BAD_OUT), "Say {{lead.extra.<key>}} here. Run `curviate campaign lint --file x.json`.\n", fence("bash", "curviate core profile me --json")].join("\n");

// [name, skill, markdown, expected stderr substring | null for a pass]
const rows = [
  ["clean", "curviate-campaigns", CLEAN, null],
  ["single-brace in a valid-looking fence", "curviate-campaigns", fence("json", BAD), "does not lint"],
  ["single-brace in a non-json fence", "curviate-campaigns", fence("text", "Hi {FIRST_NAME}").replace("text", "yaml"), "single-brace"],
  ["single-brace in prose", "curviate-campaigns", "Write {FIRST_NAME} here.\n", "single-brace"],
  ["invalid fence that lints clean", "curviate-campaigns", fence("json invalid", SEQ) + fence("text", ""), "exits 0, not 2"],
  ["invalid fence whose text differs", "curviate-campaigns", fence("json invalid", BAD) + fence("text", BAD_OUT.replace("braces", "brackets")), "text fence differs"],
  ["prose token that does not lint", "curviate-campaigns", "Use {{lead.firstName}} here.\n", "does not lint"],
  ["campaign variable in a fence", "curviate-campaigns", fence("json", SEQ.replace("{{first_name}}", "{{campaign.offer}}")), "removed variable"],
  ["removed command", "curviate-search", "Run `curviate campaign launch`.\n", "is not a command"],
  ["undeclared flag", "curviate-search", "Run `curviate campaign create --fil x.json`.\n", "--fil is not a flag"],
  ["too many positionals", "curviate-search", "Run `curviate core profile a b`.\n", "takes 1 positional"],
  ["secret flag in prose", "curviate-search", "Pass --cookies-file to it.\n", "secret-bearing flag"],
  ["--api-key anywhere", "curviate-search", fence("bash", "curviate doctor --api-key x"), "secret-bearing flag"],
  ["secret variable in prose", "curviate-search", "Set CURVIATE_LINKEDIN_PASSWORD first.\n", "secret-bearing variable"],
  ["checkpoint code", "curviate-search", "Run `curviate account checkpoint solve acc_1 --code 123456`.\n", "secret-bearing flag"],
  ["{{ in a core skill", "curviate-search", "Use {{lead.first_name}} here.\n", "`{{` in a core skill"],
  ["dead relative link", "curviate-search", "See [it](./nope.md).\n", "does not resolve"],
  ["a removed old-name command", "curviate-campaigns", "Run `curviate motion start mot_1`.\n", "is not a command"],
  ["a password echoed into mailbox connect (fence)", "curviate-accounts", fence("bash", "echo pw | curviate mailbox connect a@example.test"), "stdin fed to `curviate mailbox connect`"],
  ["a password echoed into mailbox connect (span)", "curviate-accounts", "Run `echo pw | curviate mailbox connect a@example.test`.\n", "stdin fed to `curviate mailbox connect`"],
  ["a password echoed into mailbox connect (prose)", "curviate-accounts", "Then echo pw | curviate mailbox connect a@example.test and wait.\n", "a secret piped into the CLI"],
  ["a here-string into mailbox reconnect", "curviate-accounts", fence("bash", "curviate mailbox reconnect mbx_1 <<< \"pw\""), "stdin fed to `curviate mailbox reconnect`"],
  ["a file redirected into mailbox reconnect", "curviate-accounts", fence("bash", "curviate mailbox reconnect mbx_1 < pw.txt"), "stdin fed to `curviate mailbox reconnect`"],
  ["--password in prose", "curviate-accounts", "Give it --password and go.\n", "secret-bearing flag"],
  ["the Connect link path passes", "curviate-accounts", "Run `curviate mailbox connect a@example.test --connection google_sign_in` and hand over the link.\n", null],
  ["a pipe into a command with no secret passes", "curviate-search", fence("bash", "cat x.json | curviate core profile me --json"), null],
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
  mkdirSync(join(dir, "curviate", "skills", "curviate-campaigns"), { recursive: true });
  writeFileSync(join(dir, "curviate", "skills", "curviate-campaigns", "SKILL.md"), fence("json", SEQ));
  writeFileSync(join(dir, "README.md"), "# fixture\n");
  const r = spawnSync(process.execPath, [TOOL], { encoding: "utf8", env: { ...process.env, CHECK_SKILLS_ROOT: dir, CURVIATE_CLI_BIN: join(dir, "nope") } });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no pinned CLI/);
});
