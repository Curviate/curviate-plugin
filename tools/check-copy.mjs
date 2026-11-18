#!/usr/bin/env node
// Fails on an em dash (U+2014) or en dash (U+2013) in any tracked text file.
// Everything in this repository is customer-facing copy, and that copy uses
// plain ASCII punctuation. Binary files (any NUL byte) are skipped.
// In every skill it fails on the old names the rename removed, case-sensitive and whole word: Contact,
// Contacts, Contact list(s), Motion, Motions, and the old keys and event names. Do-not-contact,
// DO_NOT_CONTACT and "contact" as a lowercase verb stay.
// In the outreach skills it also fails on words the product does not use: sender, workspace, dry run,
// substrate (whole words, case-insensitive).
// In every tracked file it fails on a removed command (the old contact and motion groups of the CLI).
//
// Usage: node tools/check-copy.mjs   (CHECK_COPY_ROOT: a fixture directory standing in for the repository)
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.CHECK_COPY_ROOT || ".";
const files = process.env.CHECK_COPY_ROOT
  ? readdirSync(BASE, { recursive: true }).filter((f) => statSync(join(BASE, f)).isFile()).map((f) => f.split("\\").join("/"))
  : execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const OUTREACH = /^curviate\/skills\/curviate-(campaigns|leads|unibox|accounts|playbooks)\//;
const SKILL = /^curviate\/skills\//;
const BANNED = /\b(senders?|workspaces?|dry[ -]runs?|substrates?)\b/i;
// The rename (Lead, Lead list, Campaign): no alias, so no old name in any skill.
const OLD_NAME = /\b(Contacts?|Motions?|contact_id|motion_[a-z_]+|MOTION_NOT_STARTABLE)\b|\{\{contact\.|\bmotion\.[a-z_]+|\bcontact\.connected\b/;
const ALLOWED = /do-not-contact|DO_NOT_CONTACT/gi;
const OLD_COMMAND = /\bcurviate (contact|motion)\b/;
let hits = 0;
for (const file of files) {
  const text = readFileSync(join(BASE, file), "utf8");
  if (text.includes("\0")) continue;
  text.split("\n").forEach((line, i) => {
    if (/[\u2013\u2014]/.test(line)) {
      hits++;
      console.error(`${file}:${i + 1}: ${line.trim()}`);
    }
    const bare = line.replace(ALLOWED, "");
    if (SKILL.test(file) && OLD_NAME.test(bare)) {
      hits++;
      console.error(`${file}:${i + 1}: old name "${bare.match(OLD_NAME)[0]}" (Lead, Lead list, Campaign): ${line.trim()}`);
    }
    if (OUTREACH.test(file) && BANNED.test(bare)) {
      hits++;
      console.error(`${file}:${i + 1}: banned word "${bare.match(BANNED)[0]}" in an outreach skill: ${line.trim()}`);
    }
    if (OLD_COMMAND.test(line) && !/^tools\/.*\.test\.mjs$/.test(file)) { // the checkers' own tests plant it
      hits++;
      console.error(`${file}:${i + 1}: removed command "${line.match(OLD_COMMAND)[0]}": ${line.trim()}`);
    }
  });
}
if (hits) {
  console.error(`check-copy: ${hits} line(s) with an em or en dash (use a colon, comma or hyphen), an old name in a skill, a banned word in an outreach skill or a removed command`);
  process.exit(1);
}
console.log(`check-copy: ${files.length} tracked files, no em or en dash`);
