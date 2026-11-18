# Shared by the scenario setups and checks: `curviate` is the pinned CLI on the scenario's key, straight to the server.
set -euo pipefail
# jq-free JSON read: j '<js expression over d>' < json
j() { node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const d=JSON.parse(s);const v=('"$1"');console.log(typeof v==="object"?JSON.stringify(v):v)})'; }
acc() { curviate account list --json | j "d.items[${1:-0}].account_id"; }
tag() { echo "kit$KIT_RUN$(date +%s%N | tail -c 7)"; }
# leads <list_id> <csv rows...>: one import of linkedin_url,first_name,last_name,company,job_title,location,email rows.
leads() { local l=$1; shift; { echo "linkedin_url,first_name,last_name,company,job_title,location,email"; printf '%s\n' "$@"; } > leads.csv
  curviate lead import --file leads.csv --list "$l" --json > /dev/null; }
