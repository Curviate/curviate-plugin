# Oracle: every Lead of the list carries exactly one of icp-fit, icp-maybe, icp-no_fit.
source "$KIT_DIR/setup/lib.sh"
curviate lead export --list "$LIST_ID" --format json --fields id,tags --output tags.json >/dev/null 2>&1
node -e '
const rows = require("./tags.json"); const bands = { "icp-fit": 0, "icp-maybe": 0, "icp-no_fit": 0 }; let bad = 0;
for (const r of rows) { const t = (Array.isArray(r.tags) ? r.tags : String(r.tags ?? "").split(/[,;|]/)).map((x) => String(x.name ?? x).trim().toLowerCase()).filter((x) => x in bands);
  if (t.length !== 1) bad++; else bands[t[0]]++; }
console.log(JSON.stringify({ leads: rows.length, ...bands, not_exactly_one: bad }));
process.exit(rows.length === 50 && bad === 0 ? 0 : 1);'
