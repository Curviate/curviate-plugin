// Each row plants one line in a fixture skill; check-copy must fail naming file and line, or pass.
// Run: node --test tools/
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TOOL = join(dirname(fileURLToPath(import.meta.url)), "check-copy.mjs");

// [name, skill, line, expected stderr substring | null for a pass]
const rows = [
  ["Motion", "curviate-search", "Start the Motion now.", 'old name "Motion"'],
  ["Contact list", "curviate-campaigns", "Pick a Contact list.", 'old name "Contact"'],
  ["contact_id", "curviate-inbox", "Pass `contact_id` here.", 'old name "contact_id"'],
  ["old variable", "curviate-campaigns", "Hi {{contact.first_name}}", 'old name "{{contact."'],
  ["old event", "curviate-inbox", "Subscribe to motion.replied.", 'old name "motion.replied"'],
  ["old refusal", "curviate-campaigns", "MOTION_NOT_STARTABLE means stop.", 'old name "MOTION_NOT_STARTABLE"'],
  ["old command", "curviate-search", "Run `curviate motion start`.", 'removed command "curviate motion"'],
  ["sender in an outreach skill", "curviate-campaigns", "Pick the sender.", 'banned word "sender"'],
  ["em dash", "curviate-search", "One \u2014 two.", "curviate/skills/curviate-search/SKILL.md:1"],
  ["Do-not-contact list", "curviate-leads", "Read the Do-not-contact list and DO_NOT_CONTACT.", null],
  ["contact as a verb", "curviate-campaigns", "Never contact them twice.", null],
  ["Campaign and Lead in an outreach skill", "curviate-campaigns", "A Campaign enrolls each Lead of a Lead list.", null],
  ["motion in the general sense", "curviate-search", "the motion of the market", null],
];

for (const [name, skill, line, expect] of rows) {
  test(name, () => {
    const dir = mkdtempSync(join(tmpdir(), "check-copy-"));
    mkdirSync(join(dir, "curviate", "skills", skill), { recursive: true });
    writeFileSync(join(dir, "curviate", "skills", skill, "SKILL.md"), line + "\n");
    const r = spawnSync(process.execPath, [TOOL], { encoding: "utf8", env: { ...process.env, CHECK_COPY_ROOT: dir } });
    if (expect === null) return assert.equal(r.status, 0, r.stderr);
    assert.equal(r.status, 1, `expected a failure: ${r.stdout}`);
    assert.ok(r.stderr.includes(`curviate/skills/${skill}/SKILL.md:1`), `no file and line in: ${r.stderr}`);
    assert.ok(r.stderr.includes(expect), `expected "${expect}" in: ${r.stderr}`);
  });
}
