# Oracle: 14 Leads with an address (4 kept, 10 found), none on the 3 excluded or the 3 the tool did not know, and the
# Lead the tool gave two addresses holds the first-ranked one.
source "$KIT_DIR/setup/lib.sh"
curviate lead export --list "$LIST_ID" --format json --fields linkedin_url,email --output leads.json >/dev/null 2>&1
node -e '
const rows = require("./leads.json"), run = process.env.KIT_RUN, by = {};
for (const r of rows) by[r.linkedin_url.replace(/\/+$/, "").split("-").pop()] = r.email || "";
const bad = [];
for (let i = 1; i <= 20; i++) {
  const want = i <= 4 ? `has${i}.run${run}@example.test` : i >= 8 && i <= 17 ? `found${i}.run${run}@example.test` : "";
  if ((by[i] ?? "<missing>") !== want) bad.push(`lead ${i}: ${by[i] ?? "<missing>"} want ${want || "(none)"}`);
}
console.log(`with an address: ${Object.values(by).filter(Boolean).length} of ${rows.length}`);
if (bad.length) { console.log(bad.join("\n")); process.exit(1); }'
