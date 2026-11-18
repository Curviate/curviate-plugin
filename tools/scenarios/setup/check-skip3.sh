# Oracle for "start without them": the Campaign is active and exactly the 3 Leads without an address are skipped
# (no_email_address), the 7 others enrolled. The list scan runs in the background: wait up to 90 s for 10 Enrollments.
source "$KIT_DIR/setup/lib.sh"
curviate campaign get "$CAMPAIGN_ID" --json | j 'd.status' | grep -qx active || { echo "campaign not active"; exit 1; }
for _ in $(seq 1 30); do
  out=$(curviate enrollment list --campaign "$CAMPAIGN_ID" --limit 50 --json | j 'd.items.map(e=>e.status==="skipped"?e.skip_reason:"enrolled").sort().join(",")')
  [ "$(tr ',' '\n' <<<"$out" | grep -c .)" -ge 10 ] && break; sleep 3; done
echo "enrollments: $out"
[ "$(tr ',' '\n' <<<"$out" | grep -cx no_email_address)" = 3 ] && [ "$(tr ',' '\n' <<<"$out" | grep -cx enrolled)" = 7 ]
