# Team A at its spending cap: the cap set to the seats it holds, on the per-run clone (no command sets a cap; the
# dashboard does). Nothing reaches the payment processor: a refused add stops before it.
source "$KIT_DIR/setup/lib.sh"
T=$(curviate team get --json | j "d.team_id ?? d.id")
[ -n "$KIT_DB_URL" ] || { echo "no KIT_DB_URL" >&2; exit 1; }
n=$(psql -qtA "$KIT_DB_URL" -v t="$T" <<'SQL'
WITH u AS (
UPDATE public.tenants t SET spending_cap_seats = GREATEST(1, (SELECT count(*) FROM public.seats s WHERE s.tenant_id = t.id AND NOT s.is_trial
  AND s.lent_from_seat_id IS NULL AND s.cancellation_source IS DISTINCT FROM 'seat_decrement')) WHERE t.id = :'t' RETURNING 1)
SELECT count(*) FROM u;
SQL
)
[ "$n" = 1 ] || { echo "cap not set (team $T, rows $n)" >&2; exit 1; }
room=$(curviate billing cap --json | j d.room_seats); [ "$room" = 0 ] || { echo "room $room, want 0" >&2; exit 1; }
echo "ROOM=$room"
