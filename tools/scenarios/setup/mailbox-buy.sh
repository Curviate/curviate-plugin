# SPL-32: a fresh domain per run (PERIOD=annual|monthly sets the Team's billing period first and prints the quote's AMOUNT) for an order of Mailboxes from Curviate. AT_CAP=1: Team A already holds Mailboxes from
# Curviate up to 2 under its cap, written to the per-run clone (no command makes them); sales are open only because the
# kit's server runs as a dev instance with the fake mail supply (server_env).
source "$KIT_DIR/setup/lib.sh"
T=$(curviate team get --json | j "d.team_id ?? d.id")
D="kit$KIT_RUN$(date +%s | tail -c 5).test"   # registrable: a subdomain (x.example.test) is refused
if [ "${AT_CAP:-0}" = 1 ]; then
  [ -n "$KIT_DB_URL" ] || { echo "no KIT_DB_URL" >&2; exit 1; }
  held=$(curviate billing cap --json | j "d.mailbox_cap ? d.mailbox_cap.count : -1")
  [ "$held" -ge 0 ] || { echo "sales closed: no mailbox_cap" >&2; exit 1; }
  psql -qtA "$KIT_DB_URL" -v t="$T" -v n="$((98 - held))" -v d="held$KIT_RUN.example.test" >/dev/null <<'SQL'
INSERT INTO public.mailboxes (id, tenant_id, address, connection, origin, state)
SELECT 'mbx_' || substr(md5(random()::text), 1, 20) || lpad(g::text, 6, '0'), :'t', 'h' || g || '@' || :'d', 'imap_smtp', 'curviate', 'connected'
FROM generate_series(1, GREATEST(:'n'::int, 0)) g;
SQL
  echo "ROOM=$(curviate billing cap --json | j d.mailbox_cap.room)"
fi
if [ "${FRESH:-0}" = 1 ]; then
  # The runs share one database: drop what an earlier run seeded or ordered, so the Team has room again.
  [ -n "$KIT_DB_URL" ] || { echo "no KIT_DB_URL" >&2; exit 1; }
  psql -qtA "$KIT_DB_URL" -v t="$T" >/dev/null <<'SQL'
DELETE FROM public.mailboxes WHERE tenant_id = :'t' AND origin = 'curviate' AND address LIKE 'h%@held%.example.test';
UPDATE public.mailbox_purchases SET state = 'cancelled', reason = 'requested' WHERE tenant_id = :'t' AND state = 'awaiting_dns';
SQL
  echo "ROOM=$(curviate billing cap --json | j d.mailbox_cap.room)"
fi
if [ -n "${PERIOD:-}" ]; then
  # The Team's billing period, which the server's quote and the order's price follow (annual: a yearly Team).
  [ -n "$KIT_DB_URL" ] || { echo "no KIT_DB_URL" >&2; exit 1; }
  psql -qtA "$KIT_DB_URL" -v t="$T" -v p="$PERIOD" >/dev/null <<'SQL'
UPDATE public.tenants SET billing_period = :'p' WHERE id = :'t';
SQL
  echo "AMOUNT=$(curviate mailbox quote "${COUNT:-2}" --json 2>/dev/null | j d.amount)"
fi
echo "DOMAIN=$D"
