#!/usr/bin/env node
// Fails on an em dash (U+2014) or en dash (U+2013) in any tracked text file.
// Everything in this repository is customer-facing copy, and that copy uses
// plain ASCII punctuation. Binary files (any NUL byte) are skipped.
// In the five outreach skills it also fails on words the product does not use
// (the old Contact and Motion words among them): whole words, case-insensitive.
// Do-not-contact stays. Other skills may use them.
// In every tracked file it fails on a removed command (the old contact and motion groups of the CLI).
//
// Usage: node tools/check-copy.mjs
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const OUTREACH = /^curviate\/skills\/curviate-(campaigns|leads|unibox|accounts|playbooks)\//;
const BANNED = /\b(contacts?|motions?|senders?|workspaces?|dry[ -]runs?|substrates?)\b/i;
const ALLOWED = /do-not-contact/gi;
const OLD_COMMAND = /\bcurviate (contact|motion)\b/;
let hits = 0;
for (const file of files) {
  const text = readFileSync(file, "utf8");
  if (text.includes("\0")) continue;
  text.split("\n").forEach((line, i) => {
    if (/[\u2013\u2014]/.test(line)) {
      hits++;
      console.error(`${file}:${i + 1}: ${line.trim()}`);
    }
    const bare = line.replace(ALLOWED, "");
    if (OUTREACH.test(file) && BANNED.test(bare)) {
      hits++;
      console.error(`${file}:${i + 1}: banned word "${bare.match(BANNED)[0]}" in an outreach skill: ${line.trim()}`);
    }
    if (OLD_COMMAND.test(line)) {
      hits++;
      console.error(`${file}:${i + 1}: removed command "${line.match(OLD_COMMAND)[0]}": ${line.trim()}`);
    }
  });
}
if (hits) {
  console.error(`check-copy: ${hits} line(s) with an em or en dash (use a colon, comma or hyphen), a banned word in an outreach skill or a removed command`);
  process.exit(1);
}
console.log(`check-copy: ${files.length} tracked files, no em or en dash`);
