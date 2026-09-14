#!/usr/bin/env node
// Fails on an em dash (U+2014) or en dash (U+2013) in any tracked text file.
// Everything in this repository is customer-facing copy, and that copy uses
// plain ASCII punctuation. Binary files (any NUL byte) are skipped.
//
// Usage: node tools/check-copy.mjs
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
let hits = 0;
for (const file of files) {
  const text = readFileSync(file, "utf8");
  if (text.includes("\0")) continue;
  text.split("\n").forEach((line, i) => {
    if (/[–—]/.test(line)) {
      hits++;
      console.error(`${file}:${i + 1}: ${line.trim()}`);
    }
  });
}
if (hits) {
  console.error(`check-copy: ${hits} line(s) with an em or en dash; use a colon, comma or hyphen instead`);
  process.exit(1);
}
console.log(`check-copy: ${files.length} tracked files, no em or en dash`);
